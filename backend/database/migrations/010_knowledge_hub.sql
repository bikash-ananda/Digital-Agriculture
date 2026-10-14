-- Research publishing, public comments and Kaski technical-officer discussions.
CREATE TABLE research_papers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NULL,
  title VARCHAR(300) NOT NULL,
  author_names VARCHAR(500) NOT NULL,
  affiliation VARCHAR(300) NULL,
  abstract TEXT NOT NULL,
  keywords VARCHAR(500) NULL,
  topic VARCHAR(100) NULL,
  publication_year SMALLINT UNSIGNED NULL,
  doi VARCHAR(150) NULL,
  full_text_url VARCHAR(500) NULL,
  status ENUM('submitted','published','rejected') NOT NULL DEFAULT 'submitted',
  submitted_by INT UNSIGNED NULL,
  reviewed_by INT UNSIGNED NULL,
  review_note TEXT NULL,
  reviewed_at DATETIME NULL,
  published_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_research_papers_public (status, published_at),
  KEY idx_research_papers_org (organization_id, status),
  CONSTRAINT fk_research_paper_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
  CONSTRAINT fk_research_paper_submitter FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_research_paper_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE research_paper_comments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paper_id INT UNSIGNED NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_paper_comments_moderation (status, created_at),
  KEY idx_paper_comments_paper (paper_id, status, created_at),
  CONSTRAINT fk_paper_comment_paper FOREIGN KEY (paper_id) REFERENCES research_papers(id) ON DELETE CASCADE,
  CONSTRAINT fk_paper_comment_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE officer_discussions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  topic VARCHAR(100) NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_officer_discussions_org (organization_id, status, updated_at),
  CONSTRAINT fk_officer_discussion_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_officer_discussion_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE officer_discussion_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  discussion_id INT UNSIGNED NOT NULL,
  sender_id INT UNSIGNED NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_officer_messages_thread (discussion_id, created_at),
  CONSTRAINT fk_officer_message_thread FOREIGN KEY (discussion_id) REFERENCES officer_discussions(id) ON DELETE CASCADE,
  CONSTRAINT fk_officer_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
