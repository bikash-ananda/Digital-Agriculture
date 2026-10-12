SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS ops_devices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ops_id VARCHAR(60) NOT NULL UNIQUE,
  device_id INT UNSIGNED NOT NULL UNIQUE,
  token_hash CHAR(64) NOT NULL,
  config_mirror JSON NULL,
  last_telemetry_at DATETIME NULL,
  last_poll_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ops_health (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ops_device_id INT UNSIGNED NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uptime_s INT UNSIGNED NULL, rssi SMALLINT NULL, ip VARCHAR(45) NULL, ssid VARCHAR(64) NULL,
  heap_free INT UNSIGNED NULL, heap_min INT UNSIGNED NULL, reset_reason VARCHAR(30) NULL,
  wifi_reconnects INT UNSIGNED NULL, http_fails INT UNSIGNED NULL, last_error VARCHAR(255) NULL,
  ota_state VARCHAR(80) NULL, image_validated TINYINT(1) NULL,
  pump_total_s_irrigation INT UNSIGNED NULL, pump_total_s_misting INT UNSIGNED NULL, firmware VARCHAR(30) NULL,
  sensors JSON NULL, relays JSON NULL, config JSON NULL, wifi_saved JSON NULL,
  KEY idx_ops_health (ops_device_id, recorded_at),
  FOREIGN KEY (ops_device_id) REFERENCES ops_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ops_commands (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ops_device_id INT UNSIGNED NOT NULL,
  type VARCHAR(30) NOT NULL,
  payload JSON NULL,
  status ENUM('queued','sent','ok','rejected','error','skipped','started','expired','cancelled') NOT NULL DEFAULT 'queued',
  message VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  acked_at DATETIME NULL,
  expires_at DATETIME NULL,
  KEY idx_ops_cmd (ops_device_id, status),
  FOREIGN KEY (ops_device_id) REFERENCES ops_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS firmware_images (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(30) NOT NULL UNIQUE,
  filename VARCHAR(120) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  md5 CHAR(32) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  notes VARCHAR(255) NULL,
  uploaded_by INT UNSIGNED NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_digests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  growing_unit_id INT UNSIGNED NOT NULL,
  day DATE NOT NULL,
  digest JSON NOT NULL,
  model JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_digest (growing_unit_id, day),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id) ON DELETE CASCADE
) ENGINE=InnoDB;
