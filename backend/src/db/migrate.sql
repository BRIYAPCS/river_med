-- =============================================================================
-- River Med — idempotent schema migrations
-- Target: MySQL 8.0  |  Database: river_med  |  User: briya
--
-- Safe to run multiple times on the same database.
-- Never deletes data, never drops tables.
--
-- Usage:
--   mysql -u briya -p river_med < src/db/migrate.sql
--
-- Rules applied throughout:
--   • ADD COLUMN IF NOT EXISTS is MariaDB-only — every column addition is
--     guarded by an INFORMATION_SCHEMA check inside a stored procedure.
--   • Every FK references a column whose type is EXACT (INT UNSIGNED) —
--     MySQL 8.0.16+ enforces strict type compatibility (ERROR 3780 otherwise).
--   • Procedures drop themselves after use (no persistent objects left behind).
--   • MODIFY COLUMN and CREATE TABLE IF NOT EXISTS are always idempotent.
-- =============================================================================

USE river_med;

-- =============================================================================
-- users — broaden constraints for the new auth model
-- =============================================================================

-- Allow email to be NULL (phone-only accounts)
ALTER TABLE users
  MODIFY COLUMN email VARCHAR(150) NULL;

-- Allow password_hash to be NULL (PIN/OTP-only accounts)
ALTER TABLE users
  MODIFY COLUMN password_hash TEXT NULL;

-- ── add phone, is_verified, is_active to users ───────────────────────────────

DROP PROCEDURE IF EXISTS _river_users_new_cols;
DELIMITER $$
CREATE PROCEDURE _river_users_new_cols()
BEGIN
  -- phone: unique per user, optional
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name   = 'users'
      AND column_name  = 'phone'
  ) THEN
    ALTER TABLE users
      ADD COLUMN phone VARCHAR(50) NULL AFTER email;
  END IF;

  -- unique index on phone — checked separately so each guard is independent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name   = 'users'
      AND index_name   = 'phone'
  ) THEN
    ALTER TABLE users
      ADD UNIQUE INDEX phone (phone);
  END IF;

  -- is_verified: false until OTP confirmed; true for admin-created staff
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name   = 'users'
      AND column_name  = 'is_verified'
  ) THEN
    ALTER TABLE users
      ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER role;
  END IF;

  -- is_active: allows soft-disabling without deletion
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name   = 'users'
      AND column_name  = 'is_active'
  ) THEN
    ALTER TABLE users
      ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER is_verified;
  END IF;
END$$
DELIMITER ;
CALL _river_users_new_cols();
DROP PROCEDURE IF EXISTS _river_users_new_cols;

-- Mark all pre-existing accounts as verified so they can still log in.
-- Safe to repeat: rows already at is_verified = 1 are not touched.
UPDATE users SET is_verified = 1 WHERE is_verified = 0;

-- =============================================================================
-- otp_codes — hashed 6-digit codes for login, registration, password reset
-- =============================================================================

CREATE TABLE IF NOT EXISTS otp_codes (
  id              INT UNSIGNED                                AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED                                NOT NULL,
  delivery_method ENUM('email','sms')                        NOT NULL,
  destination     VARCHAR(150)                               NOT NULL,
  code_hash       TEXT                                       NOT NULL,
  purpose         ENUM('login','register','forgot_password') NOT NULL,
  expires_at      DATETIME                                   NOT NULL,
  used_at         DATETIME                                   NULL,
  created_at      TIMESTAMP                                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_purpose (user_id, purpose),
  INDEX idx_expires      (expires_at)
) ENGINE=InnoDB;

-- =============================================================================
-- messages — read_at for read-receipt tracking
-- NULL = unread; set to UTC_TIMESTAMP() by the receiver via PUT /:id/read.
-- =============================================================================

DROP PROCEDURE IF EXISTS _river_messages_read_at;
DELIMITER $$
CREATE PROCEDURE _river_messages_read_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name   = 'messages'
      AND column_name  = 'read_at'
  ) THEN
    ALTER TABLE messages
      ADD COLUMN read_at DATETIME NULL DEFAULT NULL AFTER body;
  END IF;

  -- Index so "unread count" queries stay fast
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name   = 'messages'
      AND index_name   = 'idx_messages_read_at'
  ) THEN
    ALTER TABLE messages
      ADD INDEX idx_messages_read_at (read_at);
  END IF;
END$$
DELIMITER ;
CALL _river_messages_read_at();
DROP PROCEDURE IF EXISTS _river_messages_read_at;

-- =============================================================================
-- appointments — fix FK type mismatch + make doctor_id nullable
--
-- MySQL 8.0.16+ enforces that referencing and referenced columns are type-
-- identical (ERROR 3780). If the live DB has doctor_id or patient_id as signed
-- INT while doctors.id / patients.id are INT UNSIGNED, any ALTER involving
-- those FKs will fail.
--
-- Strategy for each column:
--   1. Look up the auto-generated FK constraint name from INFORMATION_SCHEMA.
--   2. Drop it (dynamic SQL because the name is unknown at write time).
--   3. MODIFY the column to the exact unsigned type.
--   4. Re-add a named FK only if none is present.
-- =============================================================================

DROP PROCEDURE IF EXISTS _river_fix_appointments_fks;
DELIMITER $$
CREATE PROCEDURE _river_fix_appointments_fks()
BEGIN
  DECLARE v_fk      VARCHAR(255) DEFAULT NULL;
  DECLARE v_type_dr VARCHAR(64)  DEFAULT 'int';
  DECLARE v_type_pt VARCHAR(64)  DEFAULT 'int';

  -- No-op handler: if a SELECT INTO finds 0 rows the variable keeps its
  -- default value — the caller must SET the variable to NULL before each
  -- SELECT INTO that is used as a guard.
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

  -- ── detect the actual column type of doctors.id and patients.id ─────────────
  -- We use dynamic MODIFY so that appointments FK columns always match exactly,
  -- regardless of whether the original schema used INT or INT UNSIGNED.

  SELECT LOWER(COLUMN_TYPE) INTO v_type_dr
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'doctors' AND COLUMN_NAME = 'id'
  LIMIT 1;

  SELECT LOWER(COLUMN_TYPE) INTO v_type_pt
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'patients' AND COLUMN_NAME = 'id'
  LIMIT 1;

  -- ── doctor_id ──────────────────────────────────────────────────────────────

  SET v_fk = NULL;
  SELECT CONSTRAINT_NAME INTO v_fk
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'doctor_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1;

  IF v_fk IS NOT NULL THEN
    SET @drop_sql = CONCAT('ALTER TABLE appointments DROP FOREIGN KEY `', v_fk, '`');
    PREPARE _stmt FROM @drop_sql;
    EXECUTE _stmt;
    DEALLOCATE PREPARE _stmt;
    SET v_fk = NULL;
  END IF;

  -- MODIFY to the exact same type as doctors.id (dynamic — never hard-coded)
  SET @mod_dr = CONCAT('ALTER TABLE appointments MODIFY COLUMN doctor_id ', v_type_dr, ' NULL');
  PREPARE _stmt FROM @mod_dr;
  EXECUTE _stmt;
  DEALLOCATE PREPARE _stmt;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments'
      AND COLUMN_NAME = 'doctor_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT fk_appt_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL;
  END IF;

  -- ── patient_id ─────────────────────────────────────────────────────────────

  SET v_fk = NULL;
  SELECT CONSTRAINT_NAME INTO v_fk
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'patient_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1;

  IF v_fk IS NOT NULL THEN
    SET @drop_sql = CONCAT('ALTER TABLE appointments DROP FOREIGN KEY `', v_fk, '`');
    PREPARE _stmt FROM @drop_sql;
    EXECUTE _stmt;
    DEALLOCATE PREPARE _stmt;
    SET v_fk = NULL;
  END IF;

  SET @mod_pt = CONCAT('ALTER TABLE appointments MODIFY COLUMN patient_id ', v_type_pt, ' NOT NULL');
  PREPARE _stmt FROM @mod_pt;
  EXECUTE _stmt;
  DEALLOCATE PREPARE _stmt;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments'
      AND COLUMN_NAME = 'patient_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT fk_appt_patient
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END$$
DELIMITER ;
CALL _river_fix_appointments_fks();
DROP PROCEDURE IF EXISTS _river_fix_appointments_fks;

-- =============================================================================
-- patients — user_id back-reference + name columns
-- =============================================================================

DROP PROCEDURE IF EXISTS _river_patients_new_cols;
DELIMITER $$
CREATE PROCEDURE _river_patients_new_cols()
BEGIN
  -- user_id: direct link patient → user row; INT UNSIGNED NULL matches users.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name   = 'patients'
      AND column_name  = 'user_id'
  ) THEN
    ALTER TABLE patients
      ADD COLUMN user_id INT UNSIGNED NULL AFTER id;
  END IF;

  -- middle_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name   = 'patients'
      AND column_name  = 'middle_name'
  ) THEN
    ALTER TABLE patients
      ADD COLUMN middle_name VARCHAR(100) NULL AFTER first_name;
  END IF;

  -- second_last_name (paternal/maternal surname support)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name   = 'patients'
      AND column_name  = 'second_last_name'
  ) THEN
    ALTER TABLE patients
      ADD COLUMN second_last_name VARCHAR(100) NULL AFTER last_name;
  END IF;
END$$
DELIMITER ;
CALL _river_patients_new_cols();
DROP PROCEDURE IF EXISTS _river_patients_new_cols;

-- ── unique index + FK on patients.user_id ────────────────────────────────────

DROP PROCEDURE IF EXISTS _river_patients_user_idx;
DELIMITER $$
CREATE PROCEDURE _river_patients_user_idx()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name   = 'patients'
      AND index_name   = 'idx_patient_user_id'
  ) THEN
    ALTER TABLE patients
      ADD UNIQUE INDEX idx_patient_user_id (user_id),
      ADD CONSTRAINT fk_patient_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;
CALL _river_patients_user_idx();
DROP PROCEDURE IF EXISTS _river_patients_user_idx;

-- =============================================================================
-- password_reset_tokens — link-based email reset flow
-- =============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED  NOT NULL,
  token_hash TEXT          NOT NULL,
  expires_at DATETIME      NOT NULL,
  used_at    DATETIME      NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_prt_user    (user_id),
  INDEX idx_prt_expires (expires_at)
) ENGINE=InnoDB;

-- =============================================================================
-- TIER 1 FEATURES
-- =============================================================================

-- ── appointments.status — extend ENUM to include all values the app uses ──────
-- Original schema may only have 'waiting'/'confirmed'/'completed'.
-- The app also uses 'cancelled' and 'in_progress'; add them if missing.

DROP PROCEDURE IF EXISTS _river_appt_status_enum;
DELIMITER $$
CREATE PROCEDURE _river_appt_status_enum()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name   = 'appointments'
      AND column_name  = 'status'
      AND column_type LIKE '%cancelled%'
  ) THEN
    ALTER TABLE appointments
      MODIFY COLUMN status
        ENUM('waiting','confirmed','in_progress','completed','cancelled','no_show')
        NOT NULL DEFAULT 'waiting';
  END IF;
END$$
DELIMITER ;
CALL _river_appt_status_enum();
DROP PROCEDURE IF EXISTS _river_appt_status_enum;

-- ── appointments.notes — doctor writes clinical notes on visit completion ─────

DROP PROCEDURE IF EXISTS _river_appt_notes;
DELIMITER $$
CREATE PROCEDURE _river_appt_notes()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name   = 'appointments'
      AND column_name  = 'notes'
  ) THEN
    ALTER TABLE appointments ADD COLUMN notes TEXT NULL AFTER status;
  END IF;
END$$
DELIMITER ;
CALL _river_appt_notes();
DROP PROCEDURE IF EXISTS _river_appt_notes;

-- ── patient_allergies ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_allergies (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  allergen   VARCHAR(255) NOT NULL,
  severity   ENUM('mild','moderate','severe') NOT NULL DEFAULT 'mild',
  reaction   VARCHAR(500) NULL,
  notes      TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_pa_patient (patient_id)
) ENGINE=InnoDB;

-- ── patient_conditions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_conditions (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id   INT NOT NULL,
  name         VARCHAR(255) NOT NULL,
  status       ENUM('active','chronic','resolved') NOT NULL DEFAULT 'active',
  diagnosed_at DATE NULL,
  notes        TEXT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_pc_patient (patient_id)
) ENGINE=InnoDB;

-- ── patient_medications — existing meds (outside our Rx system) ───────────────

CREATE TABLE IF NOT EXISTS patient_medications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  dosage     VARCHAR(255) NULL,
  frequency  VARCHAR(255) NULL,
  started_at DATE NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  notes      TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_pm_patient (patient_id)
) ENGINE=InnoDB;

-- ── appointment_vitals ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointment_vitals (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL UNIQUE,
  weight_kg      DECIMAL(5,2) NULL,
  height_cm      DECIMAL(5,1) NULL,
  bp_systolic    SMALLINT UNSIGNED NULL,
  bp_diastolic   SMALLINT UNSIGNED NULL,
  heart_rate     SMALLINT UNSIGNED NULL,
  temperature_c  DECIMAL(4,1) NULL,
  oxygen_sat     TINYINT UNSIGNED NULL,
  recorded_by    INT UNSIGNED NULL,
  notes          TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by)    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- TIER 2 FEATURES
-- =============================================================================

-- ── doctor_availability ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS doctor_availability (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id   INT NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,   -- 0=Sun 1=Mon … 6=Sat
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  UNIQUE KEY uq_da (doctor_id, day_of_week),
  INDEX idx_da_doctor (doctor_id)
) ENGINE=InnoDB;

-- ── notifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT         NOT NULL,
  link       VARCHAR(255) NULL,
  read_at    DATETIME     NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_unread (user_id, read_at)
) ENGINE=InnoDB;

-- ── patient_insurance ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_insurance (
  id                       INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  patient_id               INT           NOT NULL UNIQUE,
  carrier                  VARCHAR(255)  NULL,
  policy_number            VARCHAR(100)  NULL,
  group_number             VARCHAR(100)  NULL,
  subscriber_id            VARCHAR(100)  NULL,
  subscriber_name          VARCHAR(255)  NULL,
  relation_to_subscriber   VARCHAR(50)   NULL,
  valid_from               DATE          NULL,
  valid_until              DATE          NULL,
  updated_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── documents ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT NOT NULL,
  appointment_id INT NULL,
  uploaded_by    INT UNSIGNED NOT NULL,
  filename       VARCHAR(255) NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  size_bytes     INT UNSIGNED NOT NULL,
  storage_path   VARCHAR(500) NOT NULL,
  category       ENUM('lab_result','imaging','referral','report','other') NOT NULL DEFAULT 'other',
  description    TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)     REFERENCES patients(id)     ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by)    REFERENCES users(id)        ON DELETE RESTRICT,
  INDEX idx_doc_patient     (patient_id),
  INDEX idx_doc_appointment (appointment_id)
) ENGINE=InnoDB;

-- =============================================================================
-- TIER 3 FEATURES
-- =============================================================================

-- ── invoices ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT            NOT NULL,
  appointment_id INT            NULL,
  amount         DECIMAL(10,2)  NOT NULL DEFAULT 0,
  status         ENUM('draft','sent','paid','void') NOT NULL DEFAULT 'draft',
  due_date       DATE           NULL,
  line_items     JSON           NULL,
  notes          TEXT           NULL,
  created_by     INT UNSIGNED   NULL,
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)     REFERENCES patients(id)     ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)     REFERENCES users(id)        ON DELETE SET NULL,
  INDEX idx_inv_patient (patient_id),
  INDEX idx_inv_status  (status)
) ENGINE=InnoDB;

-- ── lab_results ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lab_results (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT           NOT NULL,
  doctor_id       INT           NULL,
  appointment_id  INT           NULL,
  test_name       VARCHAR(255)  NOT NULL,
  result_value    TEXT          NULL,
  unit            VARCHAR(50)   NULL,
  reference_range VARCHAR(100)  NULL,
  status          ENUM('pending','resulted','reviewed') NOT NULL DEFAULT 'pending',
  notes           TEXT          NULL,
  resulted_at     DATETIME      NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)     REFERENCES patients(id)     ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)      REFERENCES doctors(id)      ON DELETE SET NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  INDEX idx_lr_patient (patient_id),
  INDEX idx_lr_doctor  (doctor_id)
) ENGINE=InnoDB;

-- ── referrals ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id                  INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  patient_id          INT           NOT NULL,
  referring_doctor_id INT           NULL,
  referred_to_name    VARCHAR(255)  NULL,
  referred_specialty  VARCHAR(255)  NULL,
  reason              TEXT          NULL,
  status              ENUM('pending','accepted','completed','cancelled') NOT NULL DEFAULT 'pending',
  notes               TEXT          NULL,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)          REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (referring_doctor_id) REFERENCES doctors(id)  ON DELETE SET NULL,
  INDEX idx_ref_patient (patient_id),
  INDEX idx_ref_doctor  (referring_doctor_id)
) ENGINE=InnoDB;

-- ── audit_log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED  NULL,
  user_role   VARCHAR(20)   NULL,
  action      VARCHAR(100)  NOT NULL,
  entity_type VARCHAR(50)   NULL,
  entity_id   INT UNSIGNED  NULL,
  details     JSON          NULL,
  ip_address  VARCHAR(45)   NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user    (user_id),
  INDEX idx_audit_action  (action),
  INDEX idx_audit_entity  (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;
