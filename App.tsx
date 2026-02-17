
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
          } else {
            setCurrentUser({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Usuário',
              email: firebaseUser.email || '',
              role: 'professor',
              approved: true,
              linkedClassIds: []
            });
          }
        } catch (err) {
          console.error("Erro ao recuperar perfil do usuário:", err);
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
        } catch (e) {
          console.warn(`Aviso: Sem permissão para ler a coleção ${coll}.`);
        }
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
      return allLessons.filter(l => l.ownerId === currentUser.id);
    }
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
        <div className="relative z-10 w-full flex justify-center px-6">
          <AuthView onAuthSuccess={(user) => setCurrentUser(user)} />
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
          {currentView === AppView.DASHBOARD && (
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
            <SettingsView 
              users={users} 
              setUsers={setUsers} 
              bnccSkills={bnccMasterList} 
              setBnccSkills={setBnccMasterList} 
              classes={classes}
            />
          )}
        </div>
      )}

      {currentView && !isIntegratedView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 md:p-12 bg-black/40 backdrop-blur-sm animate-desktop-in">
          <div className="w-full max-w-6xl max-h-full overflow-hidden rounded-[2.5rem] shadow-[0_40px_120px_rgba(0,0,0,0.7)] flex flex-col glass border border-white/40">
             <div className="p-12 overflow-y-auto custom-scrollbar">
                {currentView === AppView.VISUALS && currentUser.role === 'administrador' && <VisualsGenerator />}
                {currentView === AppView.QUIZ_MAKER && currentUser.role === 'administrador' && <QuizMaker />}
                <button 
                  onClick={() => setCurrentView(AppView.DASHBOARD)} 
                  className="mt-8 bg-gray-100 text-gray-900 px-6 py-3 rounded-xl font-bold hover:bg-white transition-all w-fit uppercase text-[10px] tracking-widest"
                >
                  Voltar
                </button>
             </div>
          </div>
        </div>
      )}

      <Dock currentView={currentView} setView={setCurrentView} userRole={currentUser.role} onLogout={handleLogout} />
    </div>
  );
};

export default App;
