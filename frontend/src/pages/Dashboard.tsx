import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { ref, push, onValue } from "firebase/database"; // Added onValue
import { db, firestore } from "../services/firebase";
import { collection, query, orderBy, onSnapshot} from "firebase/firestore";
import { Wifi, WifiOff } from "lucide-react"; // Import Icons
import type { Magazine } from "../../../types";
import PillMagazine from "../components/PillMagazine";

export default function Dashboard({ user }: { user: User }) {
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [isBoxOnline, setIsBoxOnline] = useState<boolean>(false); // Global Status
  const BOX_ID = "01";

  // 1. Fetch Magazines (Firestore)
  useEffect(() => {
    const q = query(collection(firestore!, 'magazines'), orderBy('id'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mags = snapshot.docs.map(d => ({ _id: d.id, ...d.data() } as Magazine));
      setMagazines(mags);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Listen for Box Online Status (Realtime DB)
  useEffect(() => {
    const statusRef = ref(db, `boxes/${BOX_ID}/status/online`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      setIsBoxOnline(!!status); // Convert to true/false
    });

    return () => unsubscribe();
  }, []);

  const triggerDispense = async (magazine: Magazine): Promise<string> => {
    // Prevent function execution if offline (double safety)
    if (!isBoxOnline) return "";

    const commandRef = ref(db, 'dispense_commands');
    const newCommandRef = await push(commandRef, {
        amounts: magazines.map(m => ({magazineId: m.id, magazineName: m.name, amount: m === magazine ? 1 : 0})),
        timestamp: Date.now(),
      });
      return newCommandRef.key as string;
  };

  return (
    <div className="space-y-8">
      
      {/* --- DASHBOARD HEADER & STATUS --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pill Dispenser</h1>
            <p className="text-slate-400 text-sm">Manage your daily medication</p>
        </div>

        {/* Status Indicator Badge */}
        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-colors duration-300
            ${isBoxOnline 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900 dark:text-emerald-400' 
                : 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900 dark:text-red-400'
            }`}>
            
            <div className={`p-2 rounded-full ${isBoxOnline ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-red-200 dark:bg-red-800'}`}>
                {isBoxOnline ? <Wifi size={20} strokeWidth={2.5} /> : <WifiOff size={20} strokeWidth={2.5} />}
            </div>
            
            <div>
                <span className="block text-xs font-bold uppercase tracking-wider opacity-70">System Status</span>
                <span className="font-bold">{isBoxOnline ? "Connected" : "Offline"}</span>
            </div>
        </div>
      </div>

      {/* --- MAGAZINE GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {magazines.map((mag) => (
          <PillMagazine
            key={mag.id}
            boxId={BOX_ID}
            magazine={mag}
            isBoxOnline={isBoxOnline} 
            onDispense={triggerDispense}
            />
        ))}
      </div>
      
    </div>
  );
}