
import React, { useMemo } from 'react';
import { AppView, AppUser } from '../types';

interface DashboardProps {
  setView: (view: AppView) => void;
  classesCount: number;
  lessonsCount: number;
  usersCount: number;
  currentUser: AppUser;
}

const Dashboard: React.FC<DashboardProps> = ({ setView, classesCount, lessonsCount, usersCount, currentUser }) => {
  const isAdmin = currentUser.role === 'administrador';
  const isProfessor = currentUser.role === 'professor';
  const isStudent = currentUser.role === 'estudante';

  const welcomeMessage = useMemo(() => {
    if (isProfessor) return "Ensinar é plantar sementes de futuro; inspire e transforme vidas todos os dias.";
    if (isStudent) return "Não se limite ao que você vê; transforme seu aprendizado em conquistas.";
    return "Gestão estratégica e inovação pedagógica: liderando a transformação no Ensinoverso.";
  }, [currentUser.role]);

  const stats = useMemo(() => {
    const allStats = [
      { 
        label: 'Turmas Ativas', 
        value: classesCount.toString().padStart(2, '0'), 
        icon: 'fa-users-between-lines', 
        color: 'from-emerald-400 to-cyan-500',
        target: AppView.CLASSES,
        desc: 'Gestão e Alunos',
        roles: ['administrador']
      },
      { 
        label: 'Biblioteca de Aulas', 
        value: lessonsCount.toString().padStart(2, '0'), 
        icon: 'fa-book-sparkles', 
        color: 'from-indigo-500 to-violet-600',
        target: AppView.LESSON_PLANNER,
        desc: 'Planos Pedagógicos',
        roles: ['administrador', 'professor', 'estudante']
      },
      { 
        label: 'Rede Ensinoverso', 
        value: usersCount.toString(), 
        icon: 'fa-user-astronaut', 
        color: 'from-orange-400 to-rose-500',
        target: AppView.SETTINGS,
        desc: 'Controle de Acesso',
        roles: ['administrador']
      },
    ];
    return allStats.filter(stat => stat.roles.includes(currentUser.role));
  }, [currentUser.role, classesCount, lessonsCount, usersCount]);

  return (
    <div className="w-full max-w-7xl flex flex-col gap-12 animate-desktop-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4">
             <span className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.3em] shadow-lg">Painel de Controle</span>
          </div>
          <h1 className="text-7xl font-black text-white tracking-tighter drop-shadow-strong">
            Bom dia,
          </h1>
          <p className="text-2xl text-white/70 font-medium max-w-4xl leading-relaxed">
            {isAdmin || isProfessor ? 'Prof. ' : ''}<span className="text-indigo-400 font-black">{currentUser.name}</span>. <br/>
            <span className="text-white font-medium italic">"{welcomeMessage}"</span>
          </p>
        </div>
        <div className="hidden md:block text-right bg-white/5 backdrop-blur-md p-6 rounded-[2rem] border border-white/10">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-2">Status da Rede</p>
          <div className="flex items-center gap-3 justify-end">
            <span className="text-white font-black text-sm">Acesso Liberado</span>
            <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_15px_#4ade80] animate-pulse"></div>
          </div>
        </div>
      </header>

      {(isAdmin || isProfessor) && (
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setView(AppView.LESSON_PLANNER)}
            className="group bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-6 rounded-3xl font-black text-xs tracking-widest transition-all shadow-2xl hover:scale-105 active:scale-95 flex items-center gap-4 uppercase"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-plus text-lg"></i>
            </div>
            Novo Planejamento
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-${stats.length} gap-8`}>
        {stats.map((stat, i) => (
          <button 
            key={i} 
            onClick={() => setView(stat.target)}
            className="group relative bg-white/5 backdrop-blur-2xl rounded-[3.5rem] p-10 border border-white/10 flex flex-col items-start gap-8 transition-all duration-500 hover:bg-white/15 hover:-translate-y-2 hover:shadow-[0_40px_100px_rgba(0,0,0,0.5)] text-left overflow-hidden shadow-2xl"
          >
            <div className={`absolute -right-8 -top-8 w-48 h-48 bg-gradient-to-br ${stat.color} opacity-10 blur-[80px] group-hover:opacity-30 transition-opacity duration-700`}></div>
            
            <div className={`bg-gradient-to-br ${stat.color} w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl group-hover:rotate-6 transition-transform duration-500`}>
              <i className={`fa-solid ${stat.icon} text-4xl`}></i>
            </div>
            
            <div className="space-y-1">
              <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em] mb-1">{stat.label}</p>
              <p className="text-7xl font-black text-white tracking-tighter">{stat.value}</p>
            </div>

            <div className="flex items-center gap-4 text-white/50 group-hover:text-white transition-colors font-black text-[11px] uppercase tracking-[0.2em] bg-white/5 px-6 py-3 rounded-2xl">
              <span>{stat.desc}</span>
              <i className="fa-solid fa-arrow-right-long text-xs group-hover:translate-x-2 transition-transform"></i>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
          <div className="bg-gradient-to-r from-indigo-900/40 to-indigo-800/20 backdrop-blur-xl border border-white/10 p-12 rounded-[3.5rem] flex flex-col justify-center gap-6">
              <h3 className="text-3xl font-black text-white tracking-tight">Biblioteca Digital</h3>
              <p className="text-indigo-200/60 font-medium text-lg leading-relaxed">
                  Acesse os conteúdos planejados e as sequências didáticas integradas ao Ensinoverso.
              </p>
              <button 
                onClick={() => setView(AppView.LESSON_PLANNER)}
                className="w-fit px-10 py-5 bg-white text-indigo-900 font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl hover:scale-105 transition-all"
              >
                Acessar Aulas
              </button>
          </div>
          {isAdmin && (
            <div className="bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 backdrop-blur-xl border border-white/10 p-12 rounded-[3.5rem] flex flex-col justify-center gap-6">
                <h3 className="text-3xl font-black text-white tracking-tight">Gestão Sistêmica</h3>
                <p className="text-emerald-200/60 font-medium text-lg leading-relaxed">
                    Controle de usuários, turmas e permissões da rede educacional.
                </p>
                <button 
                  onClick={() => setView(AppView.CLASSES)}
                  className="w-fit px-10 py-5 bg-emerald-500 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl hover:scale-105 transition-all"
                >
                  Configurar Turmas
                </button>
            </div>
          )}
      </div>
      
      <div className="mt-8 flex justify-center opacity-20">
        <div className="w-32 h-1 bg-white rounded-full"></div>
      </div>
    </div>
  );
};

export default Dashboard;
