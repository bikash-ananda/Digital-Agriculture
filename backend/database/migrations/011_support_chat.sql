-- Anonymous login-page support conversations and messages.
CREATE TABLE support_conversations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  access_token_hash CHAR(64) NOT NULL,
  short_code CHAR(8) NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  whatsapp_notification_sid VARCHAR(34) NULL,
  last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_support_conversation_token (access_token_hash),
  UNIQUE KEY uq_support_conversation_code (short_code),
  UNIQUE KEY uq_support_conversation_whatsapp_sid (whatsapp_notification_sid),
  KEY idx_support_conversation_status (status, last_message_at)
) ENGINE=InnoDB;

CREATE TABLE support_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  sender ENUM('visitor','developer') NOT NULL,
  body VARCHAR(2000) NOT NULL,
  provider_message_sid VARCHAR(34) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_support_message_thread (conversation_id, id),
  UNIQUE KEY uq_support_message_provider_sid (provider_message_sid),
  CONSTRAINT fk_support_message_conversation FOREIGN KEY (conversation_id)
    REFERENCES support_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB;
