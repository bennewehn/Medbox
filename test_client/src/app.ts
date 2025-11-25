import mqtt, {  IClientOptions } from 'mqtt';

// Configuration
const BROKER_URL = 'mqtt://localhost:1883';
const BOX_ID = 'ca2fafe3-6348-4d6f-99f3-3f2490948a18';

console.log(`🔌 Connecting Test Device (Box ${BOX_ID}) to ${BROKER_URL}...`);


const options: IClientOptions = {
  clean: true,
  connectTimeout: 4000, 
  username: "device",
  password: "123",
};

const client = mqtt.connect(BROKER_URL, options);

client.on('connect', () => {
  console.log(`✅ Device Connected!`);

 

});

client.on('error', (err) => {
  console.error('Connection Error:', err);
});