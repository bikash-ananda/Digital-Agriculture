CREATE TABLE crop_tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cycle_id INT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  notes TEXT NULL,
  due_on DATE NULL,
  priority ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
  status ENUM('open','done','skipped') NOT NULL DEFAULT 'open',
  created_by INT UNSIGNED NULL,
  completed_by INT UNSIGNED NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_crop_tasks_cycle_status_due (cycle_id, status, due_on),
  CONSTRAINT fk_crop_tasks_cycle FOREIGN KEY (cycle_id) REFERENCES crop_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_crop_tasks_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_crop_tasks_completer FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
