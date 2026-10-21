#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <Preferences.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLESecurity.h>
#include <esp_system.h>
#include <esp_task_wdt.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include "config.h"
#include "secrets.h"

#if USE_SHT31
#include <Adafruit_SHT31.h>
static Adafruit_SHT31 sht31;
static bool shtOk = false;
#endif
#if USE_DHT
#include <DHT.h>
static DHT dht(DHT_PIN, DHT_TYPE);
#endif
#if USE_BH1750
#include <BH1750.h>
static BH1750 lightMeter;
static bool luxOk = false;
static uint8_t lightSensorAddress = 0;
#endif
#if USE_DS18B20
#include <OneWire.h>
#include <DallasTemperature.h>
static OneWire oneWire(ONEWIRE_PIN);
static DallasTemperature ds(&oneWire);
#endif

struct Act { int id; uint8_t channel; char type[16]; uint32_t maxRun; };
static WiFiMulti wifiMulti;
static uint8_t configuredWifiNetworks = 0;
static Act acts[8];
static uint8_t actCount = 0;

// A small, local GATT service used only while provisioning Wi-Fi.
static constexpr char BLE_SERVICE_UUID[] = "f14a0001-4c89-4f5f-a4de-6b1e0f4a0001";
static constexpr char BLE_RX_UUID[]      = "f14a0002-4c89-4f5f-a4de-6b1e0f4a0002";
static constexpr char BLE_TX_UUID[]      = "f14a0003-4c89-4f5f-a4de-6b1e0f4a0003";
struct BleWriteFrame { uint16_t length; char data[384]; };
static QueueHandle_t bleWriteQueue = nullptr;
static BLECharacteristic* bleTx = nullptr;
static BLEServer* bleServer = nullptr;
static BLESecurity* bleSecurity = nullptr;
static volatile bool bleClientConnected = false;
static volatile bool bleNeedsAdvertise = false;
static bool bleInitialized = false;
static bool blePortalActive = false;
static unsigned long blePortalExpires = 0;
static unsigned long bleRestartAt = 0;
static unsigned long wifiOfflineSince = 0;
static uint32_t bleRequestId = 0;
static uint32_t blePairingPin = 0;

static bool relayState[RELAY_COUNT];
static unsigned long relayOffAt[RELAY_COUNT];
static bool statePending[RELAY_COUNT];

static unsigned long tReport, tPoll, tTelemetry, tConfig, tConfigTry, tWifi, tState, lastServerOk = 0;
static uint32_t sensorErrors = 0, wifiReconnects = 0, httpFailures = 0;
static float lastWaterPct = NAN;
static bool configLoaded = false;

static inline uint8_t offLevel() { return RELAY_ACTIVE_LOW ? HIGH : LOW; }
static inline uint8_t onLevel() { return RELAY_ACTIVE_LOW ? LOW : HIGH; }

static bool isPump(const char* t) {
  return !strcmp(t, "irrigation") || !strcmp(t, "misting") || !strcmp(t, "pump") || !strcmp(t, "fertigation");
}

static void relaySet(uint8_t ch, bool on) {
  if (ch >= RELAY_COUNT) return;
  digitalWrite(RELAY_PINS[ch], on ? onLevel() : offLevel());
  if (relayState[ch] != on) statePending[ch] = true;
  relayState[ch] = on;
  if (!on) relayOffAt[ch] = 0;
}

// ---------- HTTP ----------
static bool apiCall(const char* method, const String& path, const String& body, String& out, int& code) {
  out = "";
  code = -1;
  if (WiFi.status() != WL_CONNECTED) return false;
  String url = String(API_BASE) + path;
  HTTPClient client;
  WiFiClientSecure secure;
  WiFiClient plain;
  bool began;
  if (url.startsWith("https://")) {
#ifdef ROOT_CA
    secure.setCACert(ROOT_CA);
#elif ALLOW_INSECURE_TLS
    secure.setInsecure();
#else
    Serial.println(F("TLS blocked: no ROOT_CA and ALLOW_INSECURE_TLS is 0"));
    return false;
#endif
    began = client.begin(secure, url);
  } else {
    began = client.begin(plain, url);
  }
  if (!began) return false;
  client.setTimeout(8000);
  client.addHeader("Content-Type", "application/json");
  client.addHeader("X-Device-Code", DEVICE_CODE);
  client.addHeader("X-Device-Key", DEVICE_KEY);
  code = client.sendRequest(method, body);
  if (code > 0) out = client.getString();
  client.end();
  bool good = code >= 200 && code < 300;
  if (good) lastServerOk = millis();
  else {
    httpFailures++;
    // The API response makes credentials and schema failures diagnosable from
    // the serial monitor without printing the device key.
    Serial.printf("HTTP %s %s -> %d%s%s\n", method, path.c_str(), code,
      out.length() ? ": " : "", out.length() ? out.c_str() : "");
  }
  return good;
}

// ---------- server config ----------
static bool loadConfig() {
  String out;
  int code;
  if (!apiCall("GET", "/api/device/config", "", out, code)) return false;
  JsonDocument doc;
  if (deserializeJson(doc, out)) return false;
  actCount = 0;
  for (JsonObject a : doc["actuators"].as<JsonArray>()) {
    if (actCount >= 8) break;
    int ch = a["relay_channel"] | 0;
    if (ch < 1 || ch > (int)RELAY_COUNT) continue;
    Act& x = acts[actCount++];
    x.id = a["id"] | 0;
    x.channel = (uint8_t)ch;
    strlcpy(x.type, a["actuator_type"] | "other", sizeof(x.type));
    x.maxRun = a["max_runtime_seconds"] | 900;
  }
  Serial.printf("config: %u actuators mapped to relays\n", actCount);
  return true;
}

static void sendStates() {
  JsonDocument doc;
  JsonArray arr = doc["states"].to<JsonArray>();
  for (uint8_t i = 0; i < actCount; i++) {
    uint8_t ch = acts[i].channel - 1;
    if (!statePending[ch]) continue;
    JsonObject o = arr.add<JsonObject>();
    o["actuator_id"] = acts[i].id;
    o["state"] = relayState[ch] ? "on" : "off";
  }
  if (arr.size() == 0) return;
  String body, out;
  int code;
  serializeJson(doc, body);
  if (apiCall("POST", "/api/device/state", body, out, code))
    for (uint8_t i = 0; i < actCount; i++) statePending[acts[i].channel - 1] = false;
}

static void pollCommands() {
  String out;
  int code;
  if (!apiCall("GET", "/api/device/commands", "", out, code)) return;
  JsonDocument doc;
  if (deserializeJson(doc, out)) return;
  for (JsonObject c : doc["commands"].as<JsonArray>()) {
    int cid = c["id"] | 0;
    int aid = c["actuator_id"] | 0;
    const char* cmd = c["command"] | "off";
    uint32_t dur = c["duration_seconds"] | 0;
    int idx = -1;
    for (uint8_t i = 0; i < actCount; i++) if (acts[i].id == aid) idx = i;
    bool ok = false;
    const char* err = "";
    if (idx < 0) {
      err = "unknown actuator or no relay channel";
    } else {
      uint8_t ch = acts[idx].channel - 1;
      if (!strcmp(cmd, "on")) {
        if (isPump(acts[idx].type) && !isnan(lastWaterPct) && lastWaterPct < PUMP_MIN_WATER_PCT) {
          err = "water level too low";
        } else {
          uint32_t run = dur ? dur : acts[idx].maxRun;
          if (run > acts[idx].maxRun) run = acts[idx].maxRun;
          if (run > LOCAL_MAX_RUN_S) run = LOCAL_MAX_RUN_S;
          relaySet(ch, true);
          relayOffAt[ch] = millis() + run * 1000UL;
          ok = true;
          Serial.printf("relay %u (%s) ON for %lu s\n", ch + 1, acts[idx].type, (unsigned long)run);
        }
      } else {
        relaySet(ch, false);
        ok = true;
        Serial.printf("relay %u (%s) OFF\n", ch + 1, acts[idx].type);
      }
    }
    JsonDocument ack;
    ack["success"] = ok;
    if (!ok) ack["error"] = err;
    String body, o2;
    int c2;
    serializeJson(ack, body);
    apiCall("POST", String("/api/device/commands/") + cid + "/ack", body, o2, c2);
    if (ok && idx >= 0) statePending[acts[idx].channel - 1] = false;
  }
}

// ---------- local safety ----------
static void safety() {
  unsigned long now = millis();
  for (uint8_t ch = 0; ch < RELAY_COUNT; ch++) {
    if (relayState[ch] && relayOffAt[ch] && (int32_t)(now - relayOffAt[ch]) >= 0) {
      relaySet(ch, false);
      Serial.printf("relay %u: timer expired\n", ch + 1);
    }
  }
  bool offline = lastServerOk ? (now - lastServerOk > OFFLINE_FAILSAFE_S * 1000UL) : (now > OFFLINE_FAILSAFE_S * 1000UL);
  for (uint8_t i = 0; i < actCount; i++) {
    uint8_t ch = acts[i].channel - 1;
    if (!relayState[ch] || !isPump(acts[i].type)) continue;
    if (offline) { relaySet(ch, false); Serial.println(F("failsafe: server unreachable, pump off")); }
    else if (!isnan(lastWaterPct) && lastWaterPct < PUMP_MIN_WATER_PCT) { relaySet(ch, false); Serial.println(F("safety: water too low, pump off")); }
  }
}

// ---------- sensors ----------
static int medianInt(int* v, int n) {
  for (int i = 1; i < n; i++) { int k = v[i], j = i - 1; while (j >= 0 && v[j] > k) { v[j + 1] = v[j]; j--; } v[j + 1] = k; }
  return v[n / 2];
}
static int readRawMedian(uint8_t pin) { int v[15]; for (int i = 0; i < 15; i++) { v[i] = analogRead(pin); delay(2); } return medianInt(v, 15); }
static int readMvMedian(uint8_t pin) { int v[15]; for (int i = 0; i < 15; i++) { v[i] = analogReadMilliVolts(pin); delay(2); } return medianInt(v, 15); }

static void scanI2cBus() {
#if I2C_DIAGNOSTICS
  uint8_t found = 0;
  const int sdaIdle = digitalRead(I2C_SDA);
  const int sclIdle = digitalRead(I2C_SCL);
  Serial.printf("I2C scan (SDA=GPIO%d=%d, SCL=GPIO%d=%d):\n", I2C_SDA, sdaIdle, I2C_SCL, sclIdle);
  if (sdaIdle == LOW || sclIdle == LOW) {
    Serial.println(F("  I2C bus line held LOW; check power, common GND, and SDA/SCL wiring"));
    return;
  }
  // Scan only valid 7-bit I2C addresses; 0x00-0x07 and 0x78-0x7F are reserved.
  for (uint8_t address = 0x08; address <= 0x77; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() != 0) continue;
    Serial.printf("  device at 0x%02X\n", address);
    found++;
  }
  if (!found) {
    Serial.println(F("  no I2C devices found: verify DY-30 VCC=3V3, GND=GND, SDA=GPIO21, SCL=GPIO22"));
  } else if (found > 4) {
    Serial.println(F("  many I2C addresses ACKed; likely bus/wiring noise (only expected sensor here is BH1750 at 0x23 or 0x5C)"));
  }
#endif
}

static float soilPct(int raw) {
  if (raw < 0 || raw > 4095 || SOIL_RAW_DRY == SOIL_RAW_WET) return NAN;
  float p = (float)(SOIL_RAW_DRY - raw) * 100.0f / (float)(SOIL_RAW_DRY - SOIL_RAW_WET);
  // Do not invent a moisture percentage when the probe is outside its measured
  // dry/wet calibration. The raw ADC reading is still sent separately.
  if (p < -5.0f || p > 105.0f) return NAN;
  return constrain(p, 0.0f, 100.0f);
}

static float readWaterPct() {
#if USE_WATER_LEVEL
  float d[5];
  int n = 0;
  for (int i = 0; i < 5; i++) {
    digitalWrite(TRIG_PIN, LOW); delayMicroseconds(3);
    digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000UL);
    if (us > 0) d[n++] = us / 58.0f;
    delay(60);
  }
  if (n < 3) return NAN;
  for (int i = 1; i < n; i++) { float k = d[i]; int j = i - 1; while (j >= 0 && d[j] > k) { d[j + 1] = d[j]; j--; } d[j + 1] = k; }
  float cm = d[n / 2];
#if DEBUG_RAW
  Serial.printf("water distance %.1f cm\n", cm);
#endif
  float pct = (TANK_EMPTY_CM - cm) * 100.0f / (TANK_EMPTY_CM - TANK_FULL_CM);
  if (pct < -10.0f || pct > 110.0f) return NAN;
  return constrain(pct, 0.0f, 100.0f);
#else
  return NAN;
#endif
}

static void put(JsonObject r, const String& key, float v) {
  if (isnan(v) || isinf(v)) { sensorErrors++; return; }
  r[key] = roundf(v * 100.0f) / 100.0f;
}

static void buildReadings(JsonObject r) {
  float airT = NAN, rh = NAN, soilT = NAN;
#if USE_SHT31
  if (shtOk) { airT = sht31.readTemperature(); rh = sht31.readHumidity(); }
#endif
#if USE_DHT
  if (isnan(airT)) { airT = dht.readTemperature(); rh = dht.readHumidity(); }
#endif
#if USE_SHT31 || USE_DHT
  put(r, "temperature", airT);
  put(r, "humidity", rh);
#endif
#if USE_BH1750
  if (luxOk) {
    float lx = lightMeter.readLightLevel();
    put(r, "light", (lx < 0.0f || lx > 65535.0f) ? NAN : lx);
  } else sensorErrors++;
#endif
#if USE_DS18B20
  ds.requestTemperatures();
  float st = ds.getTempCByIndex(0);
  soilT = (st == DEVICE_DISCONNECTED_C || st < -40.0f) ? NAN : st;
  put(r, "soil_temperature", soilT);
#endif
  for (uint8_t i = 0; i < SOIL_COUNT; i++) {
    int raw = readRawMedian(SOIL_PINS[i]);
    int mv = readMvMedian(SOIL_PINS[i]);
#if DEBUG_RAW
    Serial.printf("soil%u raw=%d voltage=%dmV moisture=%.1f%% (calibration dry=%d wet=%d)\n", i + 1, raw, mv, soilPct(raw), SOIL_RAW_DRY, SOIL_RAW_WET);
#endif
    String key = i == 0 ? String("soil_moisture") : String("soil_moisture_") + (i + 1);
    put(r, key, soilPct(raw));
    String rawKey = i == 0 ? String("soil_moisture_raw") : String("soil_moisture_raw_") + (i + 1);
    put(r, rawKey, raw);
  }
#if USE_EC
  {
    int mv = readMvMedian(EC_PIN);
#if DEBUG_RAW
    Serial.printf("ec mV=%d\n", mv);
#endif
    float t = !isnan(soilT) ? soilT : (!isnan(airT) ? airT : 25.0f);
    float ec = (mv / 1000.0f) * EC_K_FACTOR;
    put(r, "ec", ec / (1.0f + 0.02f * (t - 25.0f)));
  }
#endif
#if USE_WATER_LEVEL
  {
    float wl = readWaterPct();
    if (!isnan(wl)) lastWaterPct = wl;
    put(r, "water_level", wl);
  }
#endif
}

static void postReadings() {
  JsonDocument doc;
  doc["firmware"] = FIRMWARE_VERSION;
  JsonObject r = doc["readings"].to<JsonObject>();
  buildReadings(r);
  if (r.size() == 0) return;
  String body, out;
  int code;
  serializeJson(doc, body);
  Serial.println(body);
  if (apiCall("POST", "/api/device/readings", body, out, code)) {
    JsonDocument res;
    if (!deserializeJson(res, out)) {
      Serial.printf("server stored %u reading(s), rejected %u\n", (unsigned)(res["stored"] | 0), (unsigned)res["rejected"].size());
      for (JsonObject x : res["rejected"].as<JsonArray>()) Serial.printf("rejected: %s (%s)\n", x["sensor_type"] | "?", x["reason"] | "?");
    }
  }
}

static const char* resetReasonStr() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "poweron";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT: return "watchdog";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_DEEPSLEEP: return "deepsleep";
    default: return "other";
  }
}

static void postTelemetry() {
  JsonDocument d;
  d["rssi"] = WiFi.RSSI();
  d["uptime_s"] = (uint32_t)(millis() / 1000);
  d["free_heap"] = ESP.getFreeHeap();
  d["reset_reason"] = resetReasonStr();
  d["firmware"] = FIRMWARE_VERSION;
  d["sensor_errors"] = sensorErrors;
  d["wifi_reconnects"] = wifiReconnects;
  d["http_failures"] = httpFailures;
  String body, out;
  int code;
  serializeJson(d, body);
  apiCall("POST", "/api/device/telemetry", body, out, code);
}

static void addWifiNetwork(const char* ssid, const char* password) {
  if (!ssid || !ssid[0]) return;
  wifiMulti.addAP(ssid, password ? password : "");
  configuredWifiNetworks++;
}

static bool readWifiProfiles(JsonDocument& doc) {
  Preferences prefs;
  if (!prefs.begin("greenhouse", true)) return false;
  String encoded = prefs.getString("wifi_networks", "[]");
  prefs.end();
  if (deserializeJson(doc, encoded) || !doc.is<JsonArray>()) {
    doc.clear();
    doc.to<JsonArray>();
  }
  return true;
}

static bool writeWifiProfiles(JsonDocument& doc) {
  String encoded;
  serializeJson(doc, encoded);
  Preferences prefs;
  if (!prefs.begin("greenhouse", false)) return false;
  const size_t saved = prefs.putString("wifi_networks", encoded);
  prefs.putBool("wifi_ready", true);
  prefs.end();
  return saved > 0;
}

static void addCompileWifiProfile(JsonArray profiles, const char* ssid, const char* password) {
  if (!ssid || !ssid[0]) return;
  for (JsonObject profile : profiles) {
    if (!strcmp(profile["ssid"] | "", ssid)) return;
  }
  JsonObject profile = profiles.add<JsonObject>();
  profile["ssid"] = ssid;
  profile["password"] = password ? password : "";
}

// On first boot, move networks from secrets.h into NVS. The marker means a
// user can later delete every profile without old build-time credentials
// silently returning on reboot.
static bool initializeWifiProfiles() {
  Preferences prefs;
  if (!prefs.begin("greenhouse", false)) return false;
  const bool initialized = prefs.getBool("wifi_ready", false);
  const bool hasStoredProfiles = prefs.isKey("wifi_networks");
  if (initialized || hasStoredProfiles) {
    prefs.putBool("wifi_ready", true);
    prefs.end();
  } else {
    prefs.end();
    JsonDocument profiles;
    JsonArray list = profiles.to<JsonArray>();
    addCompileWifiProfile(list, WIFI_SSID, WIFI_PASS);
#if defined(WIFI_SSID_2) && defined(WIFI_PASS_2)
    addCompileWifiProfile(list, WIFI_SSID_2, WIFI_PASS_2);
#endif
#if defined(WIFI_SSID_3) && defined(WIFI_PASS_3)
    addCompileWifiProfile(list, WIFI_SSID_3, WIFI_PASS_3);
#endif
#if defined(WIFI_SSID_4) && defined(WIFI_PASS_4)
    addCompileWifiProfile(list, WIFI_SSID_4, WIFI_PASS_4);
#endif
#if defined(WIFI_SSID_5) && defined(WIFI_PASS_5)
    addCompileWifiProfile(list, WIFI_SSID_5, WIFI_PASS_5);
#endif
#if defined(WIFI_SSID_6) && defined(WIFI_PASS_6)
    addCompileWifiProfile(list, WIFI_SSID_6, WIFI_PASS_6);
#endif
    if (!writeWifiProfiles(profiles)) return false;
  }

  JsonDocument profiles;
  if (!readWifiProfiles(profiles)) return false;
  for (JsonObject profile : profiles.as<JsonArray>()) {
    const char* ssid = profile["ssid"] | "";
    const char* password = profile["password"] | "";
    if (ssid[0] && strlen(ssid) <= 32 && strlen(password) <= 64) addWifiNetwork(ssid, password);
  }
  return true;
}

static bool saveWifiNetwork(const char* ssid, const char* password, const char* oldSsid = "", bool preserveExistingPassword = false) {
  if (!ssid || !ssid[0] || strlen(ssid) > 32 || !password || strlen(password) > 64) return false;
  JsonDocument doc;
  if (!readWifiProfiles(doc)) return false;
  JsonArray profiles = doc.as<JsonArray>();
  bool oldFound = !oldSsid || !oldSsid[0];
  if (oldSsid && oldSsid[0] && strcmp(oldSsid, ssid)) {
    for (size_t i = 0; i < profiles.size(); i++) {
      if (!strcmp(profiles[i]["ssid"] | "", oldSsid)) {
        profiles.remove(i);
        oldFound = true;
        break;
      }
    }
    if (!oldFound) return false;
  }
  bool found = false;
  for (JsonObject profile : profiles) {
    if (!strcmp(profile["ssid"] | "", ssid)) {
      if (!preserveExistingPassword) profile["password"] = password;
      found = true;
      break;
    }
  }
  if (!found) {
    if (profiles.size() >= 8) return false;
    JsonObject profile = profiles.add<JsonObject>();
    profile["ssid"] = ssid;
    profile["password"] = password;
  }
  if (!writeWifiProfiles(doc)) return false;
  // Remote queued additions become immediately eligible for WiFiMulti.
  // BLE edits reboot after notifying the browser to flush removed credentials.
  wifiMulti.addAP(ssid, password);
  configuredWifiNetworks++;
  return true;
}

static bool deleteWifiNetwork(const char* ssid) {
  if (!ssid || !ssid[0]) return false;
  JsonDocument doc;
  if (!readWifiProfiles(doc)) return false;
  JsonArray profiles = doc.as<JsonArray>();
  bool removed = false;
  for (size_t i = 0; i < profiles.size(); i++) {
    if (!strcmp(profiles[i]["ssid"] | "", ssid)) {
      profiles.remove(i);
      removed = true;
      break;
    }
  }
  return removed && writeWifiProfiles(doc);
}

static void listWifiProfileNames(JsonArray destination) {
  JsonDocument profiles;
  if (!readWifiProfiles(profiles)) return;
  for (JsonObject profile : profiles.as<JsonArray>()) {
    const char* ssid = profile["ssid"] | "";
    if (ssid[0]) destination.add(ssid); // Never return stored passwords over BLE.
  }
}

static bool validWifiPassword(const char* password) {
  if (!password) return false;
  const size_t length = strlen(password);
  if (length == 0 || (length >= 8 && length <= 63)) return true;
  if (length != 64) return false;
  for (size_t i = 0; i < length; i++) if (!isHexadecimalDigit(password[i])) return false;
  return true;
}

static void sendBleJson(const String& message) {
  if (!bleTx || !bleClientConnected || message.isEmpty()) return;
  const uint16_t total = (message.length() + 17) / 18;
  if (total > 255) return;
  for (uint16_t index = 0; index < total; index++) {
    uint8_t packet[20];
    packet[0] = (uint8_t)index;
    packet[1] = (uint8_t)total;
    const size_t offset = index * 18;
    const size_t count = min((size_t)18, message.length() - offset);
    memcpy(packet + 2, message.c_str() + offset, count);
    bleTx->setValue(packet, count + 2);
    bleTx->notify();
    delay(12); // keep the default 23-byte BLE MTU reliable on desktop browsers
    esp_task_wdt_reset();
  }
}

class WifiBleWriteCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    if (!bleWriteQueue) return;
    const std::string value = characteristic->getValue();
    if (value.empty() || value.length() >= sizeof(BleWriteFrame)) return;
    BleWriteFrame frame{};
    frame.length = value.length();
    memcpy(frame.data, value.data(), frame.length);
    xQueueSend(bleWriteQueue, &frame, 0);
  }
};

class WifiBleServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { bleClientConnected = true; }
  void onDisconnect(BLEServer*) override {
    bleClientConnected = false;
    bleNeedsAdvertise = true;
  }
};

static void startBlePortal(unsigned long durationMs) {
  if (!bleWriteQueue) bleWriteQueue = xQueueCreate(4, sizeof(BleWriteFrame));
  if (!bleInitialized) {
    BLEDevice::init("ESP32-01-Setup");
    BLEDevice::setMTU(517);
    bleServer = BLEDevice::createServer();
    bleServer->setCallbacks(new WifiBleServerCallbacks());
    BLEService* service = bleServer->createService(BLE_SERVICE_UUID);
    BLECharacteristic* rx = service->createCharacteristic(BLE_RX_UUID, BLECharacteristic::PROPERTY_WRITE);
    rx->setAccessPermissions(ESP_GATT_PERM_WRITE_ENCRYPTED);
    rx->setCallbacks(new WifiBleWriteCallbacks());
    bleTx = service->createCharacteristic(BLE_TX_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    bleTx->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED);
    bleTx->addDescriptor(new BLE2902());
    service->start();
    BLEAdvertising* advertising = BLEDevice::getAdvertising();
    advertising->addServiceUUID(BLE_SERVICE_UUID);
    advertising->setScanResponse(true);
    advertising->setMinPreferred(0x06);
    bleInitialized = true;
  }
  blePairingPin = 100000UL + (esp_random() % 900000UL);
  if (!bleSecurity) bleSecurity = new BLESecurity();
  bleSecurity->setStaticPIN(blePairingPin);
  bleSecurity->setAuthenticationMode(ESP_LE_AUTH_REQ_SC_MITM_BOND);
  blePortalActive = true;
  blePortalExpires = durationMs ? millis() + durationMs : 0;
  BLEDevice::startAdvertising();
  Serial.println(F("bluetooth: Wi-Fi setup is available as ESP32-01-Setup"));
  Serial.printf("bluetooth: pairing PIN %06lu (enter it in the system prompt if requested)\n", (unsigned long)blePairingPin);
}

static void stopBlePortal() {
  BLEDevice::stopAdvertising();
  blePortalActive = false;
  blePortalExpires = 0;
  Serial.println(F("bluetooth: setup window closed"));
}

static void processBleRequest(const BleWriteFrame& frame) {
  JsonDocument request;
  JsonDocument response;
  DeserializationError parseError = deserializeJson(request, frame.data, frame.length);
  uint32_t requestId = request["request_id"] | 0;
  const char* action = request["action"] | "";
  response["request_id"] = requestId;
  response["action"] = action;
  bool ok = false;
  const char* message = "Unsupported request";

  if (parseError) {
    message = "Invalid request format";
  } else if (!strcmp(action, "list")) {
    JsonArray names = response["saved"].to<JsonArray>();
    listWifiProfileNames(names);
    ok = true;
    message = "Saved networks loaded";
  } else if (!strcmp(action, "scan")) {
    JsonArray nearby = response["nearby"].to<JsonArray>();
    const int count = WiFi.scanNetworks(false, true, false, 160);
    for (int i = 0; i < count && nearby.size() < 10; i++) {
      String name = WiFi.SSID(i);
      if (!name.isEmpty()) nearby.add(name);
    }
    WiFi.scanDelete();
    JsonArray names = response["saved"].to<JsonArray>();
    listWifiProfileNames(names);
    ok = count >= 0;
    message = ok ? "Wi-Fi scan complete" : "Wi-Fi scan failed";
  } else if (!strcmp(action, "save")) {
    const char* ssid = request["ssid"] | "";
    const char* password = request["password"] | "";
    const char* oldSsid = request["old_ssid"] | "";
    const bool keepPassword = oldSsid[0] && !strcmp(oldSsid, ssid) && !request["password"].is<const char*>();
    if (!ssid[0] || strlen(ssid) > 32) message = "Wi-Fi name must contain 1 to 32 bytes";
    else if (!keepPassword && !validWifiPassword(password)) message = "Wi-Fi password must be empty, 8 to 63 bytes, or 64 hex digits";
    else {
      ok = saveWifiNetwork(ssid, password, oldSsid, keepPassword);
      message = ok ? "Network saved. ESP32 will restart and connect." : "Could not save network; profile limit is 8 or the old network was not found";
      if (ok) bleRestartAt = millis() + 2500UL;
    }
  } else if (!strcmp(action, "delete")) {
    const char* ssid = request["ssid"] | "";
    ok = deleteWifiNetwork(ssid);
    message = ok ? "Network deleted. ESP32 will restart." : "Saved network was not found";
    if (ok) bleRestartAt = millis() + 2500UL;
  }

  response["ok"] = ok;
  response["message"] = message;
  String output;
  serializeJson(response, output);
  sendBleJson(output);
}

static void serviceBlePortal() {
  if (bleNeedsAdvertise) {
    bleNeedsAdvertise = false;
    if (blePortalActive) BLEDevice::startAdvertising();
  }
  if (bleWriteQueue) {
    BleWriteFrame frame;
    if (xQueueReceive(bleWriteQueue, &frame, 0) == pdTRUE) processBleRequest(frame);
  }
  const unsigned long now = millis();
  if (blePortalActive && blePortalExpires && (int32_t)(now - blePortalExpires) >= 0 && !bleClientConnected && WiFi.status() == WL_CONNECTED) {
    stopBlePortal();
  }
  if (bleRestartAt && (int32_t)(now - bleRestartAt) >= 0) {
    Serial.println(F("wifi: applying saved profile change by restarting"));
    delay(250);
    ESP.restart();
  }
}

static void pollWifiCommands() {
  String out;
  int code;
  if (!apiCall("GET", "/api/device/wifi-commands", "", out, code)) return;
  JsonDocument doc;
  if (deserializeJson(doc, out)) return;

  for (JsonObject command : doc["commands"].as<JsonArray>()) {
    const int id = command["id"] | 0;
    const char* type = command["command_type"] | "wifi";
    const char* ssid = command["ssid"] | "";
    const char* password = command["password"] | "";
    const bool saved = id > 0 && !strcmp(type, "enable_ble");
    if (saved) startBlePortal(10UL * 60UL * 1000UL);
    const bool wifiSaved = id > 0 && !strcmp(type, "wifi") && saveWifiNetwork(ssid, password);
    const char* message = saved ? "Bluetooth setup enabled for 10 minutes" :
      wifiSaved ? "Network saved on ESP32" : "Could not store network in ESP32 flash";

    JsonDocument ack;
    ack["status"] = (saved || wifiSaved) ? "ok" : "error";
    ack["message"] = message;
    String body, response;
    int ackCode;
    serializeJson(ack, body);
    apiCall("POST", String("/api/device/wifi-commands/") + id + "/ack", body, response, ackCode);
    Serial.printf("wifi: command %d (%s) %s\n", id, type, (saved || wifiSaved) ? "completed" : "failed");
  }
}

static void wifiConnect(unsigned long timeoutMs) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  if (!initializeWifiProfiles()) Serial.println(F("wifi: could not initialize saved profiles"));
  Serial.printf("wifi: trying %u configured network(s)\n", configuredWifiNetworks);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < timeoutMs) {
    wifiMulti.run();
    delay(250);
    esp_task_wdt_reset();
  }
  if (WiFi.status() == WL_CONNECTED) Serial.printf("wifi: connected, IP %s, RSSI %d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  else {
    Serial.println(F("wifi: no configured network connected yet; opening Bluetooth setup"));
    wifiOfflineSince = millis() - 30000UL;
    startBlePortal(0);
  }
}

void setup() {
  // Relays first: every output OFF before anything else can fail.
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    digitalWrite(RELAY_PINS[i], offLevel());
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], offLevel());
    relayState[i] = false; relayOffAt[i] = 0; statePending[i] = false;
  }
  Serial.begin(115200);
  delay(200);
  Serial.printf("\nGreenhouse firmware %s, device %s, reset: %s\n", FIRMWARE_VERSION, DEVICE_CODE, resetReasonStr());
  esp_task_wdt_init(60, true);
  esp_task_wdt_add(NULL);
  analogSetAttenuation(ADC_11db);
  analogReadResolution(12);
#if USE_SHT31 || USE_BH1750 || I2C_DIAGNOSTICS
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);
  scanI2cBus();
#endif
#if USE_SHT31
  shtOk = sht31.begin(SHT31_ADDR);
  if (!shtOk) Serial.println(F("SHT31 not found"));
#endif
#if USE_DHT
  dht.begin();
#endif
#if USE_BH1750
  const uint8_t addresses[] = {0x23, 0x5C}; // ADD low/floating or high on GY-30
  for (uint8_t address : addresses) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() != 0) continue;
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, address, &Wire)) {
      lightSensorAddress = address;
      luxOk = true;
      break;
    }
  }
  if (luxOk) Serial.printf("BH1750 ready at I2C 0x%02X (GPIO%d SDA, GPIO%d SCL)\n", lightSensorAddress, I2C_SDA, I2C_SCL);
  else Serial.println(F("BH1750 not found at 0x23 or 0x5C; check 3.3V, GND, SDA=GPIO21, SCL=GPIO22 and ADD strap"));
#endif
#if USE_DS18B20
  ds.begin();
#endif
#if USE_WATER_LEVEL
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
#endif
  wifiConnect(60000);
  unsigned long now = millis();
  tReport = now - REPORT_INTERVAL_MS + 3000UL;
  tPoll = now;
  tTelemetry = now - TELEMETRY_INTERVAL_MS + 15000UL;
  tConfig = now; tConfigTry = now - 15000UL; tWifi = now; tState = now;
}

void loop() {
  esp_task_wdt_reset();
  unsigned long now = millis();

  serviceBlePortal();

  if (WiFi.status() != WL_CONNECTED) {
    if (!wifiOfflineSince) wifiOfflineSince = now;
    if (now - wifiOfflineSince >= 30000UL && !blePortalActive) startBlePortal(0);
  } else {
    if (wifiOfflineSince && blePortalActive && !blePortalExpires) blePortalExpires = now + 5UL * 60UL * 1000UL;
    wifiOfflineSince = 0;
  }

  if (WiFi.status() != WL_CONNECTED && now - tWifi > 10000UL) {
    tWifi = now;
    wifiReconnects++;
    if (wifiMulti.run() == WL_CONNECTED) Serial.printf("wifi: reconnected, IP %s, RSSI %d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    else Serial.printf("wifi: trying %u configured network(s)\n", configuredWifiNetworks);
  }
  safety();

  if ((!configLoaded || now - tConfig >= CONFIG_REFRESH_MS) && now - tConfigTry >= 15000UL && WiFi.status() == WL_CONNECTED) {
    tConfigTry = now;
    if (loadConfig()) {
      configLoaded = true;
      tConfig = now;
      for (uint8_t i = 0; i < actCount; i++) statePending[acts[i].channel - 1] = true;  // reconcile state with the server
    }
  }
  if (now - tPoll >= POLL_INTERVAL_MS) {
    tPoll = now;
    if (configLoaded) pollCommands();
    if (WiFi.status() == WL_CONNECTED) pollWifiCommands();
  }
  if (now - tState >= 2000UL) { tState = now; sendStates(); }
  if (now - tReport >= REPORT_INTERVAL_MS) { tReport = now; postReadings(); }
  if (now - tTelemetry >= TELEMETRY_INTERVAL_MS) { tTelemetry = now; postTelemetry(); }
  delay(50);
}
