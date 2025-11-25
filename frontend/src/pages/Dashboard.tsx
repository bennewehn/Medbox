import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { ref, push } from "firebase/database";
import { db, firestore } from "../services/firebase";
import { collection, query, orderBy, onSnapshot} from "firebase/firestore";
import type { Magazine } from "../types/index";
import PillMagazine from "../components/PillMagazine";

export default function Dashboard({ user }: { user: User }) {
  const [magazines, setMagazines] = useState<Magazine[]>([{id: 1, _id:"tets", name: 'Morning Mix', type: 'Multivitamin', current: 20, color: 'bg-emerald-500'}]);


  useEffect(() => {
    const q = query(collection(firestore!, 'magazines'), orderBy('id'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mags = snapshot.docs.map(d => ({ _id: d.id, ...d.data() } as Magazine));
      setMagazines(mags);
    });
    return () => unsubscribe();
  }, [user]);

  const triggerDispense = async (magazine: Magazine): Promise<string> => {
    const commandRef = ref(db, 'dispense_commands');

    const newCommandRef = await push(commandRef, {
        amounts: magazines.map(m => m === magazine ? 1 : 0),
        timestamp: Date.now(),
        userId: user.uid,
        userEmail: user.email
      });
      console.log("Command sent with ID:", newCommandRef.key);

      return newCommandRef.key as string;
  };

  return (
    <div className="space-y-8">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {magazines.map((mag) => (
          <PillMagazine
            key={mag.id}
            magazine={mag}
            onDispense={triggerDispense}
            />
        ))}
      </div>
     
    </div>
  );
}