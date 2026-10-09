SET NAMES utf8mb4;

ALTER TABLE growing_units ADD COLUMN is_simulated TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE sensor_readings ADD KEY idx_recorded (recorded_at);

CREATE TABLE sensor_hourly (
  sensor_id INT UNSIGNED NOT NULL,
  hour_local DATETIME NOT NULL,
  n INT UNSIGNED NOT NULL,
  v_avg DOUBLE NOT NULL, v_min DOUBLE NOT NULL, v_max DOUBLE NOT NULL, v_std DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (sensor_id, hour_local),
  KEY idx_hour (hour_local),
  FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sensor_daily (
  sensor_id INT UNSIGNED NOT NULL,
  day DATE NOT NULL,
  n INT UNSIGNED NOT NULL,
  hours_covered TINYINT UNSIGNED NOT NULL,
  v_avg DOUBLE NOT NULL, v_min DOUBLE NOT NULL, v_max DOUBLE NOT NULL, v_std DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (sensor_id, day),
  FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE unit_daily (
  growing_unit_id INT UNSIGNED NOT NULL,
  day DATE NOT NULL,
  cycle_id INT UNSIGNED NULL, crop_id INT UNSIGNED NULL, dap SMALLINT NULL,
  temp_avg DOUBLE NULL, temp_min DOUBLE NULL, temp_max DOUBLE NULL, rh_avg DOUBLE NULL,
  vpd_avg DOUBLE NULL, vpd_max DOUBLE NULL, dew_point_min DOUBLE NULL, dli DOUBLE NULL, gdd DOUBLE NULL,
  soil_moisture_avg DOUBLE NULL, soil_moisture_min DOUBLE NULL, soil_moisture_max DOUBLE NULL,
  soil_temp_avg DOUBLE NULL, ec_avg DOUBLE NULL, water_level_min DOUBLE NULL,
  irrigation_min DOUBLE NULL, misting_min DOUBLE NULL, fan_min DOUBLE NULL, irrigation_events SMALLINT UNSIGNED NULL,
  tir_temp DOUBLE NULL, tir_rh DOUBLE NULL, tir_soil_moisture DOUBLE NULL, tir_vpd DOUBLE NULL,
  h_temp_above DOUBLE NULL, h_temp_below DOUBLE NULL, data_coverage DOUBLE NULL,
  computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (growing_unit_id, day),
  KEY idx_ud_day (day),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE device_telemetry (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id INT UNSIGNED NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rssi SMALLINT NULL, uptime_s INT UNSIGNED NULL, free_heap INT UNSIGNED NULL,
  reset_reason VARCHAR(30) NULL, firmware VARCHAR(30) NULL,
  sensor_errors INT UNSIGNED NULL, wifi_reconnects INT UNSIGNED NULL, http_failures INT UNSIGNED NULL,
  KEY idx_tel (device_id, recorded_at),
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sensor_calibrations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT UNSIGNED NOT NULL,
  method VARCHAR(120) NOT NULL,
  reference_instrument VARCHAR(150) NULL,
  point1_measured DOUBLE NOT NULL, point1_reference DOUBLE NOT NULL,
  point2_measured DOUBLE NULL, point2_reference DOUBLE NULL,
  offset_before DOUBLE NOT NULL, scale_before DOUBLE NOT NULL, offset_after DOUBLE NOT NULL, scale_after DOUBLE NOT NULL,
  notes VARCHAR(500) NULL,
  performed_by INT UNSIGNED NULL,
  performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cal_sensor (sensor_id, performed_at),
  FOREIGN KEY (sensor_id) REFERENCES sensors(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE experiments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  hypothesis TEXT NULL,
  metric VARCHAR(40) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('draft','running','completed','cancelled') NOT NULL DEFAULT 'draft',
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE experiment_groups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experiment_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE experiment_units (
  experiment_id INT UNSIGNED NOT NULL,
  group_id INT UNSIGNED NOT NULL,
  growing_unit_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (experiment_id, growing_unit_id),
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES experiment_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id)
) ENGINE=InnoDB;
