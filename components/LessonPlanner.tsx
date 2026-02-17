
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { generateLessonPlanFromContent, generateLessonQuestions, ContentPart } from '../services/geminiService';
import { dbService } from '../services/firebase';
import { LessonPlan, QuizQuestion, ClassRoom, BNCCSkill, AppUser } from '../types';

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
  lessons, setLessons, classes, setClasses, viewingLessonId, setViewingLessonId, currentUser, onCompleteLesson
}) => {
  const isAdmin = currentUser.role === 'administrador';
  const isProfessor = currentUser.role === 'professor';
  const isStudent = currentUser.role === 'estudante';
  
  const [loading, setLoading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  
  // Quiz Local State
  const [studentAnswers, setStudentAnswers] = useState<Record<number, number>>({});
  const [isLessonSubmitted, setIsLessonSubmitted] = useState(false);

  // Form State
  const [schoolName, setSchoolName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherName, setTeacherName] = useState(currentUser.name);
  const [grade, setGrade] = useState('6º Ano');
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  
  const [generatedPlan, setGeneratedPlan] = useState<Partial<LessonPlan> | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);

  const viewingLesson = useMemo(() => lessons.find(l => l.id === viewingLessonId), [lessons, viewingLessonId]);

  useEffect(() => {
    if (viewingLessonId && isStudent) {
      const alreadyCompleted = currentUser.completedLessonIds?.includes(viewingLessonId);
      setIsLessonSubmitted(!!alreadyCompleted);
      setStudentAnswers({});
    }
  }, [viewingLessonId, isStudent, currentUser.completedLessonIds]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFileName(file.name);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        const part: ContentPart = { inlineData: { mimeType: file.type || 'application/pdf', data: result.split(',')[1] } };
        setLoading(true);
        try {
          const plan = await generateLessonPlanFromContent(subject || 'Geral', grade, 'Aula', part);
          setGeneratedPlan(plan);
          const questions = await generateLessonQuestions(part);
          setGeneratedQuestions(questions);
        } catch (error) {
          console.error(error);
          alert("Erro na IA ao processar PDF.");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePublish = async () => {
    if (!generatedPlan) return;
    setLoading(true);
    const lessonId = editingLessonId || Date.now().toString();

    const lessonData: LessonPlan = {
      id: lessonId,
      ownerId: currentUser.id,
      title: generatedPlan.title || 'Plano de Aula',
      subject, grade, schoolName, teacherName,
      objectives: generatedPlan.objectives || [],
      content: generatedPlan.content || '',
      activities: generatedPlan.activities || [],
      assessment: generatedPlan.assessment || '',
      bnccSkills: 'Nenhuma',
      questions: generatedQuestions,
      linkedClassIds: selectedClassIds
    };

    try {
      await dbService.save('lessons', lessonId, lessonData);
      setShowGenerator(false);
      setEditingLessonId(null);
      setGeneratedPlan(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = async () => {
    if (!viewingLessonId || !viewingLesson) return;
    if (Object.keys(studentAnswers).length < (viewingLesson.questions?.length || 0)) {
      alert("Por favor, responda todas as questões antes de enviar.");
      return;
    }
    setLoading(true);
    await onCompleteLesson(viewingLessonId);
    setIsLessonSubmitted(true);
    setLoading(false);
  };

  const score = useMemo(() => {
    if (!viewingLesson?.questions) return 0;
    return viewingLesson.questions.filter((q, idx) => studentAnswers[idx] === q.correctAnswer).length;
  }, [viewingLesson, studentAnswers]);

  return (
    <div className="w-full max-w-7xl animate-desktop-in pb-32">
      {/* Formulário de Criação (Modelo Original Limpo) */}
      {showGenerator && (
        <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl space-y-8 border border-gray-100 mb-10">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold text-gray-900">{editingLessonId ? 'Editar Aula' : 'Novo Planejamento'}</h2>
            <button onClick={() => setShowGenerator(false)} className="text-gray-400 hover:text-red-500 transition-colors">
              <i className="fa-solid fa-xmark text-2xl"></i>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Instituição</label>
              <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Nome da Escola" className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 ring-indigo-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Disciplina</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Componente Curricular" className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 ring-indigo-500" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Vincular Turmas</label>
            <div className="flex flex-wrap gap-2">
              {classes.map(cls => (
                <button 
                  key={cls.id}
                  onClick={() => setSelectedClassIds(prev => prev.includes(cls.id) ? prev.filter(i => i !== cls.id) : [...prev, cls.id])}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${selectedClassIds.includes(cls.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-200'}`}
                >
                  {cls.name}
                </button>
              ))}
            </div>
          </div>

          {!generatedPlan ? (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-16 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-indigo-50 transition-all group"
            >
              {loading ? (
                <i className="fa-solid fa-spinner animate-spin text-4xl text-indigo-600"></i>
              ) : (
                <i className="fa-solid fa-file-pdf text-4xl text-gray-300 group-hover:text-indigo-400"></i>
              )}
              <span className="font-bold text-gray-400 group-hover:text-indigo-600">
                {pdfFileName ? `Arquivo: ${pdfFileName}` : 'Clique para carregar o PDF e gerar a aula'}
              </span>
            </button>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              <input value={generatedPlan.title} onChange={e => setGeneratedPlan({...generatedPlan, title: e.target.value})} className="w-full p-4 font-bold border-b text-2xl outline-none" placeholder="Título da Aula" />
              <textarea value={generatedPlan.content} onChange={e => setGeneratedPlan({...generatedPlan, content: e.target.value})} className="w-full h-80 p-6 bg-gray-50 rounded-xl outline-none leading-relaxed" placeholder="Conteúdo da aula..." />
              <button onClick={handlePublish} className="w-full py-5 bg-indigo-600 text-white font-bold rounded-xl uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all">Publicar Aula</button>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="application/pdf" />
        </div>
      )}

      {/* Lista de Cards (Modelo Original Limpo) */}
      {!showGenerator && !viewingLessonId && (
        <div className="space-y-10">
          <header className="flex justify-between items-end border-b border-white/10 pb-8">
            <div>
              <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-strong">Biblioteca de Aulas</h1>
              <p className="text-xl text-white/60 font-medium mt-2">Acesse seus conteúdos pedagógicos.</p>
            </div>
            {(isAdmin || isProfessor) && (
              <button onClick={() => { setShowGenerator(true); setEditingLessonId(null); setGeneratedPlan(null); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95">
                Nova Aula
              </button>
            )}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {lessons.map(lesson => (
              <div key={lesson.id} className="bg-white rounded-[2rem] p-8 flex flex-col shadow-xl border border-gray-100 hover:-translate-y-2 transition-all">
                <div className="flex justify-between items-start mb-6">
                  <span className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">{lesson.subject}</span>
                  {currentUser.completedLessonIds?.includes(lesson.id) && (
                    <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-widest">Concluída</span>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-8 line-clamp-2 leading-tight">{lesson.title}</h3>
                
                <div className="mt-auto flex gap-2 pt-6 border-t">
                  <button onClick={() => setViewingLessonId(lesson.id)} className="flex-1 py-4 bg-gray-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all">Acessar</button>
                  {(isAdmin || isProfessor) && (
                    <button onClick={() => setLessonToDelete(lesson.id)} className="px-5 py-4 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-trash-can"></i></button>
                  )}
                </div>
              </div>
            ))}
            {lessons.length === 0 && (
              <div className="col-span-full py-20 text-center">
                 <p className="text-white/20 font-bold uppercase tracking-widest">Nenhuma aula encontrada para seu perfil.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visualização da Aula e Quiz (Fluxo Aluno) */}
      {viewingLessonId && viewingLesson && !showGenerator && (
        <div className="bg-white rounded-[2.5rem] p-10 md:p-16 shadow-2xl space-y-12 animate-desktop-in max-w-5xl mx-auto">
          <header className="flex justify-between items-start">
            <button onClick={() => setViewingLessonId(null)} className="text-indigo-600 font-bold flex items-center gap-2 hover:gap-4 transition-all"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{viewingLesson.subject}</p>
              <p className="text-sm font-bold text-gray-900">{viewingLesson.teacherName}</p>
            </div>
          </header>

          <div className="space-y-6">
            <h1 className="text-4xl font-black text-gray-900 leading-tight">{viewingLesson.title}</h1>
            <div className="text-xl leading-relaxed whitespace-pre-wrap text-gray-700 font-medium">{viewingLesson.content}</div>
          </div>

          {viewingLesson.questions && viewingLesson.questions.length > 0 && (
            <div className="pt-16 border-t space-y-10">
              <h2 className="text-3xl font-bold text-gray-900">Atividade Prática</h2>
              
              {isLessonSubmitted && (
                <div className="p-8 bg-indigo-600 text-white rounded-3xl text-center shadow-xl animate-scaleUp">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Seu Desempenho</p>
                  <p className="text-5xl font-black">{score} <span className="text-white/40">/</span> {viewingLesson.questions.length}</p>
                  <p className="mt-4 font-bold text-xs uppercase tracking-widest text-indigo-200">Gabarito liberado abaixo</p>
                </div>
              )}

              <div className="space-y-8">
                {viewingLesson.questions.map((q, qIdx) => (
                  <div key={qIdx} className={`p-8 rounded-[2rem] border transition-all ${isLessonSubmitted ? 'bg-gray-50' : 'bg-white border-gray-100'}`}>
                    <p className="font-bold text-lg mb-6 flex items-start gap-4">
                      <span className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0 text-sm font-black">{qIdx + 1}</span>
                      {q.question}
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = oIdx === q.correctAnswer;
                        const isSelected = studentAnswers[qIdx] === oIdx;
                        
                        let style = "p-5 rounded-xl border-2 text-left font-bold text-sm flex items-center gap-4 transition-all ";
                        
                        if (isLessonSubmitted) {
                          if (isCorrect) style += "bg-emerald-100 border-emerald-500 text-emerald-700 shadow-md ";
                          else if (isSelected) style += "bg-red-100 border-red-500 text-red-700 ";
                          else style += "bg-white border-gray-100 opacity-40 ";
                        } else {
                          style += isSelected 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg scale-[1.02] " 
                            : "bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50 text-gray-600 ";
                        }

                        return (
                          <button 
                            key={oIdx} 
                            disabled={isLessonSubmitted}
                            onClick={() => setStudentAnswers({...studentAnswers, [qIdx]: oIdx})}
                            className={style}
                          >
                            <span className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black ${isSelected || (isLessonSubmitted && isCorrect) ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {!isLessonSubmitted && isStudent && (
                <div className="flex justify-center pt-8">
                  <button 
                    onClick={handleStudentSubmit} 
                    className="px-16 py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-2xl transition-all active:scale-95"
                  >
                    Enviar Respostas para Correção
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Exclusão */}
      {lessonToDelete && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] text-center space-y-6 max-w-sm w-full shadow-2xl animate-scaleUp">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl"><i className="fa-solid fa-trash"></i></div>
            <h3 className="text-2xl font-bold text-gray-900">Excluir aula?</h3>
            <p className="text-gray-400 text-sm">Esta ação removerá a aula permanentemente.</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { dbService.delete('lessons', lessonToDelete); setLessonToDelete(null); }} className="w-full py-4 bg-red-600 text-white font-bold rounded-xl shadow-lg">Confirmar Exclusão</button>
              <button onClick={() => setLessonToDelete(null)} className="w-full py-4 text-gray-400 font-bold rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonPlanner;
