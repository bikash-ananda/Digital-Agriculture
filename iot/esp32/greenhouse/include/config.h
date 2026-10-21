#pragma once
#include <Arduino.h>

#define FIRMWARE_VERSION "gh-1.0.6"
#define DEVICE_CODE "ESP32-01"

// Production API endpoint and its trusted HTTPS root.
#define API_BASE "https://kaskikotagro.com.np"
#define ROOT_CA \
  "-----BEGIN CERTIFICATE-----\n" \
  "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\n" \
  "-----END CERTIFICATE-----\n"
#define ALLOW_INSECURE_TLS 0   // 1 = skip certificate checks. For short tests only, never in the field.

#define REPORT_INTERVAL_MS 30000UL
#define POLL_INTERVAL_MS 10000UL
#define TELEMETRY_INTERVAL_MS 300000UL
#define CONFIG_REFRESH_MS 60000UL
#define DEBUG_RAW 1            // print raw ADC / distance values for calibration

// ---- sensors (1 = fitted) ----
#define I2C_SDA 21
#define I2C_SCL 22
#define I2C_DIAGNOSTICS 0     // enable when an I2C sensor is installed for diagnosis
#define USE_SHT31 0            // not installed; AM2120 is used on the single-wire input below
#define SHT31_ADDR 0x44
#define USE_DHT 1              // AM2302 / DHT22 single-bus temperature + humidity
#define DHT_PIN 4
#define DHT_TYPE DHT22
#define USE_BH1750 0           // disabled until the light sensor is replaced
#define USE_DS18B20 0          // no separate DS18B20 pin was provided; GPIO4 is used by AM2120
#define ONEWIRE_PIN 4           // unused while USE_DS18B20 is 0

#define SOIL_COUNT 1           // one capacitive probe on ADC1
static const uint8_t SOIL_PINS[SOIL_COUNT] = {34};
#define SOIL_RAW_DRY 3200      // measure and set using this installed probe/soil
#define SOIL_RAW_WET 1400      // measure and set using this installed probe/soil

// No EC sensor is connected on this controller. Keeping it disabled prevents
// a floating GPIO36 input from being sent as a false measurement.
#define USE_EC 0
#define EC_PIN 36
#define EC_K_FACTOR 1.0f       // rough; use the dashboard calibration for real accuracy

// No water-level sensor is connected on this controller.
#define USE_WATER_LEVEL 0      // HC-SR04 above the tank. ECHO is 5 V: use a voltage divider!
#define TRIG_PIN 19
#define ECHO_PIN 18
#define TANK_EMPTY_CM 80.0f    // distance when the tank is empty
#define TANK_FULL_CM 10.0f     // distance when the tank is full

// ---- relays ----
#define RELAY_ACTIVE_LOW 1
static const uint8_t RELAY_PINS[] = {25, 26}; // IN1 irrigation pump, IN2 sprinkler pump
#define RELAY_COUNT (sizeof(RELAY_PINS) / sizeof(RELAY_PINS[0]))

// ---- local safety (works even if the server is down) ----
#define LOCAL_MAX_RUN_S 3600UL         // hard cap per run
#define PUMP_MIN_WATER_PCT 10.0f       // dry-run protection for pumps
#define OFFLINE_FAILSAFE_S 900UL       // pumps switch off after this long without server contact
