import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { type DispenseEvent } from "../types";
import { db, appId, firestore } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { History, Send, Clock, Trash2 } from "lucide-react";

export default function HistoryPage({ user }: { user: User }) {
  const [events, setEvents] = useState<DispenseEvent[]>([]);

  useEffect(() => {
    const q = query(collection(firestore!, 'artifacts', appId, 'users', user.uid, 'events'), orderBy('scheduledAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ _id: d.id, ...d.data() } as DispenseEvent)));
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Dispensing History</h2>
        <span className="text-sm text-slate-500">{events.length} Total Events</span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {events.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <History size={48} className="mx-auto mb-4 opacity-20" />
            <p>No history recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {events.map((evt) => {
              const date = new Date(evt.scheduledAt);
              const isPast = date < new Date();
              
              return (
                <div key={evt._id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    evt.type === 'Manual Dispense' 
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' 
                      : 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400'
                  }`}>
                    {evt.type === 'Manual Dispense' ? <Send size={18} /> : <Clock size={18} />}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{evt.magazineName}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{evt.type}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-mono text-slate-600 dark:text-slate-300">
                      {date.toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-400">
                      {date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 ml-4">
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                      isPast 
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' 
                        : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {isPast ? 'COMPLETED' : 'PENDING'}
                    </span>
                    <button 
                      onClick={() => deleteDoc(doc(firestore!, 'artifacts', appId, 'users', user.uid, 'events', evt._id))}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}