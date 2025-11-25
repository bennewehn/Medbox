import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { db, appId } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { simulateMqttPublish } from "../services/mqtt";
import type { Magazine, MqttLog } from "../types/index";
import { Wifi, Send } from "lucide-react";

export default function Dashboard({ user }: { user: User }) {
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [mqttLog, setMqttLog] = useState<MqttLog | null>(null);

  useEffect(() => {
    const q = query(collection(db!, 'artifacts', appId, 'users', user.uid, 'magazines'), orderBy('id'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mags = snapshot.docs.map(d => ({ _id: d.id, ...d.data() } as Magazine));
      if (mags.length === 0) seedMagazines(user.uid);
      else setMagazines(mags);
    });
    return () => unsubscribe();
  }, [user]);

  const seedMagazines = async (uid: string) => {
    const defaults = [
      { id: 1, name: 'Morning Mix', type: 'Multivitamin', current: 15, max: 30, color: 'bg-emerald-500' },
      { id: 2, name: 'Pain Relief', type: 'Ibuprofen', current: 8, max: 30, color: 'bg-amber-500' },
      { id: 3, name: 'Night Meds', type: 'Melatonin', current: 25, max: 30, color: 'bg-indigo-500' }
    ];
    for (const mag of defaults) {
      await addDoc(collection(db!, 'artifacts', appId, 'users', uid, 'magazines'), mag);
    }
  };

  const triggerMqtt = async (magazine: Magazine) => {
    const payload = {
      action: 'DISPENSE',
      magazineId: magazine.id,
      timestamp: new Date().toISOString(),
      user: user.email,
      mode: 'MANUAL'
    };

    await simulateMqttPublish(`medbox/devices/${user.uid}/command`, payload);

    setMqttLog({
      topic: `medbox/devices/../command`,
      msg: `DISPENSE MAG ${magazine.id}`,
      time: new Date().toLocaleTimeString()
    });
    setTimeout(() => setMqttLog(null), 4000);

    if (magazine.current > 0) {
      const magRef = doc(db!, 'artifacts', appId, 'users', user.uid, 'magazines', magazine._id);
      await updateDoc(magRef, { current: magazine.current - 1 });
    }

    await addDoc(collection(db!, 'artifacts', appId, 'users', user.uid, 'events'), {
      type: 'Manual Dispense',
      magazineName: magazine.name,
      magazineId: magazine.id,
      scheduledAt: new Date().toISOString(),
      status: 'COMPLETED',
      createdAt: serverTimestamp()
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Live Status</h2>
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
           <Wifi size={14} />
           <span>MQTT Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {magazines.map((mag) => {
          const percentage = Math.min(100, Math.round((mag.current / mag.max) * 100));
          const isLow = percentage < 20;
          
          return (
            <div key={mag.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center relative overflow-hidden">
              <div className="w-full flex justify-between items-start mb-4 z-10">
                <div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-200">{mag.name}</h3>
                  <span className="text-xs text-slate-400 uppercase tracking-wider">{mag.type}</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-slate-800 dark:text-white">{mag.current}</span>
                  <span className="text-xs text-slate-400 block">of {mag.max}</span>
                </div>
              </div>

              <div className="relative w-16 h-40 bg-slate-100 dark:bg-slate-700 rounded-full border-4 border-white dark:border-slate-600 shadow-inner overflow-hidden mb-6 z-10">
                <div 
                  className={`absolute bottom-0 w-full transition-all duration-1000 ${mag.color} ${isLow ? 'animate-pulse' : ''}`}
                  style={{ height: `${percentage}%` }}
                >
                   <div className="w-full h-full opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUpIiBmaWxsLW9wYWNpdHk9IjAuMiIvPjwvc3ZnPg==')]"></div>
                </div>
              </div>

              <button 
                onClick={() => triggerMqtt(mag)}
                disabled={mag.current === 0}
                className="z-10 w-full flex items-center justify-center gap-2 py-3 bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 text-white text-sm font-medium rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/10 dark:shadow-cyan-900/20"
              >
                <Send size={16} />
                Dispense Now
              </button>
            </div>
          );
        })}
      </div>

      {mqttLog && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
          <div className="bg-slate-800 dark:bg-slate-700 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 border-l-4 border-green-400">
            <Wifi className="text-green-400 animate-pulse" />
            <div>
              <p className="text-xs font-mono text-slate-400 mb-1">MQTT: {mqttLog.topic}</p>
              <p className="font-bold">{mqttLog.msg}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}