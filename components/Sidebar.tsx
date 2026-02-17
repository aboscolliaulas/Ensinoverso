
import React from 'react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const menuItems = [
    { id: AppView.DASHBOARD, icon: 'fa-house', label: 'Início' },
    { id: AppView.LESSON_PLANNER, icon: 'fa-book-open', label: 'Plano de Aula' },
    { id: AppView.VISUALS, icon: 'fa-palette', label: 'Recursos Visuais' },
    { id: AppView.QUIZ_MAKER, icon: 'fa-list-check', label: 'Quiz Interativo' },
    { id: AppView.CHAT, icon: 'fa-comments', label: 'Monitor de IA' },
  ];

  return (
    <aside className="w-64 bg-indigo-900 text-white h-screen flex flex-col fixed left-0 top-0 z-50 transition-all duration-300">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
          <i className="fa-solid fa-rocket text-xl"></i>
        </div>
        <span className="text-xl font-bold tracking-tight">Ensinoverso</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === item.id 
                ? 'bg-indigo-700 text-white shadow-lg' 
                : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
            }`}
          >
            <i className={`fa-solid ${item.icon} w-5`}></i>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6 mt-auto border-t border-indigo-800">
        <div className="flex items-center gap-3 bg-indigo-800 p-3 rounded-xl">
          <img src="https://picsum.photos/seed/teacher/40" alt="Teacher" className="w-10 h-10 rounded-full border-2 border-indigo-500" />
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">Prof. André Boscolli</p>
            <p className="text-xs text-indigo-300">Ensino Fundamental</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
