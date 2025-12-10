import mqtt, { MqttClient, IClientOptions } from 'mqtt';

type MessageHandler = (topic: string, message: Buffer) => void;

class MqttService {
  private client: MqttClient | null = null;
  private static instance: MqttService;
  private messageHandlers: MessageHandler[] = []; 

  private constructor() {}

  public static getInstance(): MqttService {
    if (!MqttService.instance) {
      MqttService.instance = new MqttService();
    }
    return MqttService.instance;
  }

  public connect(host: string, port: number, username?: string, password?: string): void {
    const connectUrl = `mqtt://${host}:${port}`;

    const options: IClientOptions = {
      clean: true,
      connectTimeout: 7000, 
      username: username,
      password: password,
      reconnectPeriod: 1000, 
    };

    console.log(`Connecting to MQTT Broker at ${connectUrl}...`);
    
    this.client = mqtt.connect(connectUrl, options);

    this.client.on('connect', () => {
      console.log('✅ MQTT Connected');
      
      // --- FIX 1: Subscribe Globally ---
      // Subscribe to ALL potential feedback topics here once.
      // This prevents the "Unsubscribe Race Condition".
      this.client?.subscribe('medbox/+/levels'); 
      this.client?.subscribe('medbox/+/events'); 
      this.client?.subscribe('medbox/+/status'); 
      this.client?.subscribe('medbox/+/dispensed'); // <--- CRITICAL ADDITION
    });

    this.client.on('error', (err) => {
      console.error('❌ MQTT Error:', err);
      this.client?.end();
    });

    // Global Message Handler
    this.client.on('message', (topic, message) => {
        this.messageHandlers.forEach(handler => handler(topic, message));
    });
  }

  public onMessage(handler: MessageHandler) {
      this.messageHandlers.push(handler);
  }

   public publishAndWaitForAck(boxId: string, command: string, payload: object, ackTopic: string, timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {

        if (!this.client || !this.client.connected) {
            return reject('MQTT Client not connected.');
        }

        // --- FIX 2: No Subscribe/Unsubscribe here ---
        // We assume we are already subscribed globally.
        // We simply attach a TEMPORARY listener for the specific Ack.

        const onMessage = (topic: string, message: Buffer) => {
            if (topic === ackTopic) {
                // Success! Clean up this specific listener
                this.client?.removeListener('message', onMessage);
                resolve(message.toString());
            }
        };

        // Attach the listener
        this.client.on('message', onMessage);

        const topic = `medbox/${boxId}/${command}`;

        // Publish the command
        this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
            if (err) {
                // If send fails, clean up immediately
                this.client?.removeListener('message', onMessage);
                reject(`Failed to publish to ${topic}: ${err}`);
            } else {
                console.log(`📤 Sent payload to ${topic}, waiting for ack on ${ackTopic}`);
            }
        });

        // Timeout Logic
        setTimeout(() => {
            // Check if the listener is still attached (meaning we haven't resolved yet)
            // Note: In a perfect world, we'd check if it's still there, 
            // but removeListener is safe to call even if already removed.
            this.client?.removeListener('message', onMessage);
            reject('Acknowledgment timed out.');
        }, timeout);
    });
  }
}

export default MqttService.getInstance();