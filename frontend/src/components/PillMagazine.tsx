import { Send, Loader2, Settings, Save, X, WifiOff } from 'lucide-react';
import type { Magazine } from '../../../types';
import { useEffect, useState } from 'react';
import { ref, onValue } from "firebase/database";
import { doc, updateDoc } from "firebase/firestore";
import { db, firestore } from "../services/firebase";

interface PillMagazineProps {
  magazine: Magazine;
  boxId: string;
  isBoxOnline: boolean;
  onDispense: (magazine: Magazine) => Promise<string>;
}

export default function PillMagazine({ magazine, boxId, isBoxOnline, onDispense }: PillMagazineProps) {
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  
  // live data states
  const [currentDistance, setCurrentDistance] = useState<number>(0);
  const [calculatedPercentage, setCalculatedPercentage] = useState<number>(0);

  // settings states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState({
    minDist: magazine.minDist || 30,
    maxDist: magazine.maxDist || 150
  });

  // listen for dispense command status
  useEffect(() => {
    if (!activeCommandId) return;
    const commandRef = ref(db, `dispense_commands/${activeCommandId}`);
    const unsubscribe = onValue(commandRef, (snapshot) => {
      if (!snapshot.exists()) setActiveCommandId(null); 
    });
    return () => unsubscribe();
  }, [activeCommandId]);

  // liisten for live sensor data
  useEffect(() => {
    if (!isBoxOnline) return; 

    const sensorRef = ref(db, `boxes/${boxId}/levels`);
    const unsubscribe = onValue(sensorRef, (snapshot) => {
      const data = snapshot.val();
      if (data && magazine.sensorKey) {
        const dist = data[magazine.sensorKey];
        if (dist !== undefined && dist !== -1) {
          setCurrentDistance(dist);
        }
      }
    });
    return () => unsubscribe();
  }, [boxId, magazine.sensorKey, isBoxOnline]);

  // calculate percentage
  useEffect(() => {
    const { minDist, maxDist } = config;
    if (maxDist <= minDist) {
        setCalculatedPercentage(0);
        return;
    }
    let pct = ((maxDist - currentDistance) / (maxDist - minDist)) * 100;
    pct = Math.min(Math.max(pct, 0), 100);
    setCalculatedPercentage(Math.round(pct));
  }, [currentDistance, config]);

  // save calibration
  const handleSaveSettings = async () => {
    try {
        const magRef = doc(firestore!, 'magazines', magazine._id!);
        await updateDoc(magRef, {
            minDist: Number(config.minDist),
            maxDist: Number(config.maxDist)
        });
        setIsSettingsOpen(false);
    } catch (e) {
        console.error("Error saving settings", e);
    }
  };

  const isLow = calculatedPercentage < 20;
  const isBusy = !!activeCommandId;
  const isDisabled = isBusy || !isBoxOnline;

  // render settings 
  if (isSettingsOpen) {
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 min-h-[320px] flex flex-col justify-between relative">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">Calibration</h3>
                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
            </div>
             <div className="space-y-3">
            <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Full Distance (mm)</label>
                <input type="number" value={config.minDist} onChange={(e) => setConfig({...config, minDist: Number(e.target.value)})} className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"/>
            </div>
            <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Empty Distance (mm)</label>
                <input type="number" value={config.maxDist} onChange={(e) => setConfig({...config, maxDist: Number(e.target.value)})} className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"/>
            </div>
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <span className="text-xs text-slate-500">Live Reading:</span>
                <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">{currentDistance} mm</span>
            </div>
        </div>
        <button onClick={handleSaveSettings} className="w-full mt-auto flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium text-sm"><Save size={16} /> Save</button>
        </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800 p-5 pb-6 rounded-2xl shadow-sm border 
                     ${isBoxOnline ? 'border-slate-100 dark:border-slate-700' : 'border-red-100 dark:border-red-900/30 bg-slate-50 dark:bg-slate-800/50'} 
                     flex flex-col items-center relative min-h-[320px] transition-colors duration-500`}>
      
      <button 
        onClick={() => setIsSettingsOpen(true)}
        disabled={!isBoxOnline}
        className="absolute top-3 right-3 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors z-10 disabled:opacity-0"
      >
        <Settings size={16} />
      </button>

      <div className="w-full flex justify-between items-start mb-2 z-10 pr-8">
        <div>
          <h3 className={`font-bold ${isBoxOnline ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>{magazine.name}</h3>
          <span className="text-xs text-slate-400 uppercase tracking-wider">{magazine.type}</span>
        </div>
        
        <div className="text-right shrink-0">
          <span className={`text-2xl font-mono font-bold ${isBoxOnline ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
            {isBoxOnline ? `${calculatedPercentage}%` : '--'}
          </span>
          <span className="text-xs text-slate-400 block">Capacity</span>
        </div>
      </div>

      <div className={`relative w-14 h-36 bg-slate-100 dark:bg-slate-700 rounded-full border-4 border-white dark:border-slate-600 shadow-inner overflow-hidden mb-5 z-10 mt-auto ${!isBoxOnline ? 'opacity-40 grayscale' : ''}`}>
        <div
          className={`absolute bottom-0 w-full transition-all duration-1000 ${magazine.color} ${isLow && isBoxOnline ? 'animate-pulse' : ''}`}
          style={{ height: `${calculatedPercentage}%` }}
        >
          <div className="w-full h-full opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUpIiBmaWxsLW9wYWNpdHk9IjAuMiIvPjwvc3ZnPg==')]"></div>
        </div>
      </div>

      {/* action button */}
      <button
        onClick={async () => setActiveCommandId(await onDispense(magazine))}
        disabled={isDisabled}
        className="z-10 w-full flex items-center justify-center gap-2 py-3 
                   bg-slate-900 dark:bg-cyan-600 text-white text-sm font-medium rounded-xl 
                   shadow-lg shadow-slate-900/10 dark:shadow-cyan-900/20
                   transition-all active:scale-95 
                   hover:bg-slate-800 dark:hover:bg-cyan-500
                   disabled:opacity-50 disabled:cursor-not-allowed 
                   disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
      >
        {!isBoxOnline ? (
            <>
                <WifiOff size={16} />
                <span>Offline</span>
            </>
        ) : isBusy ? (
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