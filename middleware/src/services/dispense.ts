import mqttService from './mqttService';
import { db } from './firebase';

interface PlanItem {
  magazineId: number;
  magazineName: string;
  amount: number;
}

export interface Plan{
  amounts: PlanItem[];
  timestamp: string;
}

interface DispenseHistoryItem {
    timestamp: number;
    amounts: any;
    status: 'COMPLETED' | 'ERROR' | 'BUSY';
    type: string;
}

export async function dispense(plan: Plan, manual: boolean = true) {
    console.log(`STARTING DISPENSE: ${JSON.stringify(plan)}`);

    const success = await mqttService.sendDispenseCommand("01", plan);
    
    console.log("Dispense result:", success ? "SUCCESS" : "FAILED");

    // save history
    const item: DispenseHistoryItem = {
        timestamp: Date.now(),
        amounts: plan.amounts,
        status: success ? 'COMPLETED' : 'ERROR',
        type: manual ? 'Manual Dispense' : 'Scheduled Dispense'
    };

    try {
        await db.collection('history').add(item);
        console.log("History saved.");
    } catch (error) {
        console.error("Failed to save history:", error);
    }
}

