#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "secrets_template.h"
#include <AccelStepper.h>
#include <ArduinoJson.h>

const char* ssid     = WIFI_SSID;
const char* password = WIFI_PASSWORD ;

// MQTT Broker
const char *mqtt_server = "192.168.0.210";
const char *mqtt_username = MQTT_USERNAME;
const char *mqtt_password = MQTT_PASSWORD;
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

bool dispenseRequested = false;

AccelStepper stepper1(AccelStepper::FULL4WIRE, 16, 17, 18, 19); // motor 1
AccelStepper stepper2(AccelStepper::FULL4WIRE, 33, 25, 26, 27); // motor 2

// Infrared sensor pin (adjust if necessary)
const int IR_PIN = 32;

// Parse amounts from message like: [{"amount": 1}, {"amount":1}]
int parseAmounts(const String &msg, int amounts[], int maxCount) {
  StaticJsonDocument<200> doc;
  DeserializationError err = deserializeJson(doc, msg);
  if (err) {
    return 0;
  }
  if (!doc.is<JsonArray>()) return 0;

  int i = 0;
  for (JsonObject obj : doc.as<JsonArray>()) {
    if (i >= maxCount) break;
    amounts[i++] = obj["amount"] | 0; // default 0 falls key fehlt
  }
  return i;
}

// Rotate given motor until IR sensor counts targetCount pulses
void rotateMotorUntilCount(int motor, int targetCount, AccelStepper &stepper) {
  if (targetCount <= 0) return;

  int count = 0;
  int lastState = digitalRead(IR_PIN);

  stepper.setSpeed(100);
  while (count < targetCount) {
  
    stepper.runSpeed();

    int state = digitalRead(IR_PIN);
    // detect falling edge or rising edge depending on sensor wiring
    if (lastState == HIGH && state == LOW) {
      count++;
      // simple debounce / avoid double counting
      delay(50);
    }

    static unsigned long lastClient = 0; //TODO: check if this is useful here
    if (millis() - lastClient > 50) { 
      client.loop(); lastClient = millis();
    }
    lastState = state;
  }
  // stop motor
  stepper.setSpeed(0);
}

void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("Message arrived on topic: ");
  Serial.print(topic);
  Serial.print(". Message: ");
  
  String messageTemp;
  
  for (int i = 0; i < length; i++) {
    Serial.print((char)message[i]);
    messageTemp += (char)message[i];
  }
  Serial.println();

  if (String(topic) == "medbox/01/dispense") {
    Serial.println("dispense called");
    // parse requested amounts for both motors
    int amounts[2] = {0, 0};
    int found = parseAmounts(messageTemp, amounts, 2);
    Serial.print("Parsed amounts: ");
    for (int i = 0; i < 2; i++) {
      Serial.print(amounts[i]);
      if (i == 0) Serial.print(", ");
    }
    Serial.println();

    // Execute dispensing: first motor 0, then motor 1, using the single IR sensor
    if(found <= 2){
      rotateMotorUntilCount(0, amounts[0], stepper1);
      rotateMotorUntilCount(1, amounts[1], stepper2);
    }else{
      Serial.println("Error: too many amounts specified");
      return;
    }
    Serial.println("dispense done");

    // publish acknowledgement
    client.publish("medbox/01/dispensed", "true");
    Serial.println("ack sent");
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
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    // Attempt to connect (Client ID must be unique)
    String client_id = String("esp32-client-") += String(WiFi.macAddress());

    if (client.connect(client_id.c_str(), mqtt_username, mqtt_password)) {
      Serial.println("connected");
      
      // --- 2. Subscribe to Topic ---
      client.subscribe("medbox/01/dispense");
      
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 2 seconds");
      delay(2000);
    }
  }
}


void setup() {
  Serial.begin(115200);
  setup_wifi();

  // Configure the MQTT server and the callback
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  stepper1.setMaxSpeed(500);
  stepper1.setAcceleration(100);
  stepper2.setMaxSpeed(500);
  stepper2.setAcceleration(100);

  // initialize IR sensor pin
  pinMode(IR_PIN, INPUT_PULLUP);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }

  client.loop();

 
}