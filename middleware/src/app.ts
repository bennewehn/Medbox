import mqttService from './services/mqttService';
import { db, rtdb } from './services/firebase';
import { initializeMagazines } from './services/initMagazines';


const MQTT_HOST = 'localhost';
const MQTT_PORT = 1883;

const MQTT_USER = 'admin';
const MQTT_PASS = 'secret';

initializeMagazines();


mqttService.connect(MQTT_HOST, MQTT_PORT, MQTT_USER, MQTT_PASS);

export const startDatabaseListener = () => {
  const ref = rtdb.ref('dispense_commands');
  console.log('Listening for new notifications...');

  ref.on('child_added', async (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;

    console.log(`New notification received [${key}]:`, data);

    try{
        mqttService.publishCommand("01", "dispense", data.amounts)
        await snapshot.ref.remove();
        console.log("Command successfully deleted.");
    }
    catch (error){
        console.error("Faild to handle the command:", error);
    }
  });
};


startDatabaseListener()

// mqttService.publishCommand("1234", "dispense", {})