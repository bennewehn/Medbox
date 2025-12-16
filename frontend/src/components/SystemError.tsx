import { AlertTriangle, RefreshCw } from "lucide-react";

export const SystemError = ({ error }: { error: Error }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 font-sans">
    <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30 overflow-hidden">
      <div className="bg-red-50 dark:bg-red-900/20 p-6 flex items-center gap-4 border-b border-red-100 dark:border-red-900/30">
        <div className="bg-red-100 dark:bg-red-800 p-3 rounded-full">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-200" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-red-700 dark:text-red-400">System Initialization Failed</h1>
          <p className="text-sm text-red-600/80 dark:text-red-400/80">The application could not start securely.</p>
        </div>
      </div>
      
      <div className="p-8">
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Error Details</h3>
          <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-sm text-slate-700 dark:text-slate-300 break-words">
            {error.message}
          </div>
        </div>

        <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
          Check the network connection.
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="w-full py-3 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <RefreshCw size={18} />
          Reload Application
        </button>
      </div>
    </div>
  </div>
);