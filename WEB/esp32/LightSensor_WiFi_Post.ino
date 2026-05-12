/**
 * ESP32: LDR + відправка OPEN/CLOSED на Node.js сервер (SQLite).
 * Замініть WIFI_SSID, WIFI_PASS, SERVER_HOST.
 * SERVER_HOST — IP вашого ПК у локальній мережі (не localhost), наприклад "192.168.0.15"
 */
#include <WiFi.h>
#include <HTTPClient.h>

#define LDR_PIN 34
#define LED_PIN 26
#define BUZZER_PIN 27

const int THRESHOLD = 4000;

const char *WIFI_SSID = "YOUR_WIFI_NAME";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";

// IP комп'ютера, де запущено npm start (перевірте ipconfig / ifconfig)
const char *SERVER_HOST = "192.168.0.100";
const int SERVER_PORT = 3000;

const char *DEVICE_NAME = "Light_Sensor_ESP32";

bool lastAlarm = false;
unsigned long lastPostMs = 0;
const unsigned long POST_MIN_INTERVAL_MS = 2000;

void setup() {
  Serial.begin(115200);
  pinMode(LDR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi OK, IP: ");
  Serial.println(WiFi.localIP());
}

void postStatus(bool alarm) {
  if (WiFi.status() != WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - lastPostMs < POST_MIN_INTERVAL_MS) return;
  lastPostMs = now;

  HTTPClient http;
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/status";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  const char *status = alarm ? "OPEN" : "CLOSED";
  String body = String("{\"deviceName\":\"") + DEVICE_NAME + "\",\"status\":\"" + status + "\"}";

  int code = http.POST(body);
  Serial.print("POST ");
  Serial.print(status);
  Serial.print(" HTTP ");
  Serial.println(code);
  http.end();
}

void loop() {
  int lightLevel = analogRead(LDR_PIN);
  Serial.print("Рівень світла: ");
  Serial.println(lightLevel);

  bool alarm = lightLevel > THRESHOLD;

  if (alarm) {
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  } else {
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  }

  if (alarm != lastAlarm) {
    lastAlarm = alarm;
    postStatus(alarm);
  }

  delay(10);
}
