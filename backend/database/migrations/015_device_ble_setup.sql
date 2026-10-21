ALTER TABLE device_wifi_commands
  ADD COLUMN command_type ENUM('wifi','enable_ble') NOT NULL DEFAULT 'wifi' AFTER device_id;
