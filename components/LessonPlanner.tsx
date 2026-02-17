
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
  lessons, setLessons, classes, setClasses, viewingLessonId, setViewingLessonId, masterBnccSkills, currentUser, users, setUsers
}) => {
  const isAdmin = currentUser.role === 'administrador';
  const isProfessor = currentUser.role === 'professor';
  const isStudent = currentUser.role === 'estudante';
  
  const [loading, setLoading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [performanceLessonId, setPerformanceLessonId] = useState<string | null>(null);
  
  // Cabeçalho
  const [schoolName, setSchoolName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherName, setTeacherName] = useState(currentUser.name);
  const [grade, setGrade] = useState('6º Ano');
  
  // Configurações e Importação
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [extraLinks, setExtraLinks] = useState<string[]>(['']);
  
  // BNCC
  const [bnccGradeFilter, setBnccGradeFilter] = useState('6º Ano');
  const [bnccSubjectFilter, setBnccSubjectFilter] = useState('Português');
  const [selectedBnccCodes, setSelectedBnccCodes] = useState<string[]>([]);
  const [noBncc, setNoBncc] = useState(false);
  
  // Conteúdo Gerado
  const [generatedPlan, setGeneratedPlan] = useState<Partial<LessonPlan> | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);

  const filteredBnccList = useMemo(() => {
    return masterBnccSkills.filter(s => 
      s.grade.toLowerCase().includes(bnccGradeFilter.toLowerCase()) && 
      s.subject.toLowerCase().includes(bnccSubjectFilter.toLowerCase())
    );
  }, [masterBnccSkills, bnccGradeFilter, bnccSubjectFilter]);

  const isReadyToPublish = useMemo(() => {
    const hasHeader = schoolName.trim().length > 0 && subject.trim().length > 0;
    const hasBncc = noBncc || selectedBnccCodes.length > 0;
    const hasClasses = selectedClassIds.length > 0;
    const hasContent = generatedPlan?.content && generatedPlan.content.length > 0;
    return hasHeader && hasBncc && hasClasses && hasContent;
  }, [schoolName, subject, noBncc, selectedBnccCodes, selectedClassIds, generatedPlan]);

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
          alert("Erro na IA ao processar o material.");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditLesson = (lesson: LessonPlan) => {
    setEditingLessonId(lesson.id);
    setSchoolName(lesson.schoolName);
    setSubject(lesson.subject);
    setTeacherName(lesson.teacherName);
    setGrade(lesson.grade);
    setSelectedClassIds(lesson.linkedClassIds || []);
    setExtraLinks(lesson.extraMaterials?.length ? lesson.extraMaterials : ['']);
    setGeneratedPlan({ 
      title: lesson.title, 
      content: lesson.content,
      objectives: lesson.objectives,
      activities: lesson.activities,
      assessment: lesson.assessment
    });
    setGeneratedQuestions(lesson.questions || []);
    setNoBncc(lesson.bnccSkills.includes('Nenhuma'));
    if (!lesson.bnccSkills.includes('Nenhuma')) {
      setSelectedBnccCodes(lesson.bnccSkills.split(',').map(c => c.trim()));
    } else {
      setSelectedBnccCodes([]);
    }
    setShowGenerator(true);
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
      
      const updatePromises = classes.map(async (cls) => {
        const isLinked = selectedClassIds.includes(cls.id);
        const currentLessons = cls.lessons || [];
        const exists = currentLessons.find(l => l.id === lessonId);

        if (isLinked) {
          if (!exists) {
            const updatedLessons = [...currentLessons, { 
              id: lessonId, 
              title: lessonData.title, 
              date: new Date().toLocaleDateString('pt-BR'), 
              category: lessonData.subject 
            }];
            return dbService.save('classes', cls.id, { ...cls, lessons: updatedLessons });
          } else {
            const updatedLessons = currentLessons.map(l => l.id === lessonId ? { ...l, title: lessonData.title, category: lessonData.subject } : l);
            return dbService.save('classes', cls.id, { ...cls, lessons: updatedLessons });
          }
        } else if (exists) {
          const updatedLessons = currentLessons.filter(l => l.id !== lessonId);
          return dbService.save('classes', cls.id, { ...cls, lessons: updatedLessons });
        }
      });

      await Promise.all(updatePromises);
      setShowGenerator(false);
      setEditingLessonId(null);
      setGeneratedPlan(null);
      setGeneratedQuestions([]);
      alert("Aula publicada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar a aula.");
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const newList = [...generatedQuestions];
    newList[idx] = { ...newList[idx], [field]: value };
    setGeneratedQuestions(newList);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const newList = [...generatedQuestions];
    newList[qIdx].options[oIdx] = value;
    setGeneratedQuestions(newList);
  };

  const handleAddQuestionManual = () => {
    const newQuestion: QuizQuestion = {
      question: 'Nova Pergunta',
      options: ['', '', '', ''],
      correctAnswer: 0
    };
    setGeneratedQuestions([...generatedQuestions, newQuestion]);
  };

  const viewingLesson = useMemo(() => lessons.find(l => l.id === viewingLessonId), [lessons, viewingLessonId]);
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
        <div className="w-full bg-white rounded-[3rem] p-6 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.15)] border border-gray-100 animate-desktop-in space-y-12">
          <header className="flex justify-between items-center border-b pb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <i className={`fa-solid ${editingLessonId ? 'fa-pen-to-square' : 'fa-wand-magic-sparkles'} text-xl`}></i>
              </div>
              <div>
                <h2 className="text-3xl font-black text-indigo-900 tracking-tight">{editingLessonId ? 'Editar Aula' : 'Novo Planejamento'}</h2>
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Ferramenta Unificada Ensinoverso</p>
              </div>
            </div>
            <button onClick={() => { setShowGenerator(false); setEditingLessonId(null); setGeneratedQuestions([]); setGeneratedPlan(null); }} className="text-gray-300 hover:text-red-500 transition-colors">
              <i className="fa-solid fa-circle-xmark text-4xl"></i>
            </button>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
            <div className="xl:col-span-3 space-y-8">
              <section className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 space-y-5 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">Identificação Básica</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Escola *</label>
                    <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Instituição de Ensino" className="w-full p-4 bg-white border border-gray-200 rounded-2xl font-bold focus:ring-2 ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Disciplina *</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Matéria" className="w-full p-4 bg-white border border-gray-200 rounded-2xl font-bold focus:ring-2 ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Professor *</label>
                    <input value={teacherName} onChange={e => setTeacherName(e.target.value)} placeholder="Nome do Docente" className="w-full p-4 bg-white border border-gray-200 rounded-2xl font-bold focus:ring-2 ring-indigo-500 outline-none text-sm" />
                  </div>
                </div>
              </section>

              <section className="bg-emerald-50/30 p-6 rounded-[2rem] border border-emerald-100 space-y-4 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 ml-1">Público Alvo (Turmas) *</h3>
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

              <section className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100 space-y-4 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-700 ml-1">Materiais de Apoio</h3>
                <div className="space-y-2">
                  {extraLinks.map((link, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input value={link} onChange={e => { const nl = [...extraLinks]; nl[idx] = e.target.value; setExtraLinks(nl); }} placeholder="https://..." className="flex-1 p-3 bg-white border border-amber-200 rounded-xl text-[11px] font-bold" />
                    </div>
                  ))}
                  <button onClick={() => setExtraLinks([...extraLinks, ''])} className="text-xs font-bold text-amber-600 uppercase tracking-widest mt-2 hover:text-amber-800 transition-colors">+ Adicionar Link</button>
                </div>
              </section>
            </div>

            <div className="xl:col-span-5 space-y-8">
              <section className="bg-purple-50/40 p-6 rounded-[2rem] border border-purple-100 space-y-6 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-700">Referencial BNCC *</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={noBncc} onChange={e => setNoBncc(e.target.checked)} className="w-4 h-4 rounded text-purple-600" />
                    <span className="text-[9px] font-black uppercase text-purple-400">Plano sem BNCC</span>
                  </label>
                </div>

                {!noBncc && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={bnccGradeFilter} onChange={e => setBnccGradeFilter(e.target.value)} className="w-full p-3 bg-white border border-purple-200 rounded-xl text-[10px] font-bold outline-none">
                        {GRADES_YEARS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <select value={bnccSubjectFilter} onChange={e => setBnccSubjectFilter(e.target.value)} className="w-full p-3 bg-white border border-purple-200 rounded-xl text-[10px] font-bold outline-none">
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-2 custom-scrollbar border-t border-purple-100 pt-4">
                      {filteredBnccList.map(skill => (
                        <button 
                          key={skill.id} 
                          onClick={() => setSelectedBnccCodes(prev => prev.includes(skill.code) ? prev.filter(c => c !== skill.code) : [...prev, skill.code])}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all flex flex-col gap-1 ${selectedBnccCodes.includes(skill.code) ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white border-purple-100 text-purple-900 hover:border-purple-300'}`}
                        >
                          <span className="text-[10px] font-black">{skill.code}</span>
                          <span className="text-[9px] font-medium leading-tight opacity-70 line-clamp-2">{skill.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <div className="space-y-6">
                {!generatedPlan ? (
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className={`w-full py-16 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all ${loading ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-indigo-400 shadow-sm'}`}
                  >
                    {loading ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-black text-[9px] text-indigo-500 uppercase tracking-widest">IA Processando Documento...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-indigo-500"><i className="fa-solid fa-file-pdf text-2xl"></i></div>
                        <span className="font-black text-[10px] text-gray-900 uppercase tracking-widest">{pdfFileName || 'Carregar PDF para Gerar Aula'}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <section className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-lg space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Título da Aula</label>
                      <input value={generatedPlan.title || ''} onChange={e => setGeneratedPlan({...generatedPlan, title: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl font-black text-sm outline-none focus:bg-white transition-all" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Objetivos Pedagógicos</label>
                      <textarea value={generatedPlan.objectives?.join('\n') || ''} onChange={e => setGeneratedPlan({...generatedPlan, objectives: e.target.value.split('\n')})} className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:bg-white transition-all" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Conteúdo Teórico</label>
                      <textarea value={generatedPlan.content || ''} onChange={e => setGeneratedPlan({...generatedPlan, content: e.target.value})} className="w-full h-80 p-6 bg-gray-50 border border-gray-100 rounded-xl text-xs leading-relaxed outline-none focus:bg-white transition-all" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Atividades Práticas</label>
                      <textarea value={generatedPlan.activities?.join('\n') || ''} onChange={e => setGeneratedPlan({...generatedPlan, activities: e.target.value.split('\n')})} className="w-full h-40 p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:bg-white transition-all" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Critérios de Avaliação</label>
                      <textarea value={generatedPlan.assessment || ''} onChange={e => setGeneratedPlan({...generatedPlan, assessment: e.target.value})} className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:bg-white transition-all" />
                    </div>
                  </section>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="application/pdf" />
              </div>
            </div>

            <div className="xl:col-span-4 space-y-8">
              <section className="bg-indigo-950 p-8 rounded-[2.5rem] border border-indigo-900 shadow-2xl space-y-8 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Banco de Questões ({generatedQuestions.length})</h3>
                  <button onClick={handleAddQuestionManual} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                    + Manual
                  </button>
                </div>
                
                <div className="space-y-6 max-h-[75rem] overflow-y-auto pr-2 custom-scrollbar">
                  {generatedQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10 relative group">
                      <button 
                        onClick={() => setGeneratedQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                      >
                        <i className="fa-solid fa-trash text-[10px]"></i>
                      </button>
                      <textarea 
                        value={q.question} 
                        onChange={e => updateQuestion(qIdx, 'question', e.target.value)} 
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-xl font-bold text-[11px] text-white outline-none focus:bg-white/10 transition-all" 
                        placeholder="Pergunta..."
                      />
                      <div className="grid grid-cols-1 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex gap-2 items-center">
                            <button onClick={() => updateQuestion(qIdx, 'correctAnswer', oIdx)} className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${q.correctAnswer === oIdx ? 'bg-emerald-500 text-white shadow-md' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                              {String.fromCharCode(65 + oIdx)}
                            </button>
                            <input value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-medium text-white outline-none focus:bg-white/10 transition-all" placeholder="Alternativa" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <footer className="pt-10 border-t flex justify-center">
            <button 
              disabled={!isReadyToPublish || loading} 
              onClick={handlePublish} 
              className={`w-full max-w-xl py-8 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.5em] transition-all shadow-2xl ${isReadyToPublish ? 'bg-indigo-600 text-white hover:scale-105 hover:bg-indigo-500' : 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-50'}`}
            >
              {loading ? <i className="fa-solid fa-spinner animate-spin mr-3"></i> : <i className="fa-solid fa-cloud-arrow-up mr-3"></i>}
              {editingLessonId ? 'SALVAR ALTERAÇÕES' : 'PUBLICAR PLANEJAMENTO COMPLETO'}
            </button>
          </footer>
        </div>
      )}

      {!showGenerator && !viewingLessonId && (
        <div className="space-y-10">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/20 pb-8">
            <div>
              <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-strong">Minhas Aulas</h1>
              <p className="text-xl text-white/80 font-medium mt-2 max-w-xl">Gerenciamento completo do seu acervo pedagógico.</p>
            </div>
            {(isAdmin || isProfessor) && (
              <button 
                onClick={() => { setShowGenerator(true); setEditingLessonId(null); setGeneratedPlan(null); setGeneratedQuestions([]); setPdfFileName(null); setSelectedClassIds([]); setSelectedBnccCodes([]); setExtraLinks(['']); }} 
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-5 rounded-2xl font-black text-[11px] tracking-widest transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-3 uppercase"
              >
                <i className="fa-solid fa-plus text-lg"></i> Criar Nova Aula
              </button>
            )}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {lessons.map(lesson => (
              <div key={lesson.id} className="group relative bg-white/10 backdrop-blur-xl rounded-[3rem] border border-white/20 p-8 flex flex-col min-h-[460px] transition-all hover:bg-white/15 hover:shadow-2xl hover:-translate-y-2">
                 <div className="flex justify-between items-start mb-8">
                    <span className="bg-indigo-500/20 text-indigo-300 px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-widest border border-indigo-500/30">
                      {lesson.subject}
                    </span>
                    <span className="text-white/20 text-[10px] font-black uppercase tracking-widest">{lesson.grade}</span>
                 </div>
                 
                 <h3 className="text-3xl font-black text-white mb-6 line-clamp-2 leading-tight group-hover:text-indigo-300 transition-colors tracking-tight">{lesson.title}</h3>
                 
                 <div className="space-y-3 mb-10 text-white/40 text-[10px] font-black uppercase tracking-widest">
                   <div className="flex items-center gap-3"><i className="fa-solid fa-school w-5 text-center"></i> {lesson.schoolName}</div>
                   <div className="flex items-center gap-3"><i className="fa-solid fa-user-tie w-5 text-center"></i> {lesson.teacherName}</div>
                 </div>
                 
                 <div className="mt-auto pt-8 border-t border-white/10 space-y-3">
                   <button onClick={() => setViewingLessonId(lesson.id)} className="w-full py-4 bg-white text-gray-900 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] transition-all hover:bg-indigo-600 hover:text-white shadow-lg active:scale-95">
                     ABRIR CONTEÚDO
                   </button>
                   
                   <div className="grid grid-cols-4 gap-2">
                     <button onClick={() => handleEditLesson(lesson)} className="p-4 bg-white/5 hover:bg-indigo-600 text-white/40 hover:text-white rounded-2xl transition-all border border-white/10 flex items-center justify-center group/btn" title="Editar">
                       <i className="fa-solid fa-pen text-sm"></i>
                     </button>
                     <button onClick={() => setPerformanceLessonId(lesson.id)} className="p-4 bg-white/5 hover:bg-amber-600 text-white/40 hover:text-white rounded-2xl transition-all border border-white/10 flex items-center justify-center group/btn" title="Desempenho">
                       <i className="fa-solid fa-chart-line text-sm"></i>
                     </button>
                     <button onClick={() => setLessonToDelete(lesson.id)} className="p-4 bg-white/5 hover:bg-red-600 text-white/40 hover:text-white rounded-2xl transition-all border border-white/10 flex items-center justify-center group/btn" title="Excluir">
                       <i className="fa-solid fa-trash-can text-sm"></i>
                     </button>
                   </div>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewingLessonId && viewingLesson && !showGenerator && (
        <div className="w-full pb-40 animate-desktop-in">
          <div className="flex items-center gap-8 mb-16">
            <button onClick={() => setViewingLessonId(null)} className="w-20 h-20 rounded-[2.5rem] bg-white text-indigo-600 flex items-center justify-center shadow-2xl hover:bg-indigo-50 transition-all"><i className="fa-solid fa-chevron-left text-2xl"></i></button>
            <div className="space-y-1">
              <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-strong">{viewingLesson.title}</h1>
              <div className="flex items-center gap-4 text-white/50 text-[11px] font-black uppercase tracking-widest">
                <span>{viewingLesson.schoolName}</span>
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                <span className="text-indigo-400">{viewingLesson.teacherName}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white text-gray-900 rounded-[4rem] p-12 md:p-20 shadow-2xl border border-white/40 space-y-20">
            <section className="space-y-10">
              <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-600 flex items-center gap-6">
                <div className="w-16 h-1 bg-indigo-600 rounded-full"></div> Conteúdo Pedagógico
              </h2>
              <div className="text-2xl leading-relaxed whitespace-pre-wrap font-medium text-gray-800 tracking-tight">
                {viewingLesson.content}
              </div>
            </section>

            {viewingLesson.bnccSkills && (
              <section className="space-y-8">
                <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-purple-600 flex items-center gap-6">
                  <div className="w-16 h-1 bg-purple-600 rounded-full"></div> Referencial BNCC
                </h2>
                <div className="bg-purple-50 p-10 rounded-[2.5rem] border border-purple-100 flex items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center text-purple-600 shrink-0">
                    <i className="fa-solid fa-graduation-cap text-2xl"></i>
                  </div>
                  <p className="text-lg font-bold text-purple-900 leading-relaxed uppercase tracking-wide">
                    {viewingLesson.bnccSkills}
                  </p>
                </div>
              </section>
            )}

            {viewingLesson.questions && viewingLesson.questions.length > 0 && (
              <section className="space-y-10">
                 <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-emerald-600 flex items-center gap-6">
                  <div className="w-16 h-1 bg-emerald-600 rounded-full"></div> Atividades de Verificação
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {viewingLesson.questions.map((q, idx) => (
                    <div key={idx} className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 space-y-6 shadow-sm relative group overflow-hidden">
                      <div className="flex items-center gap-3 mb-2">
                         <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">Q{idx + 1}</span>
                         <h4 className="font-black text-gray-900 leading-tight tracking-tight">{q.question}</h4>
                      </div>
                      <div className="space-y-3">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className={`p-4 rounded-2xl border flex items-center gap-4 text-sm font-bold transition-all ${q.correctAnswer === oIdx ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-white border-gray-100 text-gray-400 opacity-60'}`}>
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${q.correctAnswer === oIdx ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-300'}`}>
                               {String.fromCharCode(65 + oIdx)}
                             </div>
                             {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {lessonToDelete && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
          <div className="w-full max-w-md bg-white rounded-[3rem] p-12 text-center space-y-8 shadow-2xl">
             <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner"><i className="fa-solid fa-trash-can"></i></div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">Excluir Aula?</h3>
                <p className="text-gray-400 font-medium text-sm">Esta ação removerá permanentemente a aula do seu acervo e das turmas vinculadas.</p>
             </div>
             <div className="flex flex-col gap-3">
               <button 
                 onClick={async () => {
                    setLoading(true);
                    await dbService.delete('lessons', lessonToDelete);
                    if (viewingLessonId === lessonToDelete) setViewingLessonId(null);
                    setLessonToDelete(null);
                    setLoading(false);
                 }} 
                 className="w-full py-6 bg-red-600 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl"
                 disabled={loading}
               >
                 Confirmar Exclusão
               </button>
               <button onClick={() => setLessonToDelete(null)} className="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Cancelar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonPlanner;
