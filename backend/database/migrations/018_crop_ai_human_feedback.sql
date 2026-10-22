CREATE TABLE IF NOT EXISTS crop_ai_feedback (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id CHAR(36) NOT NULL,
  crop VARCHAR(80) NOT NULL,
  feedback ENUM('helpful', 'not_helpful', 'needs_expert') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_crop_ai_feedback_case (case_id),
  KEY idx_crop_ai_feedback_quality (crop, feedback, created_at)
) ENGINE=InnoDB;
