
import React, { useState, useMemo, useEffect } from 'react';
import { AppView, ClassRoom, LessonPlan, AppUser, BNCCSkill } from './types';
import { dbService, authService } from './services/firebase';
import Dock from './components/Dock';
import Dashboard from './components/Dashboard';
import ClassesView from './components/ClassesView';
import LessonPlanner from './components/LessonPlanner';
import VisualsGenerator from './components/VisualsGenerator';
import QuizMaker from './components/QuizMaker';
import Clock from './components/Clock';
import SettingsView from './components/SettingsView';
import AuthView from './components/AuthView';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentView, setCurrentView] = useState<AppView | null>(AppView.DASHBOARD);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [allLessons, setAllLessons] = useState<LessonPlan[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [bnccMasterList, setBnccMasterList] = useState<BNCCSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = authService.onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userData = await dbService.getById<AppUser>('users', firebaseUser.uid);
          if (userData) {
            setCurrentUser(userData);
            // Direciona Professor e Aluno direto para a aba de Aulas
            if (userData.role === 'professor' || userData.role === 'estudante') {
              setCurrentView(AppView.LESSON_PLANNER);
            }
          } else {
            setCurrentUser(null);
          }
        } catch (err) {
          console.error("Erro ao recuperar perfil:", err);
        }
      } else {
        setCurrentUser(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      const loadSafe = async <T,>(coll: string, setter: (data: T[]) => void) => {
        try {
          const data = await dbService.getCollection<T>(coll);
          if (data && data.length > 0) setter(data);
        } catch (e) { console.warn(`Sem acesso à coleção ${coll}.`); }
      };

      await Promise.all([
        loadSafe<AppUser>('users', setUsers),
        loadSafe<ClassRoom>('classes', setClasses),
        loadSafe<LessonPlan>('lessons', setAllLessons),
        loadSafe<BNCCSkill>('bncc', setBnccMasterList)
      ]);
    };

    loadData();

    const unsubLessons = dbService.subscribe('lessons', (data) => setAllLessons(data));
    const unsubClasses = dbService.subscribe('classes', (data) => setClasses(data));
    const unsubUsers = dbService.subscribe('users', (data) => setUsers(data));

    return () => {
      unsubLessons();
      unsubClasses();
      unsubUsers();
    };
  }, [currentUser]);

  const handleLogout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setCurrentView(AppView.DASHBOARD);
  };

  const filteredLessons = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'administrador') return allLessons;
    
    if (currentUser.role === 'professor') {
      // Professor visualiza apenas o que ele criou
      return allLessons.filter(l => l.ownerId === currentUser.id);
    }
    
    // Aluno visualiza apenas aulas vinculadas às suas turmas
    return allLessons.filter(l => 
      l.linkedClassIds?.some(cid => currentUser.linkedClassIds?.includes(cid))
    );
  }, [allLessons, currentUser]);

  const isIntegratedView = 
    currentView === AppView.DASHBOARD || 
    currentView === AppView.CLASSES || 
    currentView === AppView.LESSON_PLANNER ||
    currentView === AppView.SETTINGS;

  const handleCompleteLesson = async (lessonId: string) => {
    if (!currentUser) return;
    const updatedCompleted = [...(currentUser.completedLessonIds || [])];
    if (!updatedCompleted.includes(lessonId)) {
      updatedCompleted.push(lessonId);
      const updatedUser = { ...currentUser, completedLessonIds: updatedCompleted };
      setCurrentUser(updatedUser);
      await dbService.save('users', currentUser.id, { completedLessonIds: updatedCompleted });
    }
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white font-black uppercase text-[10px] tracking-widest animate-pulse">Iniciando Ensinoverso...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center">
        <AuthView onAuthSuccess={(user) => setCurrentUser(user)} />
      </div>
    );
  }

  if (!currentUser.approved) {
    return (
      <div className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center bg-black">
        <div className="relative z-10 w-full max-w-lg px-8 text-center space-y-12 animate-desktop-in">
          <div className="w-32 h-32 bg-indigo-600/20 rounded-[3rem] border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 text-5xl shadow-[0_0_50px_rgba(79,70,229,0.2)]">
            <i className="fa-solid fa-hourglass-half animate-pulse"></i>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Acesso Pendente</h1>
            <p className="text-xl text-white/40 font-medium leading-relaxed">Olá, <span className="text-indigo-400 font-black">{currentUser.name}</span>. Sua conta está aguardando liberação do administrador.</p>
          </div>
          <button onClick={handleLogout} className="w-full py-6 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest border border-white/10 transition-all">Sair da Conta</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col items-center text-gray-900">
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${isIntegratedView ? 'scale-90 opacity-20 blur-sm' : 'opacity-100'}`}>
        <Clock />
      </div>

      {isIntegratedView && (
        <div className="relative z-10 w-full h-full overflow-y-auto pt-10 pb-32 px-8 flex justify-center items-start animate-desktop-in custom-scrollbar">
          {currentView === AppView.DASHBOARD && currentUser.role === 'administrador' && (
            <Dashboard 
              setView={setCurrentView} 
              classesCount={classes.length} 
              lessonsCount={allLessons.length}
              usersCount={users.length}
              currentUser={currentUser}
            />
          )}
          {currentView === AppView.CLASSES && currentUser.role === 'administrador' && (
            <ClassesView 
              classes={classes} 
              setClasses={setClasses} 
              setView={setCurrentView}
              setActiveLessonId={setActiveLessonId}
              allLessons={allLessons}
              users={users}
            />
          )}
          {currentView === AppView.LESSON_PLANNER && (
            <LessonPlanner 
              lessons={filteredLessons} 
              setLessons={setAllLessons} 
              classes={classes} 
              setClasses={setClasses} 
              viewingLessonId={activeLessonId}
              setViewingLessonId={setActiveLessonId}
              masterBnccSkills={bnccMasterList}
              currentUser={currentUser}
              onCompleteLesson={handleCompleteLesson}
              users={users}
              setUsers={setUsers}
            />
          )}
          {currentView === AppView.SETTINGS && currentUser.role === 'administrador' && (
            <SettingsView users={users} setUsers={setUsers} bnccSkills={bnccMasterList} setBnccSkills={setBnccMasterList} classes={classes} />
          )}
        </div>
      )}

      <Dock currentView={currentView} setView={setCurrentView} userRole={currentUser.role} onLogout={handleLogout} />
    </div>
  );
};

export default App;
