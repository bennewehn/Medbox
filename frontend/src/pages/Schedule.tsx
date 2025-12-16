import React, { useState, useEffect } from 'react';
import { type User } from 'firebase/auth';
import type { Magazine } from '../../../types';
import { firestore } from '../services/firebase';
import { DeleteModal } from '../components/DeleteModal';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { 
  Calendar, 
  Plus, 
  Clock, 
  Pill, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Repeat,
  CalendarDays,
  Loader2
} from 'lucide-react';

interface PlanItem {
  magazineId: number | string;
  magazineName: string;
  amount: number;
}

interface Plan {
  id: string;
  scheduledAt: string; 
  items?: PlanItem[];
  magazineName?: string;
  status: string;
  type: 'ONCE' | 'RECURRING';
  recurringDays?: number[];
}

// Helper for days of week
const DAYS = [
    { label: 'S', value: 0 },
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
];

function SchedulePage({ user }: { user: User }) {
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  
  // Selection State
  const [selections, setSelections] = useState<Record<string, number>>({});
  
  // Schedule Form State
  const [scheduleType, setScheduleType] = useState<'ONCE' | 'RECURRING'>('ONCE');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [selectedDays, setSelectedDays] = useState<number[]>([]); 
  const [time, setTime] = useState('');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  // Fetch Magazines
  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, 'magazines'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMagazines(snap.docs.map(d => ({ _id: d.id, ...d.data() } as Magazine)));
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Scheduled Plans
  useEffect(() => {
    if (!firestore) return;
    const q = query(
      collection(firestore, 'plans'), 
      where('status', 'in', ['PENDING', 'DISPENSING']),
      orderBy('scheduledAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetchedPlans = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as Plan));
      setPlans(fetchedPlans);
    });
    return () => unsubscribe();
  }, [user]);

  // Helpers
  const toggleSelection = (magId: string | number) => {
    const idStr = magId.toString();
    setSelections(prev => {
      const newSelections = { ...prev };
      if (newSelections[idStr]) delete newSelections[idStr];
      else newSelections[idStr] = 1;
      return newSelections;
    });
  };

  const handleAmountChange = (magId: string | number, amount: string) => {
    const val = parseInt(amount);
    if (val < 1) return;
    setSelections(prev => ({ ...prev, [magId.toString()]: val }));
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => 
        prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex) 
        : [...prev, dayIndex].sort()
    );
  };

  const getDayName = (dayIndex: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex];

  // find the next occurrence of a specific time on specific days
  const getNextOccurrence = (timeStr: string, allowedDays: number[]) => {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // check next 7 days
    for(let i = 0; i < 7; i++) {
        const candidate = new Date(now);
        candidate.setDate(now.getDate() + i);
        candidate.setHours(hours, minutes, 0, 0);

        // ff it is today but time passed: skip
        if (i === 0 && candidate < now) continue;

        if (allowedDays.includes(candidate.getDay())) {
            return candidate;
        }
    }
    return null;
  };

 const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedIds = Object.keys(selections);
    
    // input validation
    if (selectedIds.length === 0) {
        setErrorMsg("Please select at least one medication.");
        return;
    }
    if (!time) {
        setErrorMsg("Please set a time.");
        return;
    }
    if (scheduleType === 'RECURRING' && selectedDays.length === 0) {
        setErrorMsg("Please select at least one day for recurrence.");
        return;
    }

    setErrorMsg('');
    setLoading(true);

    let finalDate: Date;
    const [hours, minutes] = time.split(':').map(Number);

    // date calculation and past validation
    if (scheduleType === 'ONCE') {
        finalDate = new Date(selectedDate);
        finalDate.setHours(hours, minutes, 0, 0);
        
        // is the date in the past?
        if (finalDate < new Date()) {
             setErrorMsg("You cannot schedule a dispense in the past.");
             setLoading(false);
             return;
        }

    } else {
        // recurring logic
        const nextDate = getNextOccurrence(time, selectedDays);
        if (!nextDate) {
            setErrorMsg("Could not calculate next occurrence.");
            setLoading(false);
            return;
        }
        finalDate = nextDate;
    }

    // prepare Items
    const itemsToDispense: PlanItem[] = selectedIds.map(id => {
        const mag = magazines.find(m => m.id.toString() === id);
        return {
            magazineId: mag ? mag.id : id,
            magazineName: mag ? mag.name : 'Unknown',
            amount: selections[id]
        };
    });

    // saave to Firestore
    try {
        await addDoc(collection(firestore!, 'plans'), {
          type: scheduleType,
          items: itemsToDispense,
          scheduledAt: finalDate.toISOString(),
          status: 'PENDING',
          createdAt: serverTimestamp(),
          recurringDays: scheduleType === 'RECURRING' ? selectedDays : null,
          timeOfDay: time, 
        });
    
        setSuccessMsg('Schedule created!');
        setTimeout(() => setSuccessMsg(''), 3000);
        
        // Reset Form
        setTime('');
        setSelections({});
        setSelectedDays([]);
        setScheduleType('ONCE');
    } catch (err) {
        console.error("Error scheduling:", err);
        setErrorMsg("Failed to save schedule.");
    } finally {
        setLoading(false);
    }
  }; 

  const confirmDelete = async () => {
    if (!planToDelete) return;
    try {
      await deleteDoc(doc(firestore!, 'plans', planToDelete));
      setPlanToDelete(null);
    } catch (error) {
      console.error("Error deleting plan:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
      
      {/* scheduler form */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">New Schedule</h2>
        
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          
          {/* schedule type tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-6">
            <button
                type="button"
                onClick={() => setScheduleType('ONCE')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                    scheduleType === 'ONCE' 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
            >
                <CalendarDays size={16} /> One Time
            </button>
            <button
                type="button"
                onClick={() => setScheduleType('RECURRING')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                    scheduleType === 'RECURRING' 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
            >
                <Repeat size={16} /> Recurring
            </button>
          </div>

          <form onSubmit={handlePlan} className="space-y-6">
            
            {/* medications list */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Select Medications
              </label>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {magazines.map(m => {
                    const isSelected = !!selections[m.id.toString()];
                    return (
                        <div 
                            key={m.id} 
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                isSelected 
                                ? 'bg-cyan-50 border-cyan-500/50 dark:bg-cyan-900/20 dark:border-cyan-500/50' 
                                : 'bg-slate-50 border-transparent dark:bg-slate-900'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelection(m.id)}
                                    className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500 border-gray-300"
                                />
                                <span className="font-medium text-slate-700 dark:text-slate-200">{m.name}</span>
                            </div>

                            {isSelected && (
                                <div className="flex items-center gap-2 animate-in fade-in">
                                    <span className="text-xs text-slate-400">Qty:</span>
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={selections[m.id.toString()]}
                                        onChange={(e) => handleAmountChange(m.id, e.target.value)}
                                        className="w-14 px-1 py-1 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {scheduleType === 'ONCE' ? (
                    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Date</label>
        <div className="relative">
            <input 
                type="date"
                value={selectedDate}
                onClick={(e) => {
                    try { if ('showPicker' in HTMLInputElement.prototype) e.currentTarget.showPicker(); } catch (err) {}
                }}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-700 dark:text-slate-200 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:left-0"
                required
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Calendar size={20} />
            </div>
        </div>
     </div> 
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Repeat On</label>
                        <div className="flex justify-between gap-1">
                            {DAYS.map((d) => {
                                const active = selectedDays.includes(d.value);
                                return (
                                    <button
                                        key={d.value}
                                        type="button"
                                        onClick={() => toggleDay(d.value)}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                            active 
                                            ? 'bg-cyan-600 text-white shadow-md scale-105' 
                                            : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        {d.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* time selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Time</label>
                    <div className="relative">
                        <input 
                            type="time" 
                            value={time}
                            onClick={(e) => {
                                try { if ('showPicker' in HTMLInputElement.prototype) e.currentTarget.showPicker(); } catch (err) {}
                            }}
                            onChange={(e) => setTime(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-700 dark:text-slate-200 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:left-0"
                            required
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <Clock size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium animate-in fade-in flex items-center justify-center gap-2">
                 <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : <><Plus size={20} /> Add Schedule</>}
            </button>
          </form>

          {successMsg && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-center text-sm font-medium animate-fade-in flex items-center justify-center gap-2">
              <CheckCircle2 size={16} /> {successMsg}
            </div>
          )}
        </div>
      </div>

    {/* view list */}
      <div className="flex flex-col h-full">
         <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Upcoming Schedule</h2>
         
         <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {plans.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    <Calendar className="h-10 w-10 mb-2 opacity-50" />
                    <p>No upcoming plans</p>
                </div>
            ) : (
                plans.map(plan => {
                    const date = new Date(plan.scheduledAt);
                    const isRecurring = plan.type === 'RECURRING';
                    const isDispensing = plan.status === 'DISPENSING'; 

                    return (
                        <div key={plan.id} className={`bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border relative group transition-colors ${isDispensing ? 'border-amber-300 dark:border-amber-700 ring-2 ring-amber-100 dark:ring-amber-900/30' : 'border-slate-100 dark:border-slate-700'}`}>
                            
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${
                                        isRecurring 
                                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                                        : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                    }`}>
                                        {isRecurring ? <Repeat size={20} /> : <CalendarDays size={20} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg text-slate-800 dark:text-white leading-none">
                                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <div className="text-xs font-medium uppercase tracking-wide mt-1.5 flex gap-1">
                                            {isRecurring && plan.recurringDays ? (
                                                <span className="text-purple-600 dark:text-purple-400">
                                                    Every {plan.recurringDays.map(d => getDayName(d)).join(', ')}
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">
                                                    {date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric'})}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="h-px bg-slate-100 dark:bg-slate-700 mb-3" />

                            <div className="space-y-2">
                                {plan.items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                            <Pill size={14} className="opacity-50" />
                                            <span>{item.magazineName}</span>
                                        </div>
                                        <span className="font-mono font-medium bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 text-xs">
                                            x{item.amount}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {isDispensing ? (
                                <div className="absolute top-4 right-4">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse border border-amber-200 dark:border-amber-800">
                                        <Loader2 size={12} className="animate-spin" />
                                        Dispensing...
                                    </span>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setPlanToDelete(plan.id)}
                                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    )
                })
            )}
         </div>
      </div> 

      <DeleteModal 
        isOpen={!!planToDelete} 
        onClose={() => setPlanToDelete(null)} 
        onConfirm={confirmDelete}
        title="Cancel Schedule?"
        description="Are you sure? This will remove the schedule from your list."
      />
    </div>
  );
}

export default SchedulePage;