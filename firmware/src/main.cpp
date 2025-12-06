#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <AccelStepper.h>
#include <ArduinoJson.h>
#include "secrets.h"

const char* ssid     = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// MQTT
const char *mqtt_server = "10.186.216.224";
const char *mqtt_username = MQTT_USERNAME;
const char *mqtt_password = MQTT_PASSWORD;
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

// --- SENSOR KONFIGURATION ---
const int PIN_SENSOR_1 = 34; 
const int PIN_SENSOR_2 = 35; 
const int SENSOR_THRESHOLD = 500; // Anpassen je nach Lichtverhältnissen!

// --- SICHERHEITS-LIMIT ---
// Wenn nach z.B. 4096 Schritten (2 Umdrehungen) nichts kommt -> ABBRUCH (Leer?)
const long MAX_STEPS_SAFETY = 5000; 

AccelStepper stepper1(AccelStepper::FULL4WIRE, 19, 5, 18, 17);
AccelStepper stepper2(AccelStepper::FULL4WIRE, 33, 26, 32, 25);

// --- ZUSTANDSSPEICHER (Merken der Richtung) ---
// true = Uhrzeigersinn, false = Gegen-Uhrzeigersinn
bool motor1_next_dir_cw = true; 
bool motor2_next_dir_cw = true;

// --- Neue Funktion: Fahren bis Sensor auslöst ---
// Rückgabe: true wenn Pille erkannt, false wenn Timeout (Leer)
bool dispenseSinglePill(AccelStepper &motor, int sensorPin, bool &nextDirCw) {
  
  // 1. Position nullen (vereinfacht die Logik)
  motor.setCurrentPosition(0);
  
  // 2. Ziel setzen (extrem weit weg, da wir vorher per Sensor stoppen wollen)
  // Wenn nextDirCw true ist, fahren wir +Safety, sonst -Safety
  long targetPos = nextDirCw ? MAX_STEPS_SAFETY : -MAX_STEPS_SAFETY;
  
  Serial.printf(" -> Starte Motor (Richtung: %s). Warte auf Sensor...\n", nextDirCw ? "CW" : "CCW");
  
  motor.moveTo(targetPos);

  bool pillDetected = false;

  // 3. Die Bewegungsschleife
  // Wir laufen solange, bis der Motor sein (Sicherheits-)Ziel erreicht hat
  while (motor.distanceToGo() != 0) {
    
    motor.run(); // Wichtig: Immer aufrufen!

    // Sensor prüfen
    int val = analogRead(sensorPin);
    
    // Pille erkannt?
    if (val < SENSOR_THRESHOLD) {
      Serial.printf(" [SENSOR] Pille erkannt! Wert: %d\n", val);
      pillDetected = true;
      
      // SOFORT STOPPEN
      // Wir setzen das Ziel auf die aktuelle Position -> Motor denkt er ist fertig
      motor.moveTo(motor.currentPosition()); 
      break; // Raus aus der while-Schleife
    }
  }

  // 4. Ergebnis auswerten
  if (pillDetected) {
    // Richtung für das NÄCHSTE Mal umkehren (Toggle)
    nextDirCw = !nextDirCw; 
    delay(500); // Kurz warten, damit Pille sicher fällt
    return true;
  } else {
    Serial.println(" [FEHLER] Max Schritte erreicht. Keine Pille gesehen! (Magazin leer?)");
    // Richtung NICHT ändern, damit wir es beim nächsten Mal nochmal probieren können?
    // Oder doch ändern, um Verklemmung zu lösen? -> Hier ändern wir es mal nicht.
    return false;
  }
}

void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("Nachricht erhalten: ");
  // ... (String parsing nur für Debugging) ...
  
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message, length);

  if (error) {
    Serial.print("JSON Fehler: ");
    Serial.println(error.c_str());
    return;
  }

  if (String(topic) == "medbox/01/dispense") {
    
    JsonArray amounts = doc["amounts"];
    bool globalSuccess = true; 

    for(JsonObject item : amounts){
      int id = item["magazineId"];
      int amount = item["amount"];
      const char* name = item["magazineName"];
      
      Serial.printf("Verarbeite: %s (ID: %d), Menge: %d\n", name, id, amount);

      // Schleife für die Anzahl der Pillen in diesem Magazin
      for (int i = 0; i < amount; i++) {
        bool pillSuccess = false;

        if (id == 1) {
          // Wir übergeben die globale Variable 'motor1_next_dir_cw' als Referenz
          pillSuccess = dispenseSinglePill(stepper1, PIN_SENSOR_1, motor1_next_dir_cw);
        } 
        else if (id == 2) {
          pillSuccess = dispenseSinglePill(stepper2, PIN_SENSOR_2, motor2_next_dir_cw);
        }
        else {
          Serial.println("Unbekannte ID");
        }

        if (!pillSuccess) {
          globalSuccess = false;
          // Optional: Abbrechen ("break"), wenn eine Pille fehlt?
          // Oder versuchen, die restlichen noch auszugeben?
        }
      }
    }

    // Bestätigung nur, wenn wirklich ALLE Pillen sensorisch erfasst wurden
    if (globalSuccess) {
      Serial.println("AUFTRAG ERLEDIGT. Sende ACK.");
      client.publish("medbox/01/dispensed", "true");
    } else {
      Serial.println("AUFTRAG FEHLERHAFT. Mindestens eine Pille fehlte.");
      client.publish("medbox/01/dispensed", "false"); 
    }
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

  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  pinMode(PIN_SENSOR_1, INPUT);
  pinMode(PIN_SENSOR_2, INPUT);

  // Motoren konfigurieren
  stepper1.setMaxSpeed(800.0);
  stepper1.setAcceleration(500.0); // Etwas sanfter anfahren

  stepper2.setMaxSpeed(800.0);
  stepper2.setAcceleration(500.0);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}