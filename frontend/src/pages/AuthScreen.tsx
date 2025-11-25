import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Sun, Moon, Pill, AlertCircle } from 'lucide-react';

function AuthScreen({ isDark, toggleTheme }: { isDark: boolean, toggleTheme: () => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth!, email, password);
      } else {
        await signInWithEmailAndPassword(auth!, email, password);
      }
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', ''));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 relative transition-colors duration-300">
       <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-600 dark:text-slate-300 shadow-lg hover:scale-110 transition-all"
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-cyan-600 dark:bg-cyan-700 p-4 rounded-2xl shadow-lg shadow-cyan-600/20">
              <Pill className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-white mb-2">
            {isRegistering ? 'Join Medbox' : 'Welcome Back'}
          </h2>
          <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
            Smart Medication Management System
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 ml-1">Email</label>
              <input
                type="email"
                required
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 ml-1">Password</label>
              <input
                type="password"
                required
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-cyan-600/20 mt-2"
            >
              {isRegistering ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 text-center border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 font-semibold"
          >
            {isRegistering ? 'Already have an account? Log in' : 'No account? Create one for free'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;