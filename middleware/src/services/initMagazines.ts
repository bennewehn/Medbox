import { db } from './firebase';

const defaults = [
  { id: 1, name: 'Morning Mix', type: 'Multivitamin', current: 15, color: 'bg-emerald-500' },
  { id: 2, name: 'Pain Relief', type: 'Ibuprofen', current: 8, color: 'bg-amber-500' }
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