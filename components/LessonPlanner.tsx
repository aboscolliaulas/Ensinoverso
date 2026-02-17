
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { generateLessonPlanFromContent, generateLessonQuestions, ContentPart } from '../services/geminiService';
import { dbService } from '../services/firebase';
import { LessonPlan, QuizQuestion, ClassRoom, BNCCSkill, AppUser } from '../types';
import PerformanceModal from './PerformanceModal';

const SUBJECTS = ['Português', 'Matemática', 'História', 'Geografia', 'Ciências', 'Artes', 'Educação Física', 'Ensino Religioso', 'Inglês'];
const GRADES_YEARS = ['6º Ano', '7º Ano', '8º Ano', '9º Ano'];

interface LessonPlannerProps {
  lessons: LessonPlan[];
  setLessons: React.Dispatch<React.SetStateAction<LessonPlan[]>>;
  classes: ClassRoom[];
  setClasses: React.Dispatch<React.SetStateAction<ClassRoom[]>>;
  viewingLessonId: string | null;
  setViewingLessonId: (id: string | null) => void;
  masterBnccSkills: BNCCSkill[];
  currentUser: AppUser;
  onCompleteLesson: (lessonId: string) => void;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
}

const LessonPlanner: React.FC<LessonPlannerProps> = ({ 
  lessons, setLessons, classes, setClasses, viewingLessonId, setViewingLessonId, masterBnccSkills, currentUser, onCompleteLesson, users, setUsers
}) => {
  const isAdmin = currentUser.role === 'administrador';
  const isProfessor = currentUser.role === 'professor';
  const isStudent = currentUser.role === 'estudante';
  
  const [loading, setLoading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [performanceLessonId, setPerformanceLessonId] = useState<string | null>(null);
  
  // Quiz Student State
  const [studentAnswers, setStudentAnswers] = useState<Record<number, number>>({});
  const [isLessonSubmitted, setIsLessonSubmitted] = useState(false);

  // Form State
  const [schoolName, setSchoolName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherName, setTeacherName] = useState(currentUser.name);
  const [grade, setGrade] = useState('6º Ano');
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [extraLinks, setExtraLinks] = useState<string[]>(['']);
  const [selectedBnccCodes, setSelectedBnccCodes] = useState<string[]>([]);
  const [noBncc, setNoBncc] = useState(false);
  const [bnccGradeFilter, setBnccGradeFilter] = useState('6º Ano');
  const [bnccSubjectFilter, setBnccSubjectFilter] = useState('Português');
  
  const [generatedPlan, setGeneratedPlan] = useState<Partial<LessonPlan> | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);

  const viewingLesson = useMemo(() => lessons.find(l => l.id === viewingLessonId), [lessons, viewingLessonId]);

  useEffect(() => {
    if (viewingLessonId && isStudent) {
      const alreadyCompleted = currentUser.completedLessonIds?.includes(viewingLessonId);
      setIsLessonSubmitted(!!alreadyCompleted);
      setStudentAnswers({}); // Reseta respostas locais ao abrir nova aula
    }
  }, [viewingLessonId, isStudent, currentUser.completedLessonIds]);

  const filteredBnccList = useMemo(() => {
    return masterBnccSkills.filter(s => 
      s.grade.toLowerCase().includes(bnccGradeFilter.toLowerCase()) && 
      s.subject.toLowerCase().includes(bnccSubjectFilter.toLowerCase())
    );
  }, [masterBnccSkills, bnccGradeFilter, bnccSubjectFilter]);

  const isReadyToPublish = useMemo(() => {
    const hasHeader = schoolName.trim().length > 0 && subject.trim().length > 0 && teacherName.trim().length > 0;
    const hasBncc = noBncc || selectedBnccCodes.length > 0;
    const hasClasses = selectedClassIds.length > 0;
    const hasContent = generatedPlan?.content && generatedPlan.content.length > 0;
    return hasHeader && hasBncc && hasClasses && hasContent;
  }, [schoolName, subject, teacherName, noBncc, selectedBnccCodes, selectedClassIds, generatedPlan]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFileName(file.name);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        const part: ContentPart = { inlineData: { mimeType: file.type || 'application/pdf', data: result.split(',')[1] } };
        await processWithIA(part);
      };
      reader.readAsDataURL(file);
    }
  };

  const processWithIA = async (part: ContentPart) => {
    setLoading(true);
    try {
      const plan = await generateLessonPlanFromContent(subject || 'Geral', grade, 'Aula', part);
      setGeneratedPlan(plan);
      const questions = await generateLessonQuestions(part);
      setGeneratedQuestions(questions);
    } catch (error) {
      console.error(error);
      alert("Erro na IA. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!isReadyToPublish || !generatedPlan) return;
    setLoading(true);
    const lessonId = editingLessonId || Date.now().toString();
    const bnccString = noBncc ? 'Nenhuma habilidade vinculada' : selectedBnccCodes.join(', ');

    const lessonData: LessonPlan = {
      id: lessonId,
      ownerId: currentUser.id,
      title: generatedPlan.title || 'Plano de Aula',
      subject, grade, schoolName, teacherName,
      objectives: generatedPlan.objectives || [],
      content: generatedPlan.content || '',
      activities: generatedPlan.activities || [],
      assessment: generatedPlan.assessment || '',
      extraMaterials: extraLinks.filter(l => l.trim() !== ''),
      bnccSkills: bnccString,
      questions: generatedQuestions,
      linkedClassIds: selectedClassIds
    };

    try {
      await dbService.save('lessons', lessonId, lessonData);
      setShowGenerator(false);
      setEditingLessonId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = async () => {
    if (!viewingLessonId || !viewingLesson) return;
    const questionCount = viewingLesson.questions?.length || 0;
    if (Object.keys(studentAnswers).length < questionCount) {
      alert("Por favor, responda todas as questões antes de enviar.");
      return;
    }
    
    setLoading(true);
    try {
      await onCompleteLesson(viewingLessonId);
      setIsLessonSubmitted(true);
      alert("Atividade enviada com sucesso! Confira seu gabarito.");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const score = useMemo(() => {
    if (!viewingLesson?.questions) return 0;
    return viewingLesson.questions.filter((q, idx) => studentAnswers[idx] === q.correctAnswer).length;
  }, [viewingLesson, studentAnswers]);

  const handleEditLesson = (lesson: LessonPlan) => {
    setEditingLessonId(lesson.id);
    setSchoolName(lesson.schoolName);
    setSubject(lesson.subject);
    setTeacherName(lesson.teacherName);
    setGrade(lesson.grade);
    setSelectedClassIds(lesson.linkedClassIds || []);
    setExtraLinks(lesson.extraMaterials?.length ? lesson.extraMaterials : ['']);
    setGeneratedPlan({ title: lesson.title, content: lesson.content });
    setGeneratedQuestions(lesson.questions || []);
    setNoBncc(lesson.bnccSkills.includes('Nenhuma'));
    setSelectedBnccCodes(lesson.bnccSkills.includes('Nenhuma') ? [] : lesson.bnccSkills.split(',').map(c => c.trim()));
    setShowGenerator(true);
  };

  const handleFullDelete = async () => {
    if (!lessonToDelete) return;
    setLoading(true);
    try {
      await dbService.delete('lessons', lessonToDelete);
      setLessonToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const performanceLesson = useMemo(() => lessons.find(l => l.id === performanceLessonId), [lessons, performanceLessonId]);

  return (
    <div className="w-full max-w-[98%] lg:max-w-[1400px] flex flex-col gap-10 animate-desktop-in pb-32 text-gray-900">
      {performanceLesson && (
        <PerformanceModal 
          lesson={performanceLesson} 
          classes={classes} 
          onClose={() => setPerformanceLessonId(null)} 
        />
      )}

      {showGenerator && (
        <div className="w-full bg-white rounded-[3rem] p-6 md:p-12 shadow-2xl border border-gray-100 animate-desktop-in space-y-12">
          {/* O formulário de criação permanece o mesmo para Admins/Professores */}
          <header className="flex justify-between items-center border-b pb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <i className={`fa-solid ${editingLessonId ? 'fa-pen-to-square' : 'fa-wand-magic-sparkles'} text-xl`}></i>
              </div>
              <div>
                <h2 className="text-3xl font-black text-indigo-900 tracking-tight">{editingLessonId ? 'Editar Planejamento' : 'Novo Planejamento'}</h2>
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Ferramenta de Autoria Ensinoverso</p>
              </div>
            </div>
            <button onClick={() => { setShowGenerator(false); setEditingLessonId(null); setGeneratedPlan(null); }} className="text-gray-300 hover:text-red-500 transition-colors">
              <i className="fa-solid fa-circle-xmark text-4xl"></i>
            </button>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
            <div className="xl:col-span-3 space-y-8">
              <section className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 space-y-5 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">Identificação</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Instituição *</label>
                    <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Nome da Escola" className="w-full p-4 bg-white border border-gray-200 rounded-2xl font-bold focus:ring-2 ring-indigo-500 outline-none text-sm shadow-inner" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Disciplina *</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Componente Curricular" className="w-full p-4 bg-white border border-gray-200 rounded-2xl font-bold focus:ring-2 ring-indigo-500 outline-none text-sm shadow-inner" />
                  </div>
                </div>
              </section>

              <section className="bg-emerald-50/30 p-6 rounded-[2rem] border border-emerald-100 space-y-4 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 ml-1">Vincular Turmas *</h3>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {classes.map(cls => (
                    <button 
                      key={cls.id} 
                      onClick={() => setSelectedClassIds(prev => prev.includes(cls.id) ? prev.filter(i => i !== cls.id) : [...prev, cls.id])} 
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedClassIds.includes(cls.id) ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white border-emerald-100 text-emerald-900'}`}
                    >
                      <i className={`fa-solid ${cls.icon} text-xs opacity-50`}></i>
                      <span className="font-bold text-xs">{cls.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="xl:col-span-9 space-y-8">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className={`w-full py-16 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all ${loading ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-indigo-400 shadow-sm'}`}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-black text-[9px] text-indigo-500 uppercase tracking-widest">Processando Inteligência Artificial...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center text-indigo-500"><i className="fa-solid fa-file-pdf text-xl"></i></div>
                      <span className="font-black text-[10px] text-gray-900 uppercase tracking-widest">{pdfFileName || 'Importar PDF para Geração Automática'}</span>
                    </>
                  )}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="application/pdf" />

                {generatedPlan && (
                  <section className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-md space-y-4">
                    <input value={generatedPlan.title || ''} onChange={e => setGeneratedPlan({...generatedPlan, title: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl font-black text-sm outline-none" placeholder="Título" />
                    <textarea value={generatedPlan.content || ''} onChange={e => setGeneratedPlan({...generatedPlan, content: e.target.value})} className="w-full h-[32rem] p-8 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] leading-relaxed font-medium" />
                  </section>
                )}

                <button 
                  disabled={!isReadyToPublish || loading} 
                  onClick={handlePublish} 
                  className={`w-full py-8 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.5em] transition-all ${isReadyToPublish ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-300'}`}
                >
                  {editingLessonId ? 'SALVAR ALTERAÇÕES' : 'CONSOLIDAR PLANEJAMENTO'}
                </button>
            </div>
          </div>
        </div>
      )}

      {!showGenerator && !viewingLessonId && (
        <div className="space-y-10">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/20 pb-8">
            <div>
              <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-strong">Minha Estante de Aulas</h1>
              <p className="text-xl text-white/80 font-medium mt-2">{isStudent ? 'Conteúdos liberados para suas turmas.' : 'Sua produção acadêmica no Ensinoverso.'}</p>
            </div>
            {(isAdmin || isProfessor) && (
              <button onClick={() => setShowGenerator(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl">
                Criar Nova Aula
              </button>
            )}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {lessons.map(lesson => (
              <div key={lesson.id} className="bg-white/10 backdrop-blur-xl rounded-[3rem] border border-white/20 p-8 flex flex-col transition-all hover:bg-white/15 hover:-translate-y-2">
                 <div className="flex justify-between items-start mb-8">
                    <span className="bg-indigo-500/20 text-indigo-300 px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-widest">{lesson.subject}</span>
                    {currentUser.completedLessonIds?.includes(lesson.id) && (
                      <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-black text-[8px] uppercase tracking-widest border border-emerald-500/30">CONCLUÍDA</span>
                    )}
                 </div>
                 <h3 className="text-3xl font-black text-white mb-10 line-clamp-2 tracking-tight leading-tight">{lesson.title}</h3>
                 
                 <div className="mt-auto space-y-3">
                   <button onClick={() => setViewingLessonId(lesson.id)} className="w-full py-4 bg-white text-gray-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
                     Acessar Aula
                   </button>
                   {(isAdmin || isProfessor) && (
                     <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => handleEditLesson(lesson)} className="p-4 bg-white/5 hover:bg-white/10 text-white/40 rounded-2xl transition-all border border-white/10 flex justify-center"><i className="fa-solid fa-pen"></i></button>
                       <button onClick={() => setLessonToDelete(lesson.id)} className="p-4 bg-white/5 hover:bg-red-600 text-white/40 rounded-2xl transition-all border border-white/10 flex justify-center"><i className="fa-solid fa-trash"></i></button>
                     </div>
                   )}
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewingLessonId && viewingLesson && (
        <div className="w-full pb-40 animate-desktop-in">
          <div className="flex items-center gap-8 mb-16">
            <button onClick={() => setViewingLessonId(null)} className="w-16 h-16 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-2xl hover:bg-indigo-50 transition-all"><i className="fa-solid fa-chevron-left text-xl"></i></button>
            <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-strong">{viewingLesson.title}</h1>
          </div>
          
          <div className="bg-white text-gray-900 rounded-[4rem] p-12 md:p-20 shadow-2xl border border-white/40 space-y-20">
            <section className="space-y-10">
              <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-600 flex items-center gap-6"><div className="w-16 h-1 bg-indigo-600 rounded-full"></div> Conteúdo Teórico</h2>
              <div className="text-2xl leading-relaxed whitespace-pre-wrap font-medium text-gray-800 tracking-tight">{viewingLesson.content}</div>
            </section>

            {viewingLesson.questions && viewingLesson.questions.length > 0 && (
              <section className="space-y-10 border-t pt-20">
                 <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-emerald-600 flex items-center gap-6"><div className="w-16 h-1 bg-emerald-600 rounded-full"></div> Atividade de Verificação</h2>
                 
                 {isLessonSubmitted && (
                   <div className="bg-gray-900 p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl animate-scaleUp">
                      <p className="text-indigo-400 font-black uppercase text-xs tracking-widest ml-4">Desempenho Final</p>
                      <div className="flex items-center gap-6 pr-4">
                        <span className="text-white text-6xl font-black tracking-tighter">{score}<span className="text-white/20">/</span>{viewingLesson.questions.length}</span>
                        <div className="text-right">
                          <p className="text-white/40 font-black text-[9px] uppercase tracking-widest">Acertos</p>
                          <p className="text-emerald-400 font-bold text-xs">Gabarito Liberado</p>
                        </div>
                      </div>
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {viewingLesson.questions.map((q, idx) => {
                    const studentChoice = studentAnswers[idx];
                    const isCorrect = studentChoice === q.correctAnswer;
                    
                    return (
                      <div key={idx} className={`p-10 rounded-[3rem] border transition-all ${isLessonSubmitted ? (isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200') : 'bg-gray-50 border-gray-100'}`}>
                        <h4 className="font-black text-gray-900 leading-tight tracking-tight text-xl mb-8 flex items-start gap-4">
                          <span className="w-10 h-10 rounded-xl bg-gray-950 text-white flex items-center justify-center font-black text-sm shrink-0">{idx + 1}</span>
                          {q.question}
                        </h4>
                        <div className="space-y-3">
                          {q.options.map((opt, oIdx) => {
                            const isOptionCorrect = oIdx === q.correctAnswer;
                            const isOptionSelected = studentChoice === oIdx;
                            
                            let btnStyle = "w-full p-5 rounded-2xl border-2 transition-all flex items-center gap-4 text-left font-bold text-sm ";
                            
                            if (isLessonSubmitted) {
                              if (isOptionCorrect) btnStyle += "bg-emerald-600 border-emerald-600 text-white shadow-lg ";
                              else if (isOptionSelected && !isOptionCorrect) btnStyle += "bg-rose-600 border-rose-600 text-white shadow-lg ";
                              else btnStyle += "bg-white border-gray-100 text-gray-300 opacity-60 ";
                            } else {
                              if (isOptionSelected) btnStyle += "bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02] ";
                              else btnStyle += "bg-white border-gray-100 hover:border-indigo-300 text-gray-600 hover:bg-gray-50 ";
                            }

                            return (
                              <button 
                                key={oIdx} 
                                onClick={() => !isLessonSubmitted && setStudentAnswers({...studentAnswers, [idx]: oIdx})}
                                className={btnStyle}
                              >
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${isOptionSelected || (isLessonSubmitted && isOptionCorrect) ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!isLessonSubmitted && isStudent && (
                  <div className="pt-10 flex justify-center">
                    <button 
                      onClick={handleStudentSubmit} 
                      disabled={loading}
                      className="px-20 py-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-[2.5rem] uppercase text-sm tracking-[0.4em] shadow-2xl transition-all active:scale-95 disabled:grayscale"
                    >
                      {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Finalizar Atividade'}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {lessonToDelete && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-[3rem] p-12 text-center space-y-8">
             <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl"><i className="fa-solid fa-trash"></i></div>
             <h3 className="text-3xl font-black text-gray-900 tracking-tight">Excluir do Ensinoverso?</h3>
             <div className="flex flex-col gap-3">
               <button onClick={handleFullDelete} className="w-full py-6 bg-red-600 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl">Confirmar Exclusão</button>
               <button onClick={() => setLessonToDelete(null)} className="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Cancelar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonPlanner;
