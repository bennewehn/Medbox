import mqtt, { MqttClient, IClientOptions } from 'mqtt';

// Define a type for the callback function
type MessageHandler = (topic: string, message: Buffer) => void;

class MqttService {
  private client: MqttClient | null = null;
  private static instance: MqttService;
  private messageHandlers: MessageHandler[] = []; // Array to store listeners

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
      
      // 1. Subscribe to the levels topic
      this.client?.subscribe('medbox/+/levels'); 
      this.client?.subscribe('medbox/+/events'); 
      this.client?.subscribe('medbox/+/status'); 
    });

    this.client.on('error', (err) => {
      console.error('❌ MQTT Error:', err);
      this.client?.end();
    });

    // 2. Generic Message Handler
    this.client.on('message', (topic, message) => {
        // Forward message to all registered handlers
        this.messageHandlers.forEach(handler => handler(topic, message));
    });
  }

  // 3. Allow external files to register a listener
  public onMessage(handler: MessageHandler) {
      this.messageHandlers.push(handler);
  }

   public publishAndWaitForAck(boxId: string, command: string, payload: object, ackTopic: string, timeout: number = 15000): Promise<string> {

    return new Promise((resolve, reject) => {

        if (!this.client || !this.client.connected) {
            return reject('MQTT Client not connected.');
        }

        const onMessage = (topic: string, message: Buffer) => {
            if (topic === ackTopic) {
                //  message on this topic is the ack
                this.client?.removeListener('message', onMessage);
                this.client?.unsubscribe(ackTopic);
                resolve(message.toString());
            }
        };

        this.client?.subscribe(ackTopic, (err) => {
            if (err) {
                return reject(`Failed to subscribe to ${ackTopic}`);
            }

            this.client?.on('message', onMessage);
            const topic = `medbox/${boxId}/${command}`;

            this.client?.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
                if (err) {
                    this.client?.removeListener('message', onMessage);
                    this.client?.unsubscribe(ackTopic);
                    reject(`Failed to publish to ${topic}: ${err}`);
                } else {
                    console.log(`📤 Sent payload to ${topic}, waiting for ack on ${ackTopic}`);
                }
            });
        });

        setTimeout(() => {
            this.client?.removeListener('message', onMessage);
            this.client?.unsubscribe(ackTopic);
            reject('Acknowledgment timed out.');
        }, timeout);
    });
  }
}

export default MqttService.getInstance();