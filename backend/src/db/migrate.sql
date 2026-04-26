-- River Med — Auth System Migration v2
-- Run against your existing river_med database:
--   mysql -h <host> -u <user> -p river_med < src/db/migrate.sql
--
-- Safe to run on an existing database.
-- Existing users are marked is_verified=1 so their logins are not disrupted.
-- Requires MySQL 8.0+ for ADD COLUMN IF NOT EXISTS.

USE river_med;

-- ── users table: broaden constraints for the new auth model ──────────────────

-- Allow email to be NULL (phone-only accounts)
ALTER TABLE users
  MODIFY COLUMN email VARCHAR(150) NULL;

-- Allow password_hash to be NULL (PIN/OTP-only accounts)
ALTER TABLE users
  MODIFY COLUMN password_hash TEXT NULL;

-- Phone number — unique per user, optional
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50) UNIQUE NULL AFTER email;

-- Verification flag — false until OTP confirmed; true for admin-created staff
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER role;

-- Active flag — allows soft-disabling without deletion
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER is_verified;

-- Mark all pre-existing accounts as verified so they can still log in
UPDATE users SET is_verified = 1 WHERE is_verified = 0;

-- ── otp_codes ─────────────────────────────────────────────────────────────────
-- Stores hashed 6-digit codes for login, registration, and password reset.
-- Never store the plaintext code here.

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

-- ── messages: add read_at for read-receipt tracking ──────────────────────────
-- NULL = unread. Set to UTC_TIMESTAMP() by the receiver via PUT /:id/read.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS read_at DATETIME NULL DEFAULT NULL AFTER body;

-- Index so "unread for doctor/patient" queries stay fast
DROP PROCEDURE IF EXISTS _add_messages_read_idx;
DELIMITER $$
CREATE PROCEDURE _add_messages_read_idx()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name   = 'messages'
      AND index_name   = 'idx_messages_read_at'
  ) THEN
    ALTER TABLE messages ADD INDEX idx_messages_read_at (read_at);
  END IF;
END$$
DELIMITER ;
CALL _add_messages_read_idx();
DROP PROCEDURE IF EXISTS _add_messages_read_idx;

-- ── appointments: make doctor_id nullable ────────────────────────────────────
-- Allows patients to submit appointment requests before a doctor is assigned.
-- Admin assigns the doctor later via PUT /api/appointments/:id/assign.

ALTER TABLE appointments MODIFY COLUMN doctor_id INT UNSIGNED NULL;

-- ── patients: add user_id back-reference ─────────────────────────────────────
-- Enables direct lookup from patient → user without joining through users.
-- Safe to run on existing data; existing rows get NULL until they re-register.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS user_id     INT UNSIGNED NULL AFTER id,
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100) NULL AFTER first_name,
  ADD COLUMN IF NOT EXISTS second_last_name VARCHAR(100) NULL AFTER last_name;

-- Add unique index only if it doesn't already exist
-- (MySQL has no IF NOT EXISTS for indexes; this approach is safe to re-run)
DROP PROCEDURE IF EXISTS _add_patient_user_idx;
DELIMITER $$
CREATE PROCEDURE _add_patient_user_idx()
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
CALL _add_patient_user_idx();
DROP PROCEDURE IF EXISTS _add_patient_user_idx;

-- ── password_reset_tokens ─────────────────────────────────────────────────────
-- Reserved for link-based email reset flows (future implementation).
-- The current reset flow uses otp_codes with purpose='forgot_password'.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED  NOT NULL,
  token_hash TEXT          NOT NULL,
  expires_at DATETIME      NOT NULL,
  used_at    DATETIME      NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user    (user_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB;
