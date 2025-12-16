import * as cron from 'node-cron';
import {db} from './firebase';
import { dispense, type Plan} from './dispense';

// calculate next occurrence
const getNextOccurrence = (timeStr: string, allowedDays: number[]) => {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    for(let i = 1; i <= 7; i++) {
        const candidate = new Date(now);
        candidate.setDate(now.getDate() + i);
        candidate.setHours(hours, minutes, 0, 0);

        if (allowedDays.includes(candidate.getDay())) {
            return candidate;
        }
    }
    return null; 
};

export function registerPlanner() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        console.log(`[Planner] Checking for events at ${now.toISOString()}...`);

        try {
            // query all pending plans where scheduledAt is in the past
            const snapshot = await db.collection('plans')
                .where('status', '==', 'PENDING')
                .where('scheduledAt', '<=', now.toISOString())
                .get();

            if (snapshot.empty) return;

            console.log(`[Planner] Found ${snapshot.size} plans to process.`);

            for (const doc of snapshot.docs) {
                const plan = doc.data();
                
                try {
                    await doc.ref.update({ status: 'DISPENSING' });
                    console.log(`   -> Plan ${doc.id} set to DISPENSING`);

                    await dispense({ amounts: plan.items, timestamp: now.toISOString() }, false);

                    if (plan.type === 'RECURRING' && plan.recurringDays && plan.timeOfDay) {
                        const nextDate = getNextOccurrence(plan.timeOfDay, plan.recurringDays);
                        
                        if (nextDate) {
                            await doc.ref.update({
                                scheduledAt: nextDate.toISOString(),
                                lastDispensedAt: now.toISOString(),
                                status: 'PENDING'
                            });
                            console.log(`   -> Rescheduled recurring plan ${doc.id} to ${nextDate.toISOString()}`);
                        } else {
                            console.warn(`   -> Could not reschedule recurring plan ${doc.id}`);
                        }

                    } else {
                        await doc.ref.update({
                            status: 'COMPLETED',
                            dispensedAt: now.toISOString()
                        });
                        console.log(`   -> Marked 'ONCE' plan ${doc.id} as COMPLETED`);
                    }
                } catch (itemError) {
                    console.error(`Error processing individual plan ${doc.id}:`, itemError);
                    await doc.ref.update({ status: 'ERROR' });
                }
            }

        } catch (error) {
            console.error("[Planner] Error querying scheduled events:", error);
        }
    });
}