#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <AccelStepper.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "Adafruit_VL6180X.h"
#include "secrets.h" 

// --- WIFI & MQTT ---
const char* ssid     = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char *mqtt_server = "10.212.77.224";
const char *mqtt_username = MQTT_USERNAME;
const char *mqtt_password = MQTT_PASSWORD;

WiFiClient espClient;
PubSubClient client(espClient);

// --- SENSORS ---
#define SHUTDOWN_PIN_1 4   
#define SHUTDOWN_PIN_2 27
#define SENSOR1_NEW_ADDR 0x30
Adafruit_VL6180X tof1 = Adafruit_VL6180X();
Adafruit_VL6180X tof2 = Adafruit_VL6180X();

const int PIN_SENSOR_1 = 34; 
const int PIN_SENSOR_2 = 35; 
const int SENSOR_THRESHOLD = 500; 

// --- MOTORS ---
const long MAX_STEPS_SAFETY = 5000; 
AccelStepper stepper1(AccelStepper::FULL4WIRE, 19, 5, 18, 17);
AccelStepper stepper2(AccelStepper::FULL4WIRE, 33, 26, 32, 25);

// Direction Flags
bool motor1_next_dir_cw = true; 
bool motor2_next_dir_cw = true;

// --- STATE MACHINE VARIABLES ---
enum DispenseState {
  STATE_IDLE,
  STATE_INIT_PILL,
  STATE_MOVING,
  STATE_JAM_REVERSE,
  STATE_COOLDOWN,
  STATE_REPORTING 
};

DispenseState currentState = STATE_IDLE;

// Queue Counters
int pillsQueuedMag1 = 0;
int pillsQueuedMag2 = 0;
int currentMagProcessing = 0; // 1 or 2

// Pointers for the "Active" device (to avoid duplicate code)
AccelStepper* activeMotor = nullptr;
int activeSensorPin = 0;
bool* activeDirFlag = nullptr;

// Timers for Non-Blocking Logic
unsigned long pillStartTime = 0;
bool hasReversedCurrentPill = false;
unsigned long lastSensorReadTime = 0;
const long sensorInterval = 4000; 

// ----------------------------------------------------------------
// SETUP FUNCTIONS (Unchanged mostly)
// ----------------------------------------------------------------
void setupToFSensors() {
  pinMode(SHUTDOWN_PIN_1, OUTPUT);
  pinMode(SHUTDOWN_PIN_2, OUTPUT);
  digitalWrite(SHUTDOWN_PIN_1, LOW);
  digitalWrite(SHUTDOWN_PIN_2, LOW);
  delay(50);
  digitalWrite(SHUTDOWN_PIN_1, HIGH);
  delay(50); 
  if (tof1.begin()) tof1.setAddress(SENSOR1_NEW_ADDR);
  digitalWrite(SHUTDOWN_PIN_2, HIGH);
  delay(50);
  tof2.begin();
}

void readAndPublishDistances() {
  uint8_t range1 = tof1.readRange();
  uint8_t status1 = tof1.readRangeStatus();
  uint8_t range2 = tof2.readRange();
  uint8_t status2 = tof2.readRangeStatus();

  StaticJsonDocument<200> doc;
  doc["mag1_mm"] = (status1 == VL6180X_ERROR_NONE) ? range1 : -1;
  doc["mag2_mm"] = (status2 == VL6180X_ERROR_NONE) ? range2 : -1;

  char buffer[200];
  serializeJson(doc, buffer);
  client.publish("medbox/01/levels", buffer);
}

// ----------------------------------------------------------------
// NON-BLOCKING STATE MACHINE
// ----------------------------------------------------------------

// Helper variables
bool reportSuccess = false;         // Did we send the payload?
unsigned long cooldownStart = 0;    // Timer for the cooldown

void handleDispenseLogic() {
  
  // --- STATE: IDLE ---
  if (currentState == STATE_IDLE) {
    if (pillsQueuedMag1 > 0) {
      currentMagProcessing = 1;
      activeMotor = &stepper1;
      activeSensorPin = PIN_SENSOR_1;
      activeDirFlag = &motor1_next_dir_cw;
      currentState = STATE_INIT_PILL;
    } 
    else if (pillsQueuedMag2 > 0) {
      currentMagProcessing = 2;
      activeMotor = &stepper2;
      activeSensorPin = PIN_SENSOR_2;
      activeDirFlag = &motor2_next_dir_cw;
      currentState = STATE_INIT_PILL;
    }
    return;
  }

  // --- STATE: INIT PILL ---
  if (currentState == STATE_INIT_PILL) {
    activeMotor->setCurrentPosition(0);
    long target = (*activeDirFlag) ? MAX_STEPS_SAFETY : -MAX_STEPS_SAFETY;
    activeMotor->moveTo(target);
    
    pillStartTime = millis();
    hasReversedCurrentPill = false;
    
    Serial.printf("Starting Pill Mag %d...\n", currentMagProcessing);
    currentState = STATE_MOVING;
  }

  // --- STATE: MOVING ---
  else if (currentState == STATE_MOVING) {
    bool isMoving = (activeMotor->distanceToGo() != 0);
    activeMotor->run(); 

    // A. Check Sensor
    int sensorValue = analogRead(activeSensorPin);
    if (sensorValue < SENSOR_THRESHOLD) {
      Serial.print(" [SENSOR] Pill Detected!");
      Serial.println( sensorValue);
      
      // Stop Motor Immediately
      activeMotor->moveTo(activeMotor->currentPosition());
      
      // Decrement Queue
      if (currentMagProcessing == 1) pillsQueuedMag1--;
      else pillsQueuedMag2--;

      // Toggle Direction (Optional)
      *activeDirFlag = !(*activeDirFlag);

      // Go to Cooldown (Let power stabilize before WiFi TX)
      cooldownStart = millis();
      currentState = STATE_COOLDOWN;
      reportSuccess = true; // Assume success unless queue is empty (handled below)
      return; 
    }

    // B. Check Timeout (8 Seconds)
    if (!hasReversedCurrentPill && (millis() - pillStartTime > 8000)) {
      Serial.println(" [TIMEOUT] Jam suspected. Reversing...");
      currentState = STATE_JAM_REVERSE;
      return;
    }

    // C. Check Motor Finished (Failed to see pill)
    if (!isMoving) {
      Serial.println(" [FAIL] Motor finished steps. No pill.");
      // Handle fail count (decrementing anyway to prevent infinite loop)
      if (currentMagProcessing == 1) pillsQueuedMag1--;
      else pillsQueuedMag2--;
      
      reportSuccess = false; // Mark this batch as failed (if it was the last one)
      cooldownStart = millis();
      currentState = STATE_COOLDOWN;
    }
  }

  // --- STATE: JAM REVERSE ---
  else if (currentState == STATE_JAM_REVERSE) {
    activeMotor->moveTo(activeMotor->currentPosition());
    activeMotor->runToPosition(); // Quick block to stop

    *activeDirFlag = !(*activeDirFlag);
    long newTarget = (*activeDirFlag) ? MAX_STEPS_SAFETY : -MAX_STEPS_SAFETY;
    activeMotor->moveTo(newTarget);
    
    hasReversedCurrentPill = true; 
    pillStartTime = millis(); 
    currentState = STATE_MOVING; 
  }

  // --- STATE: COOLDOWN ---
  // Wait 200ms to let voltage stabilize after motor stop
  else if (currentState == STATE_COOLDOWN) {
    if (millis() - cooldownStart > 200) {
      // Check if we are done with ALL pills
      if (pillsQueuedMag1 == 0 && pillsQueuedMag2 == 0) {
        // We have a report to send!
        currentState = STATE_REPORTING;
      } else {
        // More pills to do, go back to IDLE immediately
        currentState = STATE_IDLE;
      }
    }
  }

  // --- STATE: REPORTING (THE FIX) ---
  // We stay here until the message is actually sent
  else if (currentState == STATE_REPORTING) {
    
    // 1. Ensure we are connected before trying
    if (client.connected()) {
      bool sent = false;
      
      if (reportSuccess) {
         sent = client.publish("medbox/01/dispensed", "true");
      } else {
         sent = client.publish("medbox/01/dispensed", "false");
      }

      if (sent) {
        Serial.println(" [MQTT] Acknowledgment Sent Successfully.");
        currentState = STATE_IDLE; 
      } else {
        Serial.println(" [MQTT] Send failed (Buffer full?). Retrying next loop...");
        // We stay in STATE_REPORTING and try again in the next loop()
      }
    } 
    else {
      // If we lost connection, we exit. The main loop() will trigger reconnect().
      // Once reconnected, we will come back here and try sending again.
      Serial.println(" [MQTT] Disconnected while trying to report. Waiting...");
    }
  }
}
// ----------------------------------------------------------------
// MQTT CALLBACK (Now only queues data)
// ----------------------------------------------------------------
void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("MQTT Request Received: ");
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message, length);

  if (error) { Serial.println("JSON Error"); return; }

  if (String(topic) == "medbox/01/dispense") {
    JsonArray amounts = doc["amounts"];
    
    // Just add to the counters. The Loop handles the rest.
    for(JsonObject item : amounts){
      int id = item["magazineId"];
      int amount = item["amount"];
      
      if (id == 1) pillsQueuedMag1 += amount;
      if (id == 2) pillsQueuedMag2 += amount;
    }
    Serial.printf("Queued: Mag1=%d, Mag2=%d\n", pillsQueuedMag1, pillsQueuedMag2);
  }
}

// ----------------------------------------------------------------
// STANDARD WIFI FUNCTIONS
// ----------------------------------------------------------------
void setup_wifi() {
  delay(10);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void reconnect() {
  if (!client.connected()) {
    String client_id = String("esp32-medbox-") + String(WiFi.macAddress());
    if (client.connect(client_id.c_str(), mqtt_username, mqtt_password, "medbox/01/status", 1, true, "offline")) {
      client.publish("medbox/01/status", "online", true);
      client.subscribe("medbox/01/dispense");
    }
  }
}

// ----------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  
  setupToFSensors();
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  pinMode(PIN_SENSOR_1, INPUT);
  pinMode(PIN_SENSOR_2, INPUT);

  stepper1.setMaxSpeed(600.0);
  stepper1.setAcceleration(500.0);
  stepper2.setMaxSpeed(600.0);
  stepper2.setAcceleration(500.0);
}

void loop() {
  // 1. Maintain WiFi/MQTT (Runs every cycle!)
  if (!client.connected()) reconnect();
  client.loop(); 

  // 2. Run Dispense Logic (State Machine)
  // This advances the motor by one step or checks sensors, then returns immediately.
  handleDispenseLogic();

  // 3. Sensor Reporting (Non-blocking timer)
  unsigned long now = millis();
  if (now - lastSensorReadTime > sensorInterval) {
    lastSensorReadTime = now;
    readAndPublishDistances();
  }
}