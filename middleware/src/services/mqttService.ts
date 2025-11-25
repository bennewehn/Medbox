import mqtt, { MqttClient, IClientOptions } from 'mqtt';

class MqttService {
  private client: MqttClient | null = null;
  private static instance: MqttService;

  private constructor() {}

  // Singleton pattern to ensure only one connection exists
  public static getInstance(): MqttService {
    if (!MqttService.instance) {
      MqttService.instance = new MqttService();
    }
    return MqttService.instance;
  }

  public connect(host: string, port: number, username?: string, password?: string): void {
    const connectUrl = `mqtt://${host}:${port}`;

    const options: IClientOptions = {
      clean: true, // clean session
      connectTimeout: 4000, 
      username: username,
      password: password,
      reconnectPeriod: 1000, // Retry every 1s if lost
    };

    console.log(`Connecting to MQTT Broker at ${connectUrl}...`);
    
    this.client = mqtt.connect(connectUrl, options);

    this.client.on('connect', () => {
      console.log('✅ MQTT Connected');
      // Subscribe to topics here if this service also needs to LISTEN
      this.client?.subscribe('medbox/+/events'); 
    });

    this.client.on('error', (err) => {
      console.error('❌ MQTT Error:', err);
      this.client?.end();
    });
  }

  public publishCommand(boxId: string, command: string, payload: object): void {
    if (!this.client || !this.client.connected) {
      console.warn('MQTT Client not connected. Cannot publish.');
      return;
    }

    const topic = `medbox/${boxId}/${command}`;

    this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`Failed to publish to ${topic}:`, err);
      } else {
        console.log(`📤 Sent payload to ${topic}`);
      }
    });
  }
}

export default MqttService.getInstance();