import { Send, Loader2 } from 'lucide-react';
import type { Magazine } from '../types';
import { useEffect, useState } from 'react';
import { ref, onValue, off } from "firebase/database";
import { db } from "../services/firebase";

interface PillMagazineProps {
  magazine: Magazine;
  onDispense: (magazine: Magazine) => Promise<string>;
}

export default function PillMagazine({ magazine, onDispense}: PillMagazineProps) {
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCommandId) return;

    const commandRef = ref(db, `dispense_commands/${activeCommandId}`);

    onValue(commandRef, (snapshot) => {
      if (!snapshot.exists()) {
        setActiveCommandId(null); 
      }
    });

    return () => off(commandRef);
  }, [activeCommandId]);

  const handleClick = async () => {
    // Start the process
    const cmdId = await onDispense(magazine);
    // Lock the UI
    setActiveCommandId(cmdId);
  };

  const percentage = Math.min(100, Math.round((magazine.current / 200) * 100));
  const isLow = percentage < 20;

  const isBusy = !!activeCommandId;

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center relative overflow-hidden">
      <div className="w-full flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="font-bold text-slate-700 dark:text-slate-200">{magazine.name}</h3>
          <span className="text-xs text-slate-400 uppercase tracking-wider">{magazine.type}</span>
        </div>
        <div className="text-right">
          <span className="text-2xl font-mono font-bold text-slate-800 dark:text-white">{magazine.current}</span>
          <span className="text-xs text-slate-400 block">of {200}</span>
        </div>
      </div>

      <div className="relative w-16 h-40 bg-slate-100 dark:bg-slate-700 rounded-full border-4 border-white dark:border-slate-600 shadow-inner overflow-hidden mb-6 z-10">
        <div
          className={`absolute bottom-0 w-full transition-all duration-1000 ${magazine.color} ${isLow ? 'animate-pulse' : ''}`}
          style={{ height: `${percentage}%` }}
        >
          <div className="w-full h-full opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUpIiBmaWxsLW9wYWNpdHk9IjAuMiIvPjwvc3ZnPg==')]"></div>
        </div>
      </div>

       <button
        onClick={handleClick}
        disabled={isBusy}
        className="z-10 w-full flex items-center justify-center gap-2 py-3 
                   bg-slate-900 dark:bg-cyan-600 text-white text-sm font-medium rounded-xl 
                   shadow-lg shadow-slate-900/10 dark:shadow-cyan-900/20
                   transition-all active:scale-95 
                   hover:bg-slate-800 dark:hover:bg-cyan-500
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                   disabled:hover:bg-slate-900 disabled:dark:hover:bg-cyan-600"
      >
        {isBusy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <Send size={16} />
            <span>Dispense Now</span>
          </>
        )}
      </button> 
    </div>
  );
}