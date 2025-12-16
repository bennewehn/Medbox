import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { firestore } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { History, Send, Clock, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { DeleteModal } from "../components/DeleteModal";

interface PlanItem {
  magazineId: number | string;
  magazineName: string;
  amount: number;
}

export interface DispenseEvent {
  _id: string;
  amounts: PlanItem[];
  type: 'Manual Dispense' | 'Scheduled Dispense';
  status: 'ERROR' | 'COMPLETED';
  timestamp: number;
}

export default function HistoryPage({ user }: { user: User }) {
  const [events, setEvents] = useState<DispenseEvent[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(firestore!, 'history'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ _id: d.id, ...d.data() } as DispenseEvent)));
    });
    return () => unsubscribe();
  }, [user]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
        await deleteDoc(doc(firestore!, 'history', deleteId));
    } catch (error) {
        console.error("Error deleting history:", error);
    } finally {
        setDeleteId(null);
    }
  };

  return (
    <>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Dispensing History</h2>
          <span className="text-sm text-slate-500 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            {events.length} Events
          </span>
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
                const date = new Date(evt.timestamp);
                const activeItems = evt.amounts ? evt.amounts.filter(a => a.amount > 0) : [];
                const isError = evt.status === 'ERROR';

                return (
                  <div key={evt._id} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex flex-col sm:flex-row gap-4 sm:items-center">
                    
                    <div className="flex items-center gap-4 w-full sm:w-48 shrink-0">
                      <div className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ${
                        evt.type === 'Manual Dispense' 
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' 
                          : 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400'
                      }`}>
                        {evt.type === 'Manual Dispense' ? <Send size={20} /> : <Clock size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 leading-tight">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {activeItems.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                              {activeItems.map((item, idx) => (
                                  <div 
                                    key={idx} 
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                  >
                                      <span className="font-medium text-slate-700 dark:text-slate-200">{item.magazineName}</span>
                                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-1.5 rounded-md shadow-sm border border-slate-200 dark:border-slate-700">
                                          x{item.amount}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <span className="text-sm text-slate-400 italic">No items recorded</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700 w-full sm:w-auto">
                      <span className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wide px-2.5 py-1 rounded-md font-bold ${
                        isError 
                          ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                      }`}>
                        {isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                        {evt.status}
                      </span>

                      <button 
                        onClick={() => setDeleteId(evt._id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Delete Entry"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <DeleteModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete}
        title="Delete History Entry?"
        description="This will remove this event from your permanent records."
      />
    </>
  );
}