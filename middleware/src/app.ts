import mqttService from './services/mqttService';

const MQTT_HOST = 'localhost';
const MQTT_PORT = 1883;

const MQTT_USER = 'admin';
const MQTT_PASS = 'secret';

mqttService.connect(MQTT_HOST, MQTT_PORT, MQTT_USER, MQTT_PASS);
