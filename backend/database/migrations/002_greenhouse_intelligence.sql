SET NAMES utf8mb4;

ALTER TABLE sensors
  MODIFY sensor_type ENUM('temperature','humidity','soil_moisture','ec','light','water_level','ph','other',
    'soil_temperature','co2','leaf_wetness','water_temperature','flow','pressure','wind_speed','rainfall') NOT NULL,
  ADD COLUMN channel_key VARCHAR(30) NULL AFTER name;

ALTER TABLE actuators
  MODIFY actuator_type ENUM('irrigation','misting','fan','light','other','heater','vent','shade','fertigation','pump','relay') NOT NULL,
  ADD COLUMN relay_channel TINYINT UNSIGNED NULL,
  ADD COLUMN gpio_pin TINYINT UNSIGNED NULL;

ALTER TABLE crops
  ADD COLUMN base_temp_c DECIMAL(4,1) NOT NULL DEFAULT 10.0,
  ADD COLUMN description_ne TEXT NULL,
  ADD COLUMN description_en TEXT NULL;

ALTER TABLE automation_rules
  ADD COLUMN schedule_from TIME NULL,
  ADD COLUMN schedule_to TIME NULL,
  ADD COLUMN last_started_at DATETIME NULL;

CREATE TABLE crop_stages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_id INT UNSIGNED NOT NULL,
  stage_code VARCHAR(30) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  name_ne VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  start_day SMALLINT UNSIGNED NOT NULL,
  end_day SMALLINT UNSIGNED NOT NULL,
  description_ne TEXT NULL,
  description_en TEXT NULL,
  UNIQUE KEY uq_crop_stage (crop_id, stage_code),
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE crop_stage_targets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_id INT UNSIGNED NOT NULL,
  stage_code VARCHAR(30) NOT NULL DEFAULT 'all',
  parameter VARCHAR(30) NOT NULL,
  min_value DOUBLE NOT NULL,
  opt_min DOUBLE NOT NULL,
  opt_max DOUBLE NOT NULL,
  max_value DOUBLE NOT NULL,
  UNIQUE KEY uq_target (crop_id, stage_code, parameter),
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE crop_cycles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  growing_unit_id INT UNSIGNED NOT NULL,
  crop_id INT UNSIGNED NOT NULL,
  batch_code VARCHAR(40) NOT NULL UNIQUE,
  variety VARCHAR(100) NULL,
  planted_on DATE NOT NULL,
  plant_count INT UNSIGNED NULL,
  expected_harvest_on DATE NULL,
  stage_override VARCHAR(30) NULL,
  status ENUM('active','harvested','failed','cancelled') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  KEY idx_cycle_unit (growing_unit_id, status),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id),
  FOREIGN KEY (crop_id) REFERENCES crops(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE manual_observations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cycle_id INT UNSIGNED NOT NULL,
  observed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  obs_type ENUM('growth','pest_disease','nutrition','water','harvest','note') NOT NULL DEFAULT 'growth',
  plant_height_cm DECIMAL(6,1) NULL,
  leaf_count INT UNSIGNED NULL,
  ph_value DECIMAL(4,2) NULL,
  ec_value DECIMAL(5,2) NULL,
  yield_kg DECIMAL(9,2) NULL,
  pest_disease VARCHAR(150) NULL,
  severity ENUM('none','low','medium','high') NULL,
  fertilizer VARCHAR(150) NULL,
  notes TEXT NULL,
  observed_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_obs_cycle (cycle_id, observed_at),
  FOREIGN KEY (cycle_id) REFERENCES crop_cycles(id) ON DELETE CASCADE,
  FOREIGN KEY (observed_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE recommendations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  growing_unit_id INT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL,
  severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  message_ne VARCHAR(500) NOT NULL,
  message_en VARCHAR(500) NOT NULL,
  status ENUM('open','dismissed','resolved') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  KEY idx_rec_unit (growing_unit_id, status),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE analysis_snapshots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  growing_unit_id INT UNSIGNED NOT NULL,
  computed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  health_score TINYINT UNSIGNED NULL,
  vpd DOUBLE NULL,
  dew_point DOUBLE NULL,
  dli DOUBLE NULL,
  KEY idx_snap_unit (growing_unit_id, computed_at),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cameras (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id INT UNSIGNED NOT NULL,
  growing_unit_id INT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  camera_type ENUM('esp32cam','ip_camera','usb') NOT NULL DEFAULT 'esp32cam',
  stream_url VARCHAR(500) NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_snapshot_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES iot_devices(id),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id)
) ENGINE=InnoDB;

CREATE TABLE camera_snapshots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  camera_id INT UNSIGNED NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_snap_cam (camera_id, captured_at),
  FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
) ENGINE=InnoDB;
