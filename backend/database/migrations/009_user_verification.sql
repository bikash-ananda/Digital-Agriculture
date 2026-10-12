SET NAMES utf8mb4;

-- Existing rows without an address get a unique placeholder and must update it before access.
UPDATE users
   SET email = CONCAT('legacy-', id, '@unverified.invalid')
 WHERE email IS NULL OR TRIM(email) = '';

ALTER TABLE users
  MODIFY COLUMN username VARCHAR(150) NOT NULL,
  MODIFY COLUMN email VARCHAR(150) NOT NULL,
  ADD COLUMN phone_verified_at DATETIME NULL AFTER email_verified_at,
  ADD COLUMN approved_at DATETIME NULL,
  ADD COLUMN approved_by INT UNSIGNED NULL,
  ADD KEY idx_users_approved_by (approved_by),
  ADD CONSTRAINT fk_users_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- All existing accounts must complete the new contact checks and admin approval.
UPDATE users
   SET status = 'pending'
 WHERE status = 'active'
   AND (email_verified_at IS NULL OR phone_verified_at IS NULL);

CREATE TABLE account_otps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  purpose ENUM('registration','password_reset') NOT NULL,
  delivery_channel ENUM('email','phone') NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_account_otp_lookup (user_id, purpose, delivery_channel, consumed_at, expires_at),
  KEY idx_account_otp_created (user_id, purpose, created_at),
  CONSTRAINT fk_account_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;