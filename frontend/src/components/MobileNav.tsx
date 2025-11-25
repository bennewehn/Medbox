import { type User } from 'firebase/auth';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Calendar, History, Sun, Moon, LogOut } from 'lucide-react';

const MobileNav = ({ 
//  user, 
  isDark, 
  toggleTheme, 
  onLogout,
  isOpen,
  setIsOpen
}: { 
  user: User | null, 
  isDark: boolean, 
  toggleTheme: () => void, 
  onLogout: () => void,
  isOpen: boolean,
  setIsOpen: (val: boolean) => void
}) => {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/schedule', label: 'Planner', icon: <Calendar size={20} /> },
    { path: '/history', label: 'History', icon: <History size={20} /> }
  ];

  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-20 bg-white dark:bg-slate-950 pt-20 px-6">
      <nav className="space-y-4">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-4 rounded-xl text-lg ${
              location.pathname === item.path 
                ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 font-semibold' 
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
        <button 
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 px-4 py-4 rounded-xl text-lg text-slate-500 dark:text-slate-400"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button 
          onClick={onLogout}
          className="flex w-full items-center gap-3 px-4 py-4 rounded-xl text-lg text-red-500"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </nav>
    </div>
  );
};

export default MobileNav;
