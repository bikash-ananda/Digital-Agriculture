CREATE TABLE ai_knowledge_embeddings (
  source_type ENUM('article','learning_resource') NOT NULL,
  source_id INT UNSIGNED NOT NULL,
  model VARCHAR(120) NOT NULL,
  content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  embedding JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (source_type, source_id, model),
  KEY idx_ai_knowledge_vectors_model (model)
) ENGINE=InnoDB;
