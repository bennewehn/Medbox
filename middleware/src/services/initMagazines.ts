import { db } from './firebase';
import {type Magazine } from '../../../types';

const defaults: Magazine[] = [
  { id: 1, name: 'Morning Mix', type: 'Multivitamin', maxDist: 150, minDist: 30, sensorKey: 'mag1_mm', color: 'bg-emerald-500' },
  { id: 2, name: 'Pain Relief', type: 'Ibuprofen', maxDist: 150, minDist: 30, sensorKey: 'mag2_mm', color: 'bg-amber-500' }
];

export const initializeMagazines = async () => {
  try {
    const collectionRef = db.collection('magazines');
    
    // 1. Check if ANY document exists
    const snapshot = await collectionRef.limit(1).get();

    if (!snapshot.empty) {
      console.log('✔ Magazines already initialized.');
      return;
    }

    console.log('Magazines collection empty. Seeding defaults...');

    const batch = db.batch();

    defaults.forEach((item) => {
      const docRef = collectionRef.doc(String(item.id));
      batch.set(docRef, item);
    });

    await batch.commit();
    console.log('✔ Default magazines added to Firestore.');

  } catch (error) {
    console.error('✘ Error initializing magazines:', error);
  }
};