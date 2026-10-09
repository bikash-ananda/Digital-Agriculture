SET NAMES utf8mb4;

-- ============ LOCATIONS ============
CREATE TABLE provinces (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name_ne VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE districts (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  province_id TINYINT UNSIGNED NOT NULL,
  name_ne VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_district (province_id, name_en),
  FOREIGN KEY (province_id) REFERENCES provinces(id)
) ENGINE=InnoDB;

CREATE TABLE local_levels (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  district_id SMALLINT UNSIGNED NOT NULL,
  level_type ENUM('metropolitan','sub_metropolitan','municipality','rural_municipality') NOT NULL,
  name_ne VARCHAR(150) NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  total_wards TINYINT UNSIGNED NULL,
  UNIQUE KEY uq_local_level (district_id, name_en),
  FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB;

-- ============ ORGANIZATIONS ============
CREATE TABLE organizations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED NULL,
  org_type ENUM('ministry','directorate','agriculture_office','local_agri_section','other') NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_ne VARCHAR(200) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  district_id SMALLINT UNSIGNED NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES organizations(id),
  FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB;

CREATE TABLE departments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name_ne VARCHAR(150) NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  UNIQUE KEY uq_dept (organization_id, name_en),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB;

-- ============ USERS / RBAC ============
CREATE TABLE roles (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_ne VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id SMALLINT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  organization_id INT UNSIGNED NULL,
  department_id INT UNSIGNED NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(150) NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name_ne VARCHAR(150) NULL,
  full_name_en VARCHAR(150) NOT NULL,
  position_title VARCHAR(150) NULL,
  status ENUM('active','inactive','locked','pending') NOT NULL DEFAULT 'active',
  failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  role_id SMALLINT UNSIGNED NOT NULL,
  organization_id INT UNSIGNED NULL,
  UNIQUE KEY uq_user_role (user_id, role_id, organization_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB;

-- ============ SITES / FARMERS / FARMS / GROWING UNITS ============
CREATE TABLE sites (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_ne VARCHAR(200) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  site_type ENUM('demonstration','farm','research','other') NOT NULL DEFAULT 'demonstration',
  local_level_id INT UNSIGNED NULL,
  ward_no TINYINT UNSIGNED NULL,
  address VARCHAR(255) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (local_level_id) REFERENCES local_levels(id)
) ENGINE=InnoDB;

CREATE TABLE farmers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL UNIQUE,
  organization_id INT UNSIGNED NULL,
  farmer_code VARCHAR(30) NOT NULL UNIQUE,
  full_name_ne VARCHAR(150) NULL,
  full_name_en VARCHAR(150) NOT NULL,
  gender ENUM('male','female','other') NULL,
  date_of_birth DATE NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  local_level_id INT UNSIGNED NULL,
  ward_no TINYINT UNSIGNED NULL,
  address VARCHAR(255) NULL,
  group_name VARCHAR(150) NULL,
  status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_farmer_name (full_name_en),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (local_level_id) REFERENCES local_levels(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE farms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farmer_id INT UNSIGNED NOT NULL,
  site_id INT UNSIGNED NULL,
  name VARCHAR(200) NOT NULL,
  local_level_id INT UNSIGNED NULL,
  ward_no TINYINT UNSIGNED NULL,
  address VARCHAR(255) NULL,
  area_sqm DECIMAL(12,2) NULL,
  ownership_type ENUM('owned','leased','shared','government') NOT NULL DEFAULT 'owned',
  irrigation_type ENUM('none','rainfed','drip','sprinkler','canal','other') NOT NULL DEFAULT 'none',
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id),
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (local_level_id) REFERENCES local_levels(id)
) ENGINE=InnoDB;

CREATE TABLE crops (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_ne VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  scientific_name VARCHAR(150) NULL,
  category ENUM('vegetable','fruit','cereal','pulse','cash_crop','spice','flower','other') NOT NULL DEFAULT 'other'
) ENGINE=InnoDB;

CREATE TABLE growing_units (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  farm_id INT UNSIGNED NULL,
  unit_type ENUM('greenhouse','tunnel','open_field') NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_ne VARCHAR(150) NULL,
  name_en VARCHAR(150) NOT NULL,
  area_sqm DECIMAL(10,2) NULL,
  status ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (farm_id) REFERENCES farms(id)
) ENGINE=InnoDB;

CREATE TABLE growing_unit_crops (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  growing_unit_id INT UNSIGNED NOT NULL,
  crop_id INT UNSIGNED NOT NULL,
  season VARCHAR(50) NULL,
  planted_on DATE NULL,
  expected_harvest_on DATE NULL,
  status ENUM('planned','growing','harvested','failed') NOT NULL DEFAULT 'planned',
  notes TEXT NULL,
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id),
  FOREIGN KEY (crop_id) REFERENCES crops(id)
) ENGINE=InnoDB;

-- ============ IoT ============
CREATE TABLE iot_devices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  device_code VARCHAR(50) NOT NULL UNIQUE,
  site_id INT UNSIGNED NOT NULL,
  growing_unit_id INT UNSIGNED NULL,
  device_type VARCHAR(30) NOT NULL DEFAULT 'esp32',
  api_key_hash VARCHAR(255) NULL,
  firmware_version VARCHAR(30) NULL,
  ip_address VARCHAR(45) NULL,
  status ENUM('registered','online','offline','disabled') NOT NULL DEFAULT 'registered',
  last_seen_at DATETIME NULL,
  installed_at DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id)
) ENGINE=InnoDB;

CREATE TABLE sensors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id INT UNSIGNED NOT NULL,
  growing_unit_id INT UNSIGNED NULL,
  sensor_type ENUM('temperature','humidity','soil_moisture','ec','light','water_level','ph','other') NOT NULL,
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NULL,
  model VARCHAR(100) NULL,
  calibration_offset DOUBLE NOT NULL DEFAULT 0,
  calibration_scale DOUBLE NOT NULL DEFAULT 1,
  min_valid DOUBLE NULL,
  max_valid DOUBLE NULL,
  status ENUM('active','faulty','disabled') NOT NULL DEFAULT 'active',
  sensor_value DOUBLE NULL,
  last_sensor_reading_at DATETIME NULL,
  FOREIGN KEY (device_id) REFERENCES iot_devices(id),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id)
) ENGINE=InnoDB;

CREATE TABLE sensor_readings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT UNSIGNED NOT NULL,
  value DOUBLE NOT NULL,
  recorded_at DATETIME(3) NOT NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_sensor_time (sensor_id, recorded_at),
  FOREIGN KEY (sensor_id) REFERENCES sensors(id)
) ENGINE=InnoDB;

CREATE TABLE actuators (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id INT UNSIGNED NOT NULL,
  growing_unit_id INT UNSIGNED NULL,
  actuator_type ENUM('irrigation','misting','fan','light','other') NOT NULL,
  name VARCHAR(100) NOT NULL,
  control_mode ENUM('manual','auto') NOT NULL DEFAULT 'manual',
  current_state ENUM('on','off','unknown') NOT NULL DEFAULT 'unknown',
  max_runtime_seconds INT UNSIGNED NOT NULL DEFAULT 1800,
  status ENUM('active','faulty','disabled') NOT NULL DEFAULT 'active',
  last_state_at DATETIME NULL,
  FOREIGN KEY (device_id) REFERENCES iot_devices(id),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id)
) ENGINE=InnoDB;

CREATE TABLE actuator_commands (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actuator_id INT UNSIGNED NOT NULL,
  command ENUM('on','off') NOT NULL,
  source ENUM('manual','auto','schedule') NOT NULL DEFAULT 'manual',
  requested_by INT UNSIGNED NULL,
  duration_seconds INT UNSIGNED NULL,
  status ENUM('pending','sent','acknowledged','failed','expired','cancelled') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  acknowledged_at DATETIME NULL,
  expires_at DATETIME NULL,
  error_message VARCHAR(255) NULL,
  KEY idx_cmd_pending (actuator_id, status),
  FOREIGN KEY (actuator_id) REFERENCES actuators(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE actuator_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actuator_id INT UNSIGNED NOT NULL,
  command_id BIGINT UNSIGNED NULL,
  state ENUM('on','off') NOT NULL,
  trigger_source ENUM('manual','auto','schedule','device') NOT NULL DEFAULT 'manual',
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  duration_seconds INT UNSIGNED NULL,
  KEY idx_evt_time (actuator_id, started_at),
  FOREIGN KEY (actuator_id) REFERENCES actuators(id),
  FOREIGN KEY (command_id) REFERENCES actuator_commands(id)
) ENGINE=InnoDB;

CREATE TABLE automation_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  growing_unit_id INT UNSIGNED NOT NULL,
  actuator_id INT UNSIGNED NOT NULL,
  sensor_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  comparison ENUM('lt','gt','lte','gte') NOT NULL DEFAULT 'lt',
  start_threshold DOUBLE NOT NULL,
  stop_threshold DOUBLE NOT NULL,
  max_runtime_seconds INT UNSIGNED NOT NULL DEFAULT 900,
  min_interval_seconds INT UNSIGNED NOT NULL DEFAULT 1800,
  is_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id),
  FOREIGN KEY (actuator_id) REFERENCES actuators(id),
  FOREIGN KEY (sensor_id) REFERENCES sensors(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE alert_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT UNSIGNED NULL,
  device_id INT UNSIGNED NULL,
  rule_type ENUM('above','below','offline','sensor_failure','actuator_failure') NOT NULL,
  threshold DOUBLE NULL,
  severity ENUM('info','warning','critical') NOT NULL DEFAULT 'warning',
  cooldown_minutes INT UNSIGNED NOT NULL DEFAULT 30,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  FOREIGN KEY (sensor_id) REFERENCES sensors(id),
  FOREIGN KEY (device_id) REFERENCES iot_devices(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE alerts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alert_rule_id INT UNSIGNED NULL,
  device_id INT UNSIGNED NULL,
  sensor_id INT UNSIGNED NULL,
  growing_unit_id INT UNSIGNED NULL,
  severity ENUM('info','warning','critical') NOT NULL,
  message VARCHAR(255) NOT NULL,
  status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  triggered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by INT UNSIGNED NULL,
  acknowledged_at DATETIME NULL,
  resolved_at DATETIME NULL,
  KEY idx_alert_status (status, triggered_at),
  FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id),
  FOREIGN KEY (device_id) REFERENCES iot_devices(id),
  FOREIGN KEY (sensor_id) REFERENCES sensors(id),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id),
  FOREIGN KEY (acknowledged_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ============ PROGRAMS / TRAINING ============
CREATE TABLE programs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  code VARCHAR(50) NULL UNIQUE,
  name_ne VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NULL,
  description TEXT NULL,
  fiscal_year VARCHAR(9) NULL,
  target_beneficiaries TEXT NULL,
  eligibility TEXT NULL,
  budget DECIMAL(15,2) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('draft','open','ongoing','completed','cancelled') NOT NULL DEFAULT 'draft',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE program_beneficiaries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  program_id INT UNSIGNED NOT NULL,
  farmer_id INT UNSIGNED NOT NULL,
  status ENUM('applied','approved','rejected','supported','completed') NOT NULL DEFAULT 'applied',
  support_amount DECIMAL(15,2) NULL,
  remarks VARCHAR(255) NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_program_farmer (program_id, farmer_id),
  FOREIGN KEY (program_id) REFERENCES programs(id),
  FOREIGN KEY (farmer_id) REFERENCES farmers(id)
) ENGINE=InnoDB;

CREATE TABLE trainings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  program_id INT UNSIGNED NULL,
  organization_id INT UNSIGNED NOT NULL,
  title_ne VARCHAR(255) NOT NULL,
  title_en VARCHAR(255) NULL,
  venue VARCHAR(255) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('planned','ongoing','completed','cancelled') NOT NULL DEFAULT 'planned',
  FOREIGN KEY (program_id) REFERENCES programs(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB;

CREATE TABLE training_participants (
  training_id INT UNSIGNED NOT NULL,
  farmer_id INT UNSIGNED NOT NULL,
  attendance ENUM('registered','attended','absent') NOT NULL DEFAULT 'registered',
  PRIMARY KEY (training_id, farmer_id),
  FOREIGN KEY (training_id) REFERENCES trainings(id),
  FOREIGN KEY (farmer_id) REFERENCES farmers(id)
) ENGINE=InnoDB;

-- ============ CONTENT ============
CREATE TABLE notices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  category ENUM('notice','news','press_release','program','training') NOT NULL DEFAULT 'notice',
  title_ne VARCHAR(300) NOT NULL,
  title_en VARCHAR(300) NULL,
  body TEXT NULL,
  file_path VARCHAR(500) NULL,
  published_at DATETIME NULL,
  deadline_date DATE NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_notice_pub (is_published, published_at),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  category ENUM('act','directive','procedure','criteria','book','form','report','progress','bulletin','other') NOT NULL DEFAULT 'other',
  title_ne VARCHAR(300) NOT NULL,
  title_en VARCHAR(300) NULL,
  file_path VARCHAR(500) NOT NULL,
  fiscal_year VARCHAR(9) NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  uploaded_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE courses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title_ne VARCHAR(255) NOT NULL,
  title_en VARCHAR(255) NULL,
  description TEXT NULL,
  level ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE course_lessons (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  title_ne VARCHAR(255) NOT NULL,
  title_en VARCHAR(255) NULL,
  content_type ENUM('video','text','pdf','link') NOT NULL DEFAULT 'text',
  content_url VARCHAR(500) NULL,
  body TEXT NULL,
  duration_minutes SMALLINT UNSIGNED NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE course_enrollments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  status ENUM('enrolled','completed','dropped') NOT NULL DEFAULT 'enrolled',
  progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enroll (course_id, user_id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE learning_resources (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title_ne VARCHAR(255) NOT NULL,
  title_en VARCHAR(255) NULL,
  resource_type ENUM('video','manual','faq','material','other') NOT NULL DEFAULT 'material',
  url VARCHAR(500) NULL,
  file_path VARCHAR(500) NULL,
  description TEXT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE knowledge_articles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_id INT UNSIGNED NULL,
  topic ENUM('variety','climate','soil','irrigation','fertilization','pest','disease','production','harvesting','other') NOT NULL DEFAULT 'other',
  title_ne VARCHAR(255) NOT NULL,
  title_en VARCHAR(255) NULL,
  body MEDIUMTEXT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (crop_id) REFERENCES crops(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ============ NOTIFICATIONS / AUDIT ============
CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  category ENUM('government','smart_farming') NOT NULL,
  title VARCHAR(200) NOT NULL,
  message VARCHAR(500) NULL,
  link VARCHAR(255) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_user (user_id, is_read),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id VARCHAR(50) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_user (user_id, created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
