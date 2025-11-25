import React, { useState, useEffect } from 'react';
import { type User } from 'firebase/auth';
import type { Magazine } from '../types';
import { db, appId } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Calendar, Activity, Plus } from 'lucide-react';

function SchedulePage({ user }: { user: User }) {
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [selectedMag, setSelectedMag] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const q = query(collection(db!, 'artifacts', appId, 'users', user.uid, 'magazines'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMagazines(snap.docs.map(d => ({ _id: d.id, ...d.data() } as Magazine)));
    });
    return () => unsubscribe();
  }, [user]);

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMag || !time) return;
    setLoading(true);

    const today = new Date();
    const [hours, minutes] = time.split(':');
    const scheduledDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes));
    
    if (scheduledDate < new Date()) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    const magazine = magazines.find(m => m.id.toString() === selectedMag);

    await addDoc(collection(db!, 'artifacts', appId, 'users', user.uid, 'events'), {
      type: 'Scheduled Dispense',
      magazineName: magazine ? magazine.name : 'Unknown',
      magazineId: magazine ? magazine.id : 0,
      scheduledAt: scheduledDate.toISOString(),
      status: 'PENDING',
      createdAt: serverTimestamp()
    });

    setSuccessMsg('Plan added successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
    setTime('');
    setSelectedMag('');
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Planner</h2>
      
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-4 mb-8 p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl text-cyan-800 dark:text-cyan-300">
          <Calendar className="h-8 w-8" />
          <p className="text-sm leading-relaxed">
            Schedule a pill dispensing event. The system will automatically trigger the MQTT command at the specified time.
          </p>
        </div>

        <form onSubmit={handlePlan} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Medication</label>
            <div className="relative">
              <select 
                value={selectedMag}
                onChange={(e) => setSelectedMag(e.target.value)}
                className="w-full appearance-none px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-700 dark:text-slate-200 transition-all"
                required
              >
                <option value="">-- Choose from Magazines --</option>
                {magazines.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.type}) - {m.current} left</option>
                ))}
              </select>
              <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
                <Activity size={16} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Time of Dispense</label>
            <input 
              type="time" 
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-700 dark:text-slate-200 [&::-webkit-calendar-picker-indicator]:dark:invert"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
          >
            {loading ? 'Scheduling...' : <><Plus size={20} /> Add to Schedule</>}
          </button>
        </form>

        {successMsg && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-center text-sm font-medium animate-fade-in">
            {successMsg}
          </div>
        )}
      </div>
    </div>
  );
}

export default SchedulePage;
