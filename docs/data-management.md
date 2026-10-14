# Greenhouse data and backup policy

## ESP32 field connection

The greenhouse firmware sends calibrated sensor readings to the server and polls for relay commands. The ESP32 makes outbound HTTPS requests, so its Wi-Fi router does not need to be on the same LAN as the server and does not need an inbound port opened. Keep the router password and the device API key in the local, ignored `iot/esp32/greenhouse/include/secrets.h` file. Use the production HTTPS domain and server root certificate for field deployment.

The current firmware sends air temperature and relative humidity from SHT31, illuminance from BH1750/GY-30, soil moisture from capacitive probes, and other configured channels. It polls the server for actuator configuration and commands every 10 seconds. Configure the two fitted relays as active actuators with the matching relay channels in the site/device setup; the board build supports up to four relay channels.

## Research rollups and exports

- Sensor hourly rows keep sample count, mean, minimum, maximum, and population standard deviation.
- Daily greenhouse metrics use sample-count-weighted hourly means. Data coverage compares received samples with the configured upload interval (`DEVICE_UPLOAD_SECONDS`, default 30 seconds).
- DLI is an estimate based on an approximate sunlight lux-to-PPFD conversion; a quantum PAR sensor is needed for stronger light measurements.
- Daily research views and CSV exports accept up to 730 days. Hourly readings are available for up to 62 days.
- The Research Lab Print view prints the currently selected research tab and date range.

The application currently retains raw sensor readings and rollups in MySQL. It does not yet automatically delete older readings. The 30-day raw / 62-day hourly / 730-day daily retention schedule needs approval before an automated cleanup job is enabled, because cleanup permanently removes database rows.

## Google Weather API

Set `GOOGLE_WEATHER_API_KEY` in the backend environment after enabling the Weather API and billing in Google Cloud. The key stays on the server. The live console requests current conditions and the next 24 hours for the greenhouse site's latitude/longitude. Results are cached in backend memory for 55 minutes, are not written to MySQL or included in exports, and appear with Google's required attribution.

The current production compose file does not forward `GOOGLE_WEATHER_API_KEY` to the API container. The deployment team must add it to its protected environment wiring to enable the optional weather card; sensor telemetry and greenhouse charts do not depend on it.

Google Weather API cache limits do not allow these current/hourly values to be kept as a two-year research archive. For long-term outside temperature, humidity, pressure, rainfall, and wind analysis, add a physical outdoor weather station or select a separate data source whose license allows that retention.

## Compressed backup size limit

Run `bash scripts/backup-db.sh` with `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and optionally `BACKUP_DIR` exported by the server's secret manager or protected service environment. The script creates a compressed SQL backup and refuses to save it if the total of script-managed backups would exceed 5,000,000,000 bytes (5 GB; `MAX_BACKUP_BYTES` can override the byte limit). It never deletes an existing backup. A scheduler can run it daily; credentials should not be added to this repository or printed in a shell command.

The storage card in Research Lab reports the current MySQL footprint. It is separate from the compressed-backup limit.
