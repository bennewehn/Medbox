import * as cron from 'node-cron';
import {db} from './firebase';
import { dispense, type Plan} from './dispense';

// Helper: Calculate next occurrence
const getNextOccurrence = (timeStr: string, allowedDays: number[]) => {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Start checking from tomorrow (since we just handled today)
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
            // 1. Query all PENDING plans where scheduledAt is in the past
            const snapshot = await db.collection('plans')
                .where('status', '==', 'PENDING')
                .where('scheduledAt', '<=', now.toISOString())
                .get();

            if (snapshot.empty) return;

            console.log(`[Planner] Found ${snapshot.size} plans to process.`);

            // 2. Process each plan sequentially
            // We use individual updates instead of a batch to ensure the DB stays in sync
            // with the hardware step-by-step.
            for (const doc of snapshot.docs) {
                const plan = doc.data();
                
                try {
                    // --- STEP A: MARK AS DISPENSING (Immediate DB Update) ---
                    // We update this BEFORE the MQTT call so the UI reflects "Dispensing..."
                    await doc.ref.update({ status: 'DISPENSING' });
                    console.log(`   -> Plan ${doc.id} set to DISPENSING`);

                    // --- STEP B: TRIGGER HARDWARE ---
                    await dispense({ amounts: plan.items, timestamp: now.toISOString() }, false);

                    // --- STEP C: FINALIZE STATUS (Immediate DB Update) ---
                    if (plan.type === 'RECURRING' && plan.recurringDays && plan.timeOfDay) {
                        // RESCHEDULE: Find next date and update 'scheduledAt'
                        const nextDate = getNextOccurrence(plan.timeOfDay, plan.recurringDays);
                        
                        if (nextDate) {
                            await doc.ref.update({
                                scheduledAt: nextDate.toISOString(),
                                lastDispensedAt: now.toISOString(),
                                status: 'PENDING' // Reset to PENDING for the next loop
                            });
                            console.log(`   -> Rescheduled recurring plan ${doc.id} to ${nextDate.toISOString()}`);
                        } else {
                            console.warn(`   -> Could not reschedule recurring plan ${doc.id}`);
                        }

                    } else {
                        // ONCE: Mark as completed
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