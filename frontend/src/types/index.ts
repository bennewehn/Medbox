interface PlanItem {
  magazineId: number | string;
  magazineName: string;
  amount: number;
}

export interface DispenseEvent {
  _id: string;
  amounts: PlanItem[],
  type: 'Manual Dispense' | 'Scheduled Dispense';
  status: 'ERROR' | 'COMPLETED';
  timestamp: number;
}
