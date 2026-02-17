
import React, { useMemo } from 'react';
import { AppView, UserRole } from '../types';

interface DockProps {
  currentView: AppView | null;
  setView: (view: AppView | null) => void;
  userRole: UserRole;
  onLogout: () => void;
}

const Dock: React.FC<DockProps> = ({ currentView, setView, userRole, onLogout }) => {
  const menuItems = useMemo(() => {
    const allItems = [
      { id: AppView.DASHBOARD, icon: 'fa-house', label: 'Início', color: 'bg-blue-600', roles: ['administrador', 'professor', 'estudante'] },
      { id: AppView.CLASSES, icon: 'fa-users', label: 'Turmas', color: 'bg-emerald-600', roles: ['administrador'] },
      { id: AppView.LESSON_PLANNER, icon: 'fa-book-open', label: 'Aulas', color: 'bg-indigo-600', roles: ['administrador', 'professor', 'estudante'] },
      { id: AppView.SETTINGS, icon: 'fa-gear', label: 'Config', color: 'bg-gray-700', roles: ['administrador'] },
    ];
    return allItems.filter(item => item.roles.includes(userRole));
  }, [userRole]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
      <div className="dock-glass flex items-end gap-3 px-5 py-3 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/20">
        {menuItems.map((item) => (
          <div key={item.id} className="flex flex-col items-center gap-1 group">
            <button
              onClick={() => setView(currentView === item.id ? null : item.id)}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 shadow-xl ${
                currentView === item.id 
                  ? `${item.color} text-white ring-2 ring-white` 
                  : 'bg-white/10 text-white hover:bg-white/25'
              }`}
            >
              <i className={`fa-solid ${item.icon} text-xl`}></i>
            </button>
            <span className="text-[10px] text-white font-bold uppercase tracking-wider text-center w-14 truncate leading-none pb-1 drop-shadow-lg">
              {item.label}
            </span>
          </div>
        ))}
        <div className="w-px h-10 bg-white/20 mx-2 self-center"></div>
        <div className="flex flex-col items-center gap-1">
          <button 
            type="button"
            onClick={onLogout}
            className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/10 text-white hover:bg-red-500 transition-all hover:scale-110 shadow-xl cursor-pointer"
          >
            <i className="fa-solid fa-right-from-bracket text-xl"></i>
          </button>
          <span className="text-[10px] text-white font-bold uppercase tracking-wider text-center w-14 leading-none pb-1 drop-shadow-lg">
            Sair
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dock;
