import { rtdb } from './firebase';

export const handleSensorData = async (topic: string, message: Buffer) => {
    // Topic format: medbox/{boxId}/levels
    // Regex to extract the boxId (the part between medbox/ and /levels)
    const topicMatch = topic.match(/^medbox\/([^\/]+)\/levels$/);

    if (topicMatch) {
        const boxId = topicMatch[1];
        
        try {
            // Parse the JSON payload from ESP32
            // Expected: {"mag1_mm": 45, "mag2_mm": 120}
            const payload = JSON.parse(message.toString());

            console.log(`📏 Level update for Box ${boxId}:`, payload);

            // Save to Firebase Realtime Database
            // Path: boxes/01/levels
            await rtdb.ref(`boxes/${boxId}/levels`).set({
                ...payload,
                lastUpdated: Date.now() // Good for UI to show "Last synced: 2s ago"
            });

        } catch (error) {
            console.error("Failed to parse sensor data JSON:", error);
        }
    }
};