SET NAMES utf8mb4;

ALTER TABLE farms
  ADD COLUMN gps_accuracy_m DECIMAL(8,2) NULL,
  ADD COLUMN location_source ENUM('gps','google_map','manual') NULL;

ALTER TABLE crop_production
  MODIFY COLUMN loss_cause ENUM('none','disease','pest','drought','flood','hail','landslide','soil_erosion','frost','storm','wild_animals','post_harvest','other') NULL;

CREATE TABLE district_planning_baselines (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  district_id SMALLINT UNSIGNED NOT NULL,
  indicator_code VARCHAR(60) NOT NULL,
  reference_period VARCHAR(15) NOT NULL,
  indicator_value DECIMAL(16,3) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  source_title VARCHAR(255) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  methodology_note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_planning_baseline (district_id, indicator_code, reference_period),
  FOREIGN KEY (district_id) REFERENCES districts(id)
) ENGINE=InnoDB;

INSERT INTO district_planning_baselines
  (district_id, indicator_code, reference_period, indicator_value, unit, source_title, source_url, methodology_note)
SELECT d.id, b.indicator_code, b.reference_period, b.indicator_value, b.unit, b.source_title, b.source_url, b.methodology_note
  FROM districts d
  JOIN (
    SELECT 'population_total' AS indicator_code, '2021' AS reference_period, 600051 AS indicator_value, 'people' AS unit,
           'National Population and Housing Census 2021 — Kaski key indicators' AS source_title,
           'https://sokaski.nsonepal.gov.np/content/2724/2724-key-indicators/' AS source_url,
           'Historical district census total; not a current population estimate.' AS methodology_note
    UNION ALL SELECT 'population_female', '2021', 307260, 'people',
           'National Population and Housing Census 2021 — Kaski key indicators',
           'https://sokaski.nsonepal.gov.np/content/2724/2724-key-indicators/',
           'Historical district census total; use only for aggregate planning context.'
    UNION ALL SELECT 'population_male', '2021', 292791, 'people',
           'National Population and Housing Census 2021 — Kaski key indicators',
           'https://sokaski.nsonepal.gov.np/content/2724/2724-key-indicators/',
           'Historical district census total; use only for aggregate planning context.'
    UNION ALL SELECT 'households_total', '2021', 160651, 'households',
           'National Population and Housing Census 2021 — Kaski key indicators',
           'https://sokaski.nsonepal.gov.np/content/2724/2724-key-indicators/',
           'Historical district census total.'
    UNION ALL SELECT 'population_density', '2021', 298, 'people_per_sq_km',
           'National Population and Housing Census 2021 — Kaski key indicators',
           'https://sokaski.nsonepal.gov.np/content/2724/2724-key-indicators/',
           'Published district density; rounded in the source.'
    UNION ALL SELECT 'population_growth_pct', '2011-2021', 1.90, 'percent_per_year',
           'National Population and Housing Census 2021 — Kaski key indicators',
           'https://sokaski.nsonepal.gov.np/content/2724/2724-key-indicators/',
           'Average annual growth rate reported for the 2011-2021 intercensal period.'
    UNION ALL SELECT 'agricultural_holdings_total', '2021/22', 53228, 'holdings',
           'National Sample Census of Agriculture 2021/22 — District Summary Report',
           'https://www.agricensusnepal.gov.np/upload_file/files/post/1731650149_1221316497_Agriculture%20Census%202021_District%20Summary%20Report_by%20Province.pdf',
           'Official Kaski district summary total. The microdata catalog is a sample and must not be read as district totals.'
  ) AS b ON 1 = 1
 WHERE d.name_en = 'Kaski'
   AND NOT EXISTS (
     SELECT 1 FROM district_planning_baselines old
      WHERE old.district_id = d.id AND old.indicator_code = b.indicator_code AND old.reference_period = b.reference_period
   );

CREATE TABLE planning_recommendation_feedback (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NULL,
  local_level_id INT UNSIGNED NULL,
  recommendation_code VARCHAR(60) NOT NULL,
  feedback ENUM('useful','not_useful','needs_review') NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_planning_feedback_org (organization_id, created_at),
  KEY idx_planning_feedback_rec (recommendation_code, local_level_id, created_at),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (local_level_id) REFERENCES local_levels(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;
