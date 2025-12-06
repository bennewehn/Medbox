export interface Magazine {
  _id?: string;
  id: number; 
  name: string;
  type: string;
  sensorKey: string;
  color: string;
  minDist: number; // Distance in mm when FULL
  maxDist: number; // Distance in mm when EMPTY
}