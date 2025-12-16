import { rtdb } from './firebase';

export const handleSensorData = async (topic: string, message: Buffer) => {
    // Topic format: medbox/{boxId}/levels
    const topicMatch = topic.match(/^medbox\/([^\/]+)\/levels$/);

    if (topicMatch) {
        const boxId = topicMatch[1];
        
        try {
            const payload = JSON.parse(message.toString());

            console.log(`Level update for Box ${boxId}:`, payload);

            // Save to Firebase Realtime Database
            await rtdb.ref(`boxes/${boxId}/levels`).set({
                ...payload,
                lastUpdated: Date.now()
            });

        } catch (error) {
            console.error("Failed to parse sensor data JSON:", error);
        }
    }
};