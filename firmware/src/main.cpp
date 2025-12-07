#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <AccelStepper.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "Adafruit_VL6180X.h"
#include "secrets.h" // Ensure this file exists with your credentials

// --- WIFI & MQTT SETTINGS ---
const char* ssid     = WIFI_SSID;
const char* password = WIFI_PASSWORD;

const char *mqtt_server = "10.212.77.224";
const char *mqtt_username = MQTT_USERNAME;
const char *mqtt_password = MQTT_PASSWORD;
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

// --- VL6180X TOF SENSOR CONFIGURATION ---
// CHANGED GPIO 26 to GPIO 4 because Stepper2 uses GPIO 26!
#define SHUTDOWN_PIN_1 4   
#define SHUTDOWN_PIN_2 27
#define SENSOR1_NEW_ADDR 0x30

Adafruit_VL6180X tof1 = Adafruit_VL6180X();
Adafruit_VL6180X tof2 = Adafruit_VL6180X();

// Timer for publishing sensor data (non-blocking)
unsigned long lastSensorReadTime = 0;
const long sensorInterval = 4000; // Publish every 2000ms (2 seconds)

const char* status_topic = "medbox/01/status";

// --- LIGHT BARRIER / ANALOG CONFIGURATION ---
const int PIN_SENSOR_1 = 34; 
const int PIN_SENSOR_2 = 35; 
const int SENSOR_THRESHOLD = 500; 

// --- MOTOR CONFIGURATION ---
const long MAX_STEPS_SAFETY = 5000; 
AccelStepper stepper1(AccelStepper::FULL4WIRE, 19, 5, 18, 17);
// Note: Stepper 2 uses Pin 26, so we moved Sensor SHDN to Pin 4
AccelStepper stepper2(AccelStepper::FULL4WIRE, 33, 26, 32, 25);

bool motor1_next_dir_cw = true; 
bool motor2_next_dir_cw = true;

// ----------------------------------------------------------------
// FUNCTION: Initialize I2C Sensors (Address Handling)
// ----------------------------------------------------------------
void setupToFSensors() {
  Serial.println("Initializing VL6180X Sensors...");
  
  pinMode(SHUTDOWN_PIN_1, OUTPUT);
  pinMode(SHUTDOWN_PIN_2, OUTPUT);

  // 1. Reset both sensors
  digitalWrite(SHUTDOWN_PIN_1, LOW);
  digitalWrite(SHUTDOWN_PIN_2, LOW);
  delay(50);

  // 2. Power up Sensor 1
  digitalWrite(SHUTDOWN_PIN_1, HIGH);
  delay(50); 
  
  if (!tof1.begin()) {
    Serial.println("ERROR: Failed to find ToF Sensor 1 (Check Wiring/Pin 4)");
    // We do NOT stop the program with while(1) here, so the Pill Box still works even if distance sensor fails
  } else {
    Serial.println("ToF Sensor 1 found. Setting address to 0x30");
    tof1.setAddress(SENSOR1_NEW_ADDR);
  }

  // 3. Power up Sensor 2
  digitalWrite(SHUTDOWN_PIN_2, HIGH);
  delay(50);

  if (!tof2.begin()) {
    Serial.println("ERROR: Failed to find ToF Sensor 2");
  } else {
    Serial.println("ToF Sensor 2 found (Address 0x29)");
  }
}

// ----------------------------------------------------------------
// FUNCTION: Publish Distance Data
// ----------------------------------------------------------------
void readAndPublishDistances() {
  // Read Sensor 1
  uint8_t range1 = tof1.readRange();
  uint8_t status1 = tof1.readRangeStatus();
  
  // Read Sensor 2
  uint8_t range2 = tof2.readRange();
  uint8_t status2 = tof2.readRangeStatus();

  // Create JSON Payload
  StaticJsonDocument<200> doc;
  
  if (status1 == VL6180X_ERROR_NONE) doc["mag1_mm"] = range1;
  else doc["mag1_mm"] = -1; // -1 indicates error

  if (status2 == VL6180X_ERROR_NONE) doc["mag2_mm"] = range2;
  else doc["mag2_mm"] = -1;

  char buffer[200];
  serializeJson(doc, buffer);

  // Publish to MQTT
  client.publish("medbox/01/levels", buffer);
  Serial.print("Published Levels: ");
  Serial.println(buffer);
}

// ----------------------------------------------------------------
// FUNCTION: Dispense Logic (Unchanged from your project)
// ----------------------------------------------------------------
bool dispenseSinglePill(AccelStepper &motor, int sensorPin, bool &nextDirCw) {
  motor.setCurrentPosition(0);
  long targetPos = nextDirCw ? MAX_STEPS_SAFETY : -MAX_STEPS_SAFETY;
  Serial.printf(" -> Starte Motor. Warte auf Lichtschranke...\n");
  motor.moveTo(targetPos);

  bool pillDetected = false;

  while (motor.distanceToGo() != 0) {
    motor.run(); 
    int val = analogRead(sensorPin);
    if (val < SENSOR_THRESHOLD) {
      Serial.printf(" [SENSOR] Pille erkannt! Wert: %d\n", val);
      pillDetected = true;
      motor.moveTo(motor.currentPosition()); 
      break; 
    }
  }

  if (pillDetected) {
    nextDirCw = !nextDirCw; 
    delay(500); 
    return true;
  } else {
    Serial.println(" [FEHLER] Keine Pille erkannt!");
    return false;
  }
}

// ----------------------------------------------------------------
// MQTT CALLBACK
// ----------------------------------------------------------------
void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("MQTT Msg: ");
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message, length);

  if (error) {
    Serial.println("JSON Error");
    return;
  }

  if (String(topic) == "medbox/01/dispense") {
    JsonArray amounts = doc["amounts"];
    bool globalSuccess = true; 

    for(JsonObject item : amounts){
      int id = item["magazineId"];
      int amount = item["amount"];
      
      for (int i = 0; i < amount; i++) {
        bool pillSuccess = false;
        if (id == 1) pillSuccess = dispenseSinglePill(stepper1, PIN_SENSOR_1, motor1_next_dir_cw);
        else if (id == 2) pillSuccess = dispenseSinglePill(stepper2, PIN_SENSOR_2, motor2_next_dir_cw);
        
        if (!pillSuccess) globalSuccess = false;
      }
    }

    if (globalSuccess) client.publish("medbox/01/dispensed", "true");
    else client.publish("medbox/01/dispensed", "false"); 
  }
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String client_id = String("esp32-medbox-") + String(WiFi.macAddress());
    if (client.connect(client_id.c_str(), mqtt_username, mqtt_password, status_topic, 1, true, "offline")) {
      Serial.println("connected");
      client.publish(status_topic, "online", true);
      client.subscribe("medbox/01/dispense");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(2000);
    }
  }
}

// ----------------------------------------------------------------
// MAIN SETUP
// ----------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  
  // 1. Initialize I2C Bus explicitly on 21 (SDA), 22 (SCL)
  Wire.begin(21, 22);

  // 2. Initialize Distance Sensors (Function defined above)
  setupToFSensors();

  // 3. Setup WiFi & MQTT
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  // 4. Setup Pins for Light Barriers
  pinMode(PIN_SENSOR_1, INPUT);
  pinMode(PIN_SENSOR_2, INPUT);

  // 5. Setup Motors
  stepper1.setMaxSpeed(800.0);
  stepper1.setAcceleration(500.0);
  stepper2.setMaxSpeed(800.0);
  stepper2.setAcceleration(500.0);
}

// ----------------------------------------------------------------
// MAIN LOOP
// ----------------------------------------------------------------
void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Non-blocking timer: Read Distances every 2 seconds
  unsigned long now = millis();
  if (now - lastSensorReadTime > sensorInterval) {
    lastSensorReadTime = now;
    readAndPublishDistances();
  }
}