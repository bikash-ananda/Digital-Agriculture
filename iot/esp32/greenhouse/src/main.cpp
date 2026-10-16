#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <esp_system.h>
#include <esp_task_wdt.h>
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
  else { httpFailures++; Serial.printf("HTTP %s %s -> %d\n", method, path.c_str(), code); }
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

static float soilPct(int raw) {
  float p = (float)(SOIL_RAW_DRY - raw) * 100.0f / (float)(SOIL_RAW_DRY - SOIL_RAW_WET);
  if (p < -5.0f || p > 105.0f) return NAN;   // probe unplugged or wrong calibration
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
  if (luxOk) { float lx = lightMeter.readLightLevel(); put(r, "light", lx < 0 ? NAN : lx); } else sensorErrors++;
#endif
#if USE_DS18B20
  ds.requestTemperatures();
  float st = ds.getTempCByIndex(0);
  soilT = (st == DEVICE_DISCONNECTED_C || st < -40.0f) ? NAN : st;
  put(r, "soil_temperature", soilT);
#endif
  for (uint8_t i = 0; i < SOIL_COUNT; i++) {
    int raw = readRawMedian(SOIL_PINS[i]);
#if DEBUG_RAW
    Serial.printf("soil%u raw=%d\n", i + 1, raw);
#endif
    String key = i == 0 ? String("soil_moisture") : String("soil_moisture_") + (i + 1);
    put(r, key, soilPct(raw));
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
    if (!deserializeJson(res, out))
      for (JsonObject x : res["rejected"].as<JsonArray>()) Serial.printf("rejected: %s (%s)\n", x["sensor_type"] | "?", x["reason"] | "?");
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

static void wifiConnect(unsigned long timeoutMs) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  addWifiNetwork(WIFI_SSID, WIFI_PASS);
#if defined(WIFI_SSID_2) && defined(WIFI_PASS_2)
  addWifiNetwork(WIFI_SSID_2, WIFI_PASS_2);
#endif
#if defined(WIFI_SSID_3) && defined(WIFI_PASS_3)
  addWifiNetwork(WIFI_SSID_3, WIFI_PASS_3);
#endif
#if defined(WIFI_SSID_4) && defined(WIFI_PASS_4)
  addWifiNetwork(WIFI_SSID_4, WIFI_PASS_4);
#endif
#if defined(WIFI_SSID_5) && defined(WIFI_PASS_5)
  addWifiNetwork(WIFI_SSID_5, WIFI_PASS_5);
#endif
#if defined(WIFI_SSID_6) && defined(WIFI_PASS_6)
  addWifiNetwork(WIFI_SSID_6, WIFI_PASS_6);
#endif
  Serial.printf("wifi: trying %u configured network(s)\n", configuredWifiNetworks);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < timeoutMs) {
    wifiMulti.run();
    delay(250);
    esp_task_wdt_reset();
  }
  if (WiFi.status() == WL_CONNECTED) Serial.printf("wifi: connected, IP %s, RSSI %d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  else Serial.println(F("wifi: no configured network connected yet; will keep trying"));
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
  Wire.begin(I2C_SDA, I2C_SCL);
#if USE_SHT31
  shtOk = sht31.begin(SHT31_ADDR);
  if (!shtOk) Serial.println(F("SHT31 not found"));
#endif
#if USE_DHT
  dht.begin();
#endif
#if USE_BH1750
  luxOk = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (!luxOk) Serial.println(F("BH1750 not found"));
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
  if (configLoaded && now - tPoll >= POLL_INTERVAL_MS) { tPoll = now; pollCommands(); }
  if (now - tState >= 2000UL) { tState = now; sendStates(); }
  if (now - tReport >= REPORT_INTERVAL_MS) { tReport = now; postReadings(); }
  if (now - tTelemetry >= TELEMETRY_INTERVAL_MS) { tTelemetry = now; postTelemetry(); }
  delay(50);
}