#pragma once
#include <Arduino.h>

#define FIRMWARE_VERSION "gh-1.0.0"
#define DEVICE_CODE "ESP32-01"

// Local testing: http://<your PC IPv4>:5000   Production: https://your-domain (needs ROOT_CA in secrets.h)
#define API_BASE "http://192.168.1.10:5000"
#define ALLOW_INSECURE_TLS 0   // 1 = skip certificate checks. For short tests only, never in the field.

#define REPORT_INTERVAL_MS 30000UL
#define POLL_INTERVAL_MS 10000UL
#define TELEMETRY_INTERVAL_MS 300000UL
#define CONFIG_REFRESH_MS 600000UL
#define DEBUG_RAW 1            // print raw ADC / distance values for calibration

// ---- sensors (1 = fitted) ----
#define I2C_SDA 21
#define I2C_SCL 22
#define USE_SHT31 1            // air temperature + humidity
#define SHT31_ADDR 0x44
#define USE_DHT 0              // alternative: DHT22 on DHT_PIN
#define DHT_PIN 13
#define DHT_TYPE DHT22
#define USE_BH1750 1           // light (lux)
#define USE_DS18B20 1          // soil temperature
#define ONEWIRE_PIN 4

#define SOIL_COUNT 2           // capacitive probes on ADC1 pins
static const uint8_t SOIL_PINS[SOIL_COUNT] = {34, 35};
#define SOIL_RAW_DRY 3200      // reading in dry air  (calibrate)
#define SOIL_RAW_WET 1400      // reading in water    (calibrate)

#define USE_EC 1
#define EC_PIN 36
#define EC_K_FACTOR 1.0f       // rough; use the dashboard calibration for real accuracy

#define USE_WATER_LEVEL 1      // HC-SR04 above the tank. ECHO is 5 V: use a voltage divider!
#define TRIG_PIN 19
#define ECHO_PIN 18
#define TANK_EMPTY_CM 80.0f    // distance when the tank is empty
#define TANK_FULL_CM 10.0f     // distance when the tank is full

// ---- relays ----
#define RELAY_ACTIVE_LOW 1
static const uint8_t RELAY_PINS[] = {25, 26, 27, 23};
#define RELAY_COUNT (sizeof(RELAY_PINS) / sizeof(RELAY_PINS[0]))

// ---- local safety (works even if the server is down) ----
#define LOCAL_MAX_RUN_S 3600UL         // hard cap per run
#define PUMP_MIN_WATER_PCT 10.0f       // dry-run protection for pumps
#define OFFLINE_FAILSAFE_S 900UL       // pumps switch off after this long without server contact