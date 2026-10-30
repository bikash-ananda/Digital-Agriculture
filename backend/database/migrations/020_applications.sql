CREATE TABLE IF NOT EXISTS applications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  ref_no VARCHAR(30) NULL UNIQUE,
  tracking_hash CHAR(64) NOT NULL,
  type_code VARCHAR(40) NOT NULL,
  applicant_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  phone_verified TINYINT(1) NOT NULL DEFAULT 0,
  municipality VARCHAR(40) NULL,
  ward SMALLINT UNSIGNED NULL,
  data LONGTEXT NOT NULL,
  status ENUM('received','under_review','needs_info','forwarded','resolved','rejected') NOT NULL DEFAULT 'received',
  assigned_to INT UNSIGNED NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'web',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_applications_status (status, created_at),
  KEY idx_applications_phone (phone),
  KEY idx_applications_assigned (assigned_to)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS application_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id INT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL,
  note VARCHAR(2000) NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_application_events_app (application_id, created_at),
  CONSTRAINT fk_application_events_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS application_otps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_application_otps_lookup (phone, consumed_at, expires_at)
) ENGINE=InnoDB;
