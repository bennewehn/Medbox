import { Timestamp } from 'firebase/firestore'

export interface Magazine {
  _id: string;
  id: number;
  name: string;
  type: string;
  current: number;
  color: string;
}

export interface DispenseEvent {
  _id: string;
  type: 'Manual Dispense' | 'Scheduled Dispense';
  magazineName: string;
  magazineId: number;
  scheduledAt: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt?: Timestamp;
}

export interface MqttLog {
  topic: string;
  msg: string;
  time: string;
}