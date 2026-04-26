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
  DECLARE v_fk VARCHAR(255) DEFAULT NULL;

  -- NOT FOUND fires when SELECT … INTO finds zero rows; set the variable to
  -- NULL so the IF v_fk IS NOT NULL guard below skips the DROP safely.
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fk = NULL;

  -- ── doctor_id ──────────────────────────────────────────────────────────────

  -- Step 1: find existing FK (constraint name varies by install)
  SELECT CONSTRAINT_NAME INTO v_fk
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA          = DATABASE()
    AND TABLE_NAME            = 'appointments'
    AND COLUMN_NAME           = 'doctor_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1;

  -- Step 2: drop it so the MODIFY below is not blocked
  IF v_fk IS NOT NULL THEN
    SET @drop_sql = CONCAT('ALTER TABLE appointments DROP FOREIGN KEY `', v_fk, '`');
    PREPARE _stmt FROM @drop_sql;
    EXECUTE _stmt;
    DEALLOCATE PREPARE _stmt;
    SET v_fk = NULL;
  END IF;

  -- Step 3: set exact type — INT UNSIGNED NULL matches doctors.id INT UNSIGNED
  ALTER TABLE appointments
    MODIFY COLUMN doctor_id INT UNSIGNED NULL;

  -- Step 4: re-add named FK only if none exists for this column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA          = DATABASE()
      AND TABLE_NAME            = 'appointments'
      AND COLUMN_NAME           = 'doctor_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
  ) THEN
    -- ON DELETE SET NULL: removing a doctor nulls the slot, not the appointment
    ALTER TABLE appointments
      ADD CONSTRAINT fk_appt_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL;
  END IF;

  -- ── patient_id ─────────────────────────────────────────────────────────────

  -- Step 1: find existing FK
  SELECT CONSTRAINT_NAME INTO v_fk
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA          = DATABASE()
    AND TABLE_NAME            = 'appointments'
    AND COLUMN_NAME           = 'patient_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1;

  -- Step 2: drop it
  IF v_fk IS NOT NULL THEN
    SET @drop_sql = CONCAT('ALTER TABLE appointments DROP FOREIGN KEY `', v_fk, '`');
    PREPARE _stmt FROM @drop_sql;
    EXECUTE _stmt;
    DEALLOCATE PREPARE _stmt;
    SET v_fk = NULL;
  END IF;

  -- Step 3: set exact type — INT UNSIGNED NOT NULL matches patients.id INT UNSIGNED
  ALTER TABLE appointments
    MODIFY COLUMN patient_id INT UNSIGNED NOT NULL;

  -- Step 4: re-add named FK only if none exists for this column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA          = DATABASE()
      AND TABLE_NAME            = 'appointments'
      AND COLUMN_NAME           = 'patient_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
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
