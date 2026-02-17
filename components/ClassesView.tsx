
import React, { useState, useMemo } from 'react';
import { ClassRoom, Student, ClassLesson, AppView, LessonPlan, AppUser } from '../types';
import { dbService } from '../services/firebase';
import PerformanceModal from './PerformanceModal';

interface ClassesViewProps {
  classes: ClassRoom[];
  setClasses: React.Dispatch<React.SetStateAction<ClassRoom[]>>;
  setView: (view: AppView) => void;
  setActiveLessonId: (id: string | null) => void;
  allLessons: LessonPlan[];
  users: AppUser[];
}

const ClassesView: React.FC<ClassesViewProps> = ({ classes, setClasses, setView, setActiveLessonId, allLessons, users }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [performanceLessonId, setPerformanceLessonId] = useState<string | null>(null);

  const selectedClass = useMemo(() => 
    classes.find(c => c.id === selectedClassId), 
    [classes, selectedClassId]
  );

  // Filtra as aulas da turma selecionada garantindo que elas ainda existam na lista global de aulas
  const activeLessonsForClass = useMemo(() => {
    if (!selectedClass?.lessons) return [];
    const globalLessonIds = new Set(allLessons.map(l => l.id));
    return selectedClass.lessons.filter(l => globalLessonIds.has(l.id));
  }, [selectedClass, allLessons]);

  const linkedUsersForSelectedClass = useMemo(() => {
    if (!selectedClassId) return [];
    return users.filter(u => u.linkedClassIds.includes(selectedClassId))
                .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, selectedClassId]);

  const confirmDeleteClass = async () => {
    if (classToDelete) {
      try {
        await dbService.delete('classes', classToDelete);
        if (selectedClassId === classToDelete) {
          setSelectedClassId(null);
        }
        setClassToDelete(null);
      } catch (error) {
        console.error("Erro ao deletar turma:", error);
        alert("Erro ao remover a turma do banco de dados.");
      }
    }
  };

  const handleSaveEdit = async (id: string, name: string, grade: string, imageUrl: string) => {
    const classToUpdate = classes.find(c => c.id === id);
    if (classToUpdate) {
      const updatedData = { ...classToUpdate, name, grade, imageUrl };
      try {
        await dbService.save('classes', id, updatedData);
        setEditingId(null);
      } catch (error) {
        console.error("Erro ao salvar edição:", error);
      }
    }
  };

  const addClass = async () => {
    const newId = Date.now().toString();
    const newClass: ClassRoom = {
      id: newId,
      name: 'Nova Turma Ensinoverso',
      grade: 'Geral',
      studentsCount: 0,
      color: 'from-indigo-600 to-blue-700',
      icon: 'fa-graduation-cap',
      imageUrl: '',
      lessons: []
    };
    
    try {
      await dbService.save('classes', newId, newClass);
    } catch (error) {
      console.error("Erro ao criar turma no banco:", error);
      alert("Erro de conexão ao banco de dados.");
    }
  };

  const handleLessonClick = (lessonId: string) => {
    setActiveLessonId(lessonId);
    setView(AppView.LESSON_PLANNER);
  };

  const performanceLesson = useMemo(() => 
    allLessons.find(l => l.id === performanceLessonId), 
    [allLessons, performanceLessonId]
  );

  if (selectedClassId && selectedClass) {
    return (
      <div className="w-full max-w-[95%] lg:max-w-7xl flex flex-col gap-12 animate-desktop-in pb-32 text-gray-900">
        {performanceLesson && (
          <PerformanceModal 
            lesson={performanceLesson} 
            classes={classes} 
            onClose={() => setPerformanceLessonId(null)} 
          />
        )}

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/20 pb-12">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setSelectedClassId(null)}
              className="w-16 h-16 rounded-[1.5rem] bg-white text-indigo-600 flex items-center justify-center transition-all shadow-2xl hover:bg-indigo-50 group"
            >
              <i className="fa-solid fa-chevron-left text-xl group-hover:-translate-x-1 transition-transform"></i>
            </button>
            <div>
              <div className="flex items-center gap-4 mb-2">
                 <div className={`bg-gradient-to-br ${selectedClass.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl`}>
                    <i className={`fa-solid ${selectedClass.icon} text-xl`}></i>
                 </div>
                 <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-strong">
                   {selectedClass.name}
                 </h1>
              </div>
              <p className="text-xl text-white/50 font-black uppercase tracking-[0.4em] ml-1">Painel de Administração</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <section className="lg:col-span-4 bg-white/5 backdrop-blur-2xl rounded-[3.5rem] p-10 border border-white/10 shadow-2xl h-fit">
            <div className="flex items-center justify-between mb-10 border-b border-white/10 pb-6">
                <h2 className="text-2xl font-black text-white tracking-tight">Membros Ativos</h2>
                <span className="bg-white/10 text-white px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest">{linkedUsersForSelectedClass.length}</span>
            </div>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
              {linkedUsersForSelectedClass.length > 0 ? linkedUsersForSelectedClass.map(user => (
                <div key={user.id} className="flex items-center gap-4 p-5 bg-white/5 rounded-3xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg border-2 ${user.role === 'professor' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'}`}>
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <span className="text-white font-black text-lg tracking-tight block group-hover:text-indigo-300 transition-colors">{user.name}</span>
                    <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em]">{user.role}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 opacity-20">
                    <i className="fa-solid fa-users-slash text-4xl mb-4"></i>
                    <p className="font-black uppercase tracking-widest text-[10px]">Sem conexões registradas</p>
                </div>
              )}
            </div>
          </section>

          <section className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-3xl font-black text-white tracking-tight uppercase tracking-widest opacity-80">Aulas do Calendário</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {activeLessonsForClass.length > 0 ? activeLessonsForClass.map(lesson => (
                <div 
                  key={lesson.id} 
                  className="bg-white rounded-[3.5rem] border border-white shadow-2xl group transition-all text-gray-900 flex flex-col h-full overflow-hidden hover:-translate-y-2 duration-500"
                >
                  <div className="p-10 flex-1">
                    <div className="flex justify-between items-start mb-8">
                      <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-6 py-2 rounded-full shadow-sm">
                        {lesson.category}
                      </span>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{lesson.date}</span>
                    </div>
                    <h3 className="text-3xl font-black text-gray-950 leading-tight mb-6 group-hover:text-indigo-600 transition-colors line-clamp-2 min-h-[80px] tracking-tight">
                      {lesson.title}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-2 border-t border-gray-100 bg-gray-50/50">
                    <button 
                      onClick={() => handleLessonClick(lesson.id)}
                      className="p-6 flex items-center justify-center gap-3 text-[11px] font-black text-gray-600 uppercase tracking-[0.2em] hover:bg-white transition-all border-r border-gray-100"
                    >
                      <i className="fa-solid fa-file-invoice text-lg"></i>
                      PLANO
                    </button>
                    <button 
                      onClick={() => setPerformanceLessonId(lesson.id)}
                      className="p-6 flex items-center justify-center gap-3 text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] hover:bg-indigo-600 hover:text-white transition-all shadow-inner"
                    >
                      <i className="fa-solid fa-chart-line text-lg"></i>
                      DASH
                    </button>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 bg-white/5 border-4 border-dashed border-white/10 rounded-[4rem] p-24 text-center group hover:border-indigo-500/30 transition-colors">
                   <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 text-white/10 group-hover:text-indigo-400 transition-colors">
                      <i className="fa-solid fa-book-medical text-4xl"></i>
                   </div>
                   <p className="text-white/20 font-black uppercase tracking-[0.5em] text-sm">Nenhum conteúdo vinculado</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[95%] lg:max-w-7xl flex flex-col gap-12 animate-desktop-in text-gray-900 pb-40">
      {classToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-[3.5rem] p-12 shadow-2xl border border-white/20 flex flex-col items-center text-center space-y-8">
             <div className="w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-4xl shadow-inner animate-pulse">
                <i className="fa-solid fa-triangle-exclamation"></i>
             </div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black text-gray-900 tracking-tighter">Remover do Ensinoverso?</h3>
                <p className="text-gray-500 font-bold leading-relaxed text-sm">
                A exclusão da turma <span className="text-rose-600 font-black uppercase">{classes.find(c => c.id === classToDelete)?.name}</span> é uma ação irreversível.
                </p>
             </div>
             <div className="flex flex-col w-full gap-3">
               <button onClick={confirmDeleteClass} className="w-full py-6 bg-rose-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl">CONFIRMAR EXCLUSÃO</button>
               <button onClick={() => setClassToDelete(null)} className="w-full py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">CANCELAR</button>
             </div>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/20 pb-12">
        <div className="space-y-2">
          <h1 className="text-7xl font-black text-white tracking-tighter drop-shadow-strong">Turmas</h1>
          <p className="text-2xl text-white/50 font-medium max-w-xl">Gerenciamento dinâmico de conexões entre docentes, alunos e conteúdo.</p>
        </div>
        <button onClick={addClass} className="bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-6 rounded-[2rem] font-black text-xs transition-all shadow-2xl hover:scale-105 active:scale-95 flex items-center gap-4 uppercase tracking-widest">
          <i className="fa-solid fa-plus-circle text-xl"></i> ADICIONAR TURMA
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {classes.map((cls) => {
          const linkedUsersCount = users.filter(u => u.linkedClassIds.includes(cls.id)).length;
          return (
            <div key={cls.id} className="group relative bg-white/5 backdrop-blur-2xl rounded-[4rem] border border-white/10 transition-all duration-700 hover:bg-white/15 hover:shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden min-h-[440px] flex flex-col hover:-translate-y-3">
              <div className="relative h-48 overflow-hidden">
                {cls.imageUrl ? <img src={cls.imageUrl} alt={cls.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" /> : <div className={`w-full h-full bg-gradient-to-br ${cls.color} opacity-40 group-hover:opacity-80 transition-opacity`}></div>}
                <div className="absolute top-8 left-8">
                  <div className={`bg-gradient-to-br ${cls.color} w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-white shadow-2xl border border-white/10 group-hover:scale-110 transition-transform duration-500`}><i className={`fa-solid ${cls.icon} text-3xl`}></i></div>
                </div>
              </div>
              <div className="p-10 relative z-10 flex flex-col flex-grow bg-white/5">
                <div className="space-y-2 flex-grow">
                  <h3 className="text-3xl font-black text-white tracking-tight leading-tight group-hover:text-indigo-300 transition-colors truncate">{cls.name}</h3>
                  <div className="flex items-center gap-3 text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">
                    <i className="fa-solid fa-fingerprint"></i>
                    <span>ID: {cls.id.slice(-6)}</span>
                    <span className="w-1.5 h-1.5 bg-white/10 rounded-full"></span>
                    <span>{linkedUsersCount} MEMBROS</span>
                  </div>
                </div>
                <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-3 gap-3">
                  <button onClick={() => setSelectedClassId(cls.id)} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white text-white/50 hover:text-gray-900 transition-all shadow-inner group/btn" title="Painel Completo">
                    <i className="fa-solid fa-up-right-from-square text-lg"></i>
                    <span className="text-[8px] font-black uppercase group-hover/btn:opacity-100 transition-opacity">ENTRAR</span>
                  </button>
                  <button onClick={() => setEditingId(cls.id)} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-indigo-600 text-white/50 hover:text-white transition-all shadow-inner group/btn" title="Editar Metadados">
                    <i className="fa-solid fa-gears text-lg"></i>
                    <span className="text-[8px] font-black uppercase group-hover/btn:opacity-100 transition-opacity">CONFIG</span>
                  </button>
                  <button onClick={() => setClassToDelete(cls.id)} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-rose-600 text-white/50 hover:text-white transition-all shadow-inner group/btn" title="Remover Turma">
                    <i className="fa-solid fa-trash-can text-lg"></i>
                    <span className="text-[8px] font-black uppercase group-hover/btn:opacity-100 transition-opacity">EXCLUIR</span>
                  </button>
                </div>
              </div>
              {editingId === cls.id && <EditOverlay cls={cls} onClose={() => setEditingId(null)} onSave={handleSaveEdit} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface EditOverlayProps {
  cls: ClassRoom;
  onClose: () => void;
  onSave: (id: string, name: string, grade: string, imageUrl: string) => void;
}

const EditOverlay: React.FC<EditOverlayProps> = ({ cls, onClose, onSave }) => {
  const [name, setName] = useState(cls.name);
  const [imageUrl, setImageUrl] = useState(cls.imageUrl || '');

  return (
    <div className="absolute inset-0 bg-gray-950/95 backdrop-blur-2xl z-[100] p-10 flex flex-col justify-center gap-8 border-2 border-indigo-500/40 animate-fadeIn">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Nome da Turma</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white text-lg font-black outline-none focus:bg-white/10" placeholder="Nome" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">URL da Imagem de Capa</label>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white text-lg font-black outline-none focus:bg-white/10" placeholder="https://exemplo.com/imagem.jpg" />
        </div>
      </div>
      <div className="flex flex-col gap-3 mt-4">
        <button onClick={() => onSave(cls.id, name, cls.grade, imageUrl)} className="w-full bg-indigo-600 text-white font-black text-[11px] py-5 rounded-2xl uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/20">SALVAR CONFIGURAÇÃO</button>
        <button onClick={onClose} className="w-full bg-white/5 text-white/40 font-black text-[11px] py-4 rounded-2xl uppercase tracking-[0.2em]">VOLTAR</button>
      </div>
    </div>
  );
};

export default ClassesView;
