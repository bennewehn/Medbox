import { rtdb } from './firebase';

export const handleStatusUpdate = async (topic: string, message: Buffer) => {
    // Topic: medbox/{boxId}/status
    const topicMatch = topic.match(/^medbox\/([^\/]+)\/status$/);

    if (topicMatch) {
        const boxId = topicMatch[1];
        const status = message.toString(); // "online" or "offline"
        
        console.log(`Box ${boxId} is now ${status.toUpperCase()}`);

        try {
            // Save to Firebase: boxes/01/status
            await rtdb.ref(`boxes/${boxId}/status`).set({
                online: status === 'online',
                lastChanged: Date.now() 
            });
        } catch (error) {
            console.error("Failed to update status in DB:", error);
        }
    }
};