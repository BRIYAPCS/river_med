-- River Med — database schema
-- Run once against the river_med database:
--   mysql -h <host> -u <user> -p river_med < src/db/schema.sql

CREATE DATABASE IF NOT EXISTS river_med
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE river_med;

-- ─── patients ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id            INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(100)     NOT NULL,
  last_name     VARCHAR(100)     NOT NULL,
  email         VARCHAR(255)     UNIQUE,
  phone         VARCHAR(30),
  date_of_birth DATE,
  blood_type    ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-'),
  created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── doctors ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  first_name  VARCHAR(100)  NOT NULL,
  last_name   VARCHAR(100)  NOT NULL,
  specialty   VARCHAR(150),
  email       VARCHAR(255)  UNIQUE,
  phone       VARCHAR(30),
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── appointments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id               INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  patient_id       INT UNSIGNED  NOT NULL,
  doctor_id        INT UNSIGNED  NOT NULL,
  appointment_date DATETIME      NOT NULL,
  reason           VARCHAR(255),
  status           VARCHAR(50)   NOT NULL DEFAULT 'waiting',
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE CASCADE,
  INDEX idx_date   (appointment_date),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ─── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          INT UNSIGNED                  AUTO_INCREMENT PRIMARY KEY,
  patient_id  INT UNSIGNED                  NOT NULL,
  doctor_id   INT UNSIGNED                  NOT NULL,
  sender_role ENUM('patient','doctor')      NOT NULL,
  body        TEXT                          NOT NULL,
  created_at  DATETIME                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE CASCADE,
  INDEX idx_thread (patient_id, doctor_id)
) ENGINE=InnoDB;

-- ─── prescriptions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT UNSIGNED  NOT NULL,
  doctor_id       INT UNSIGNED  NOT NULL,
  medication_name VARCHAR(255)  NOT NULL,
  dosage          VARCHAR(255)  NOT NULL,
  instructions    TEXT,
  refill_allowed  TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── refill requests ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refill_requests (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT UNSIGNED  NOT NULL,
  status          ENUM('Pending','Approved','Denied') NOT NULL DEFAULT 'Pending',
  doctor_notes    TEXT,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- If the table already exists without doctor_notes, run:
--   ALTER TABLE refill_requests ADD COLUMN doctor_notes TEXT AFTER status;

-- ─── users (auth) ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED                       AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255)                       NOT NULL UNIQUE,
  password_hash VARCHAR(255)                       NOT NULL,
  role          ENUM('admin','doctor','patient')   NOT NULL DEFAULT 'patient',
  patient_id    INT UNSIGNED                       NULL,
  doctor_id     INT UNSIGNED                       NULL,
  created_at    DATETIME                           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─── seed: one doctor so check-in works immediately ──────────────────────────
INSERT IGNORE INTO doctors (id, first_name, last_name, specialty, email)
VALUES (1, 'Sarah', 'Chen', 'General Practice', 'sarah.chen@rivermed.com');
