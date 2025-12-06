import mqttService from './services/mqttService';
import { rtdb } from './services/firebase';
import { initializeMagazines } from './services/initMagazines';
import { registerPlanner } from './services/planner';
import { dispense } from './services/dispense';
import { handleSensorData } from './services/levelMonitor';
import { handleStatusUpdate } from './services/statusMonitor';



const MQTT_HOST = 'localhost';
const MQTT_PORT = 1883;

const MQTT_USER = 'admin';
const MQTT_PASS = 'secret';

initializeMagazines();
registerPlanner();


mqttService.connect(MQTT_HOST, MQTT_PORT, MQTT_USER, MQTT_PASS);

mqttService.onMessage((topic, msg) => {

    if(topic.includes('/status')){
      handleStatusUpdate(topic, msg);
    }

    else if (topic.includes('/levels')){
      handleSensorData(topic, msg);
    }
});

export const startDatabaseListener = () => {
  const ref = rtdb.ref('dispense_commands');
  console.log('Listening for new notifications...');

  ref.on('child_added', async (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;

    console.log(`New notification received [${key}]:`, data);

    try{
        console.log("event received: ", data)
        await dispense(data) 
        await snapshot.ref.remove();
        console.log("Command successfully deleted.");
    }
    catch (error){
        console.error("Faild to handle the command:", error);
    }
  });
};


startDatabaseListener()
