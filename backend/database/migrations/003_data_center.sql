SET NAMES utf8mb4;

ALTER TABLE farmers
  ADD COLUMN national_farmer_id VARCHAR(30) NULL UNIQUE,
  ADD COLUMN farmer_type ENUM('individual','group','cooperative','company','private_farm') NOT NULL DEFAULT 'individual',
  ADD COLUMN farmer_category ENUM('subsistence','small','medium','large') NULL,
  ADD COLUMN member_count INT UNSIGNED NULL,
  ADD COLUMN household_members TINYINT UNSIGNED NULL,
  ADD COLUMN agri_workers TINYINT UNSIGNED NULL,
  ADD COLUMN education_level ENUM('no_formal','basic','secondary','higher_secondary','bachelor','master_plus') NULL,
  ADD COLUMN farming_experience_years TINYINT UNSIGNED NULL,
  ADD COLUMN main_occupation ENUM('agriculture','livestock','agri_business','service','foreign_employment','business','other') NULL,
  ADD COLUMN income_band ENUM('lt_100k','100k_300k','300k_600k','600k_1m','gt_1m') NULL,
  ADD COLUMN uses_smartphone TINYINT(1) NULL,
  ADD COLUMN consent_data_use TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN consent_research TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN consent_recorded_at DATETIME NULL,
  ADD COLUMN consent_recorded_by INT UNSIGNED NULL,
  ADD COLUMN collection_method ENUM('field_survey','office','import','self_registered') NOT NULL DEFAULT 'office',
  ADD COLUMN verification_status ENUM('draft','submitted','verified','rejected') NOT NULL DEFAULT 'draft',
  ADD COLUMN verified_at DATETIME NULL,
  ADD COLUMN verified_by INT UNSIGNED NULL,
  ADD COLUMN verification_note VARCHAR(255) NULL,
  ADD CONSTRAINT fk_farmer_consent_by FOREIGN KEY (consent_recorded_by) REFERENCES users(id),
  ADD CONSTRAINT fk_farmer_verified_by FOREIGN KEY (verified_by) REFERENCES users(id);

ALTER TABLE farms
  ADD COLUMN altitude_m SMALLINT NULL,
  ADD COLUMN soil_type ENUM('sandy','loam','clay','silty','gravelly','other') NULL,
  ADD COLUMN water_source ENUM('rain_only','spring_water','river_canal','tube_well','tank','municipal','lake_pond','other') NULL,
  ADD COLUMN irrigated_area_sqm DECIMAL(12,2) NULL,
  ADD COLUMN land_use ENUM('cultivated','orchard','fallow','pasture','mixed') NOT NULL DEFAULT 'cultivated',
  ADD COLUMN terrace_farming TINYINT(1) NULL,
  ADD COLUMN road_access ENUM('none','trail','seasonal','all_weather') NULL,
  ADD COLUMN distance_to_market_km DECIMAL(5,1) NULL,
  ADD COLUMN organic_certified TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE iot_devices
  ADD COLUMN ownership ENUM('office','farmer','loan','donor') NOT NULL DEFAULT 'office',
  ADD COLUMN farm_id INT UNSIGNED NULL,
  ADD CONSTRAINT fk_device_farm FOREIGN KEY (farm_id) REFERENCES farms(id);

CREATE TABLE crop_production (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farm_id INT UNSIGNED NOT NULL,
  crop_id INT UNSIGNED NOT NULL,
  growing_unit_id INT UNSIGNED NULL,
  fiscal_year VARCHAR(9) NOT NULL,
  season ENUM('spring','summer','winter','perennial','year_round') NOT NULL DEFAULT 'summer',
  production_system ENUM('open_field','greenhouse','tunnel','nursery','orchard','terrace','hydroponic','other') NOT NULL DEFAULT 'open_field',
  variety VARCHAR(100) NULL,
  seed_source ENUM('own_saved','local_market','agro_vet','government','cooperative','imported','other') NULL,
  area_sqm DECIMAL(12,2) NULL,
  plant_count INT UNSIGNED NULL,
  bearing_plants INT UNSIGNED NULL,
  planting_date DATE NULL,
  harvest_start DATE NULL,
  harvest_end DATE NULL,
  production_kg DECIMAL(12,2) NULL,
  loss_kg DECIMAL(12,2) NULL,
  loss_cause ENUM('none','disease','pest','drought','flood','hail','wild_animals','post_harvest','other') NULL,
  sold_kg DECIMAL(12,2) NULL,
  avg_price_npr_per_kg DECIMAL(10,2) NULL,
  market_channel ENUM('local_market','wholesaler','cooperative','direct_consumer','export','processing','self_consumed') NULL,
  organic_status ENUM('conventional','organic','transitioning','ipm') NOT NULL DEFAULT 'conventional',
  status ENUM('planned','growing','harvested','failed') NOT NULL DEFAULT 'harvested',
  notes VARCHAR(500) NULL,
  recorded_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_prod_fy (fiscal_year, crop_id),
  KEY idx_prod_farm (farm_id),
  FOREIGN KEY (farm_id) REFERENCES farms(id),
  FOREIGN KEY (crop_id) REFERENCES crops(id),
  FOREIGN KEY (growing_unit_id) REFERENCES growing_units(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE livestock_holdings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farm_id INT UNSIGNED NOT NULL,
  animal_type ENUM('cattle','buffalo','goat','sheep','pig','poultry_layer','poultry_broiler','duck','fish_pond','beehive','other') NOT NULL,
  breed VARCHAR(100) NULL,
  head_count INT UNSIGNED NOT NULL DEFAULT 0,
  pond_area_sqm DECIMAL(10,2) NULL,
  purpose ENUM('milk','meat','eggs','fish','honey','manure','draught','mixed') NULL,
  annual_output_qty DECIMAL(12,2) NULL,
  output_unit VARCHAR(20) NULL,
  fiscal_year VARCHAR(9) NOT NULL,
  recorded_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_live_fy (fiscal_year, animal_type),
  FOREIGN KEY (farm_id) REFERENCES farms(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE farm_inputs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farm_id INT UNSIGNED NOT NULL,
  crop_id INT UNSIGNED NULL,
  fiscal_year VARCHAR(9) NOT NULL,
  input_type ENUM('chemical_fertilizer','organic_manure','compost','pesticide','biopesticide','herbicide','seed','other') NOT NULL,
  product_name VARCHAR(150) NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit ENUM('kg','g','l','ml','piece','packet') NOT NULL DEFAULT 'kg',
  cost_npr DECIMAL(12,2) NULL,
  source ENUM('agro_vet','cooperative','government','own','other') NULL,
  applied_on DATE NULL,
  recorded_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_input_fy (fiscal_year, input_type),
  FOREIGN KEY (farm_id) REFERENCES farms(id),
  FOREIGN KEY (crop_id) REFERENCES crops(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE farm_assets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farm_id INT UNSIGNED NOT NULL,
  asset_type ENUM('plastic_tunnel','greenhouse','drip_irrigation','sprinkler','water_tank','pond','power_tiller','tractor','sprayer','cold_storage','nursery','collection_center','solar_pump','other') NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  area_sqm DECIMAL(10,2) NULL,
  year_installed SMALLINT UNSIGNED NULL,
  condition_status ENUM('good','fair','poor') NULL,
  support_source ENUM('own','government','ngo','cooperative','loan','other') NULL,
  notes VARCHAR(255) NULL,
  recorded_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE data_exports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  dataset VARCHAR(50) NOT NULL,
  privacy_level ENUM('aggregate','anonymized','identified') NOT NULL,
  filters JSON NULL,
  row_count INT UNSIGNED NOT NULL DEFAULT 0,
  purpose VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_export_user (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
