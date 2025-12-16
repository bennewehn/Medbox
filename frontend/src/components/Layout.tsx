import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { type User, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { Pill, X, Menu } from 'lucide-react';

export default function Layout({ user, isDark, toggleTheme }: { user: User | null, isDark: boolean, toggleTheme: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const handleLogout = () => signOut(auth!);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar user={user} isDark={isDark} toggleTheme={toggleTheme} onLogout={handleLogout} />
      
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <div className="bg-cyan-600 p-1.5 rounded-lg">
             <Pill className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-800 dark:text-white">MedBox</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-700 dark:text-slate-200">
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <MobileNav 
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
        user={user}
        isDark={isDark}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-auto md:p-8 p-4 pt-20 md:pt-8 transition-colors duration-300">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
