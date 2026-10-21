CREATE TABLE IF NOT EXISTS device_wifi_commands (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id INT UNSIGNED NOT NULL,
  ssid VARCHAR(32) NOT NULL,
  password VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('queued','sent','ok','error','expired') NOT NULL DEFAULT 'queued',
  message VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  acked_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  KEY idx_device_wifi_commands (device_id, status, id),
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
