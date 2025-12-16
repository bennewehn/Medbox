import mqtt, { MqttClient, IClientOptions } from 'mqtt';

type MessageHandler = (topic: string, message: Buffer) => void;

class MqttService {
  private client: MqttClient | null = null;
  private static instance: MqttService;
  private messageHandlers: MessageHandler[] = [];

  private dispenseResolver: ((success: boolean) => void) | null = null;
  private isDispensing: boolean = false;
  private dispenseTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): MqttService {
    if (!MqttService.instance) {
      MqttService.instance = new MqttService();
    }
    return MqttService.instance;
  }

  public connect(host: string, port: number, username?: string, password?: string): void {
    const connectUrl = `mqtt://${host}:${port}`;
    console.log(`Connecting to MQTT Broker at ${connectUrl}...`);
    
    this.client = mqtt.connect(connectUrl, {
      clean: true,
      connectTimeout: 7000,
      username,
      password,
      reconnectPeriod: 1000,
    });

    this.client.on('connect', () => {
      console.log('✅ MQTT Connected');
      
      this.client?.subscribe('medbox/+/levels'); 
      this.client?.subscribe('medbox/+/events'); 
      this.client?.subscribe('medbox/+/status'); 
      this.client?.subscribe('medbox/+/dispensed'); 
    });

    this.client.on('error', (err) => {
      console.error('❌ MQTT Error:', err);
    });

    this.client.on('message', (topic, message) => {
      const msgStr = message.toString();

      if (topic.endsWith('/dispensed')) {
        this.handleDispenseAck(msgStr);
      }

      this.messageHandlers.forEach(handler => handler(topic, message));
    });
  }

  private handleDispenseAck(message: string) {
    if (this.dispenseResolver) {
        console.log(`📨 Received Dispense ACK: ${message}`);
        
        const isSuccess = message.includes('true') || message.includes('success');

        this.dispenseResolver(isSuccess);
        this.cleanupDispense();
    }
  }

  private cleanupDispense() {
    this.dispenseResolver = null;
    this.isDispensing = false;
    if (this.dispenseTimeout) {
        clearTimeout(this.dispenseTimeout);
        this.dispenseTimeout = null;
    }
  }

  public async sendDispenseCommand(boxId: string, plan: object): Promise<boolean> {
    if (!this.client || !this.client.connected) {
        console.error("Cannot dispense: MQTT not connected");
        return false;
    }

    if (this.isDispensing) {
        console.warn("BUSY: Dispense already in progress. Ignoring new command.");
        return false; 
    }

    return new Promise((resolve) => {
        this.isDispensing = true;
        this.dispenseResolver = resolve;

        const topic = `medbox/${boxId}/dispense`;
        
        this.dispenseTimeout = setTimeout(() => {
            console.error("Dispense Timed Out (No ACK received)");
            if (this.dispenseResolver) resolve(false); 
            this.cleanupDispense();
        }, 30000);

        this.client?.publish(topic, JSON.stringify(plan), { qos: 1 }, (err) => {
            if (err) {
                console.error("Failed to publish dispense command");
                resolve(false);
                this.cleanupDispense();
            } else {
                console.log(`Command Sent to ${topic}, waiting for ACK...`);
            }
        });
    });
  }

  public onMessage(handler: MessageHandler) {
      this.messageHandlers.push(handler);
  }
}

export default MqttService.getInstance();