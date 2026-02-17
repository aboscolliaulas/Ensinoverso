
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
  
  const [loading, setLoading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [performanceLessonId, setPerformanceLessonId] = useState<string | null>(null);
  
  // Cabeçalho (Obrigatórios)
  const [schoolName, setSchoolName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherName, setTeacherName] = useState(currentUser.name === 'Usuário' ? 'Prof. André Boscolli' : currentUser.name);
  
  // Configurações e Importação
  const [grade, setGrade] = useState('6º Ano');
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [extraLinks, setExtraLinks] = useState<string[]>(['']);
  
  // BNCC (Obrigatório)
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
    
    if (!lesson.bnccSkills.includes('Nenhuma')) {
      setSelectedBnccCodes(lesson.bnccSkills.split(',').map(c => c.trim()));
    } else {
      setSelectedBnccCodes([]);
    }
    
    setShowGenerator(true);
  };

  const exportLessonToDoc = (lesson: LessonPlan) => {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          @page { size: 21cm 29.7cm; margin: 2.5cm; }
          body { font-family: 'Arial', sans-serif; line-height: 1.5; color: #333; }
          .header { text-align: center; border-bottom: 2pt solid #4f46e5; padding-bottom: 10pt; margin-bottom: 20pt; }
          h1 { color: #4f46e5; margin: 0; font-size: 18pt; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20pt; background: #f9fafb; border: 1pt solid #e5e7eb; }
          .info-table td { padding: 8pt; border: 1pt solid #e5e7eb; font-size: 10pt; }
          h2 { color: #1e1b4b; border-left: 4pt solid #4f46e5; padding-left: 10pt; margin-top: 25pt; font-size: 14pt; }
          .content { white-space: pre-wrap; font-size: 11pt; text-align: justify; }
          .quiz-box { margin-top: 20pt; }
          .question { margin-bottom: 15pt; page-break-inside: avoid; }
          .option { margin-left: 20pt; margin-top: 3pt; font-size: 10pt; }
          .gabarito { color: #059669; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class='header'>
          <h1>PLANO DE AULA: ${lesson.title.toUpperCase()}</h1>
          <p>Ensinoverso - Sistema Operacional de Ensino</p>
        </div>

        <table class='info-table'>
          <tr>
            <td><strong>ESCOLA:</strong> ${lesson.schoolName}</td>
            <td><strong>DISCIPLINA:</strong> ${lesson.subject}</td>
          </tr>
          <tr>
            <td><strong>PROFESSOR:</strong> ${lesson.teacherName}</td>
            <td><strong>SÉRIE:</strong> ${lesson.grade}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>HABILIDADES BNCC:</strong> ${lesson.bnccSkills}</td>
          </tr>
        </table>

        <h2>I. CONTEÚDO TEÓRICO (TRANSCRIÇÃO LITERAL)</h2>
        <div class='content'>${lesson.content}</div>

        ${lesson.extraMaterials?.length ? `
          <h2>II. MATERIAIS DE APOIO</h2>
          <ul>${lesson.extraMaterials.map(m => `<li>${m}</li>`).join('')}</ul>
        ` : ''}

        ${lesson.questions?.length ? `
          <h2>III. VERIFICAÇÃO DE APRENDIZAGEM</h2>
          <div class='quiz-box'>
            ${lesson.questions.map((q, i) => `
              <div class='question'>
                <p><strong>Questão ${i + 1}:</strong> ${q.question}</p>
                ${q.options.map((opt, oi) => `
                  <div class='option'>${String.fromCharCode(65 + oi)}) ${opt} ${q.correctAnswer === oi ? '<span class="gabarito">(GABARITO)</span>' : ''}</div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Aula_${lesson.title.replace(/\s+/g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);
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
      alert("Aula atualizada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const handleFullDelete = async () => {
    if (!lessonToDelete) return;
    setLoading(true);
    try {
      // 1. Remover vínculo de todas as turmas
      const classCleanupPromises = classes.map(async (cls) => {
        if (cls.lessons && cls.lessons.some(l => l.id === lessonToDelete)) {
          const updatedLessons = cls.lessons.filter(l => l.id !== lessonToDelete);
          return dbService.save('classes', cls.id, { ...cls, lessons: updatedLessons });
        }
      });

      // 2. Remover vínculo de todos os usuários
      const userCleanupPromises = users.map(async (u) => {
        if (u.completedLessonIds && u.completedLessonIds.includes(lessonToDelete)) {
          const updatedCompleted = u.completedLessonIds.filter(id => id !== lessonToDelete);
          return dbService.save('users', u.id, { ...u, completedLessonIds: updatedCompleted });
        }
      });

      await Promise.all([...classCleanupPromises, ...userCleanupPromises]);

      // 3. Deletar aula
      await dbService.delete('lessons', lessonToDelete);
      
      // Limpar visualização se necessário
      if (viewingLessonId === lessonToDelete) {
        setViewingLessonId(null);
      }
      
      setLessonToDelete(null);
      alert("Aula removida de todo o sistema com sucesso.");
    } catch (err) {
      console.error("Erro na exclusão total:", err);
      alert("Ocorreu um erro ao tentar realizar a exclusão total.");
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
      question: 'Nova Questão',
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
                <h2 className="text-3xl font-black text-indigo-900 tracking-tight">{editingLessonId ? 'Editar Planejamento' : 'Novo Planejamento'}</h2>
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Sincronização persistente Ensinoverso</p>
              </div>
            </div>
            <button onClick={() => { setShowGenerator(false); setEditingLessonId(null); setGeneratedQuestions([]); setGeneratedPlan(null); }} className="text-gray-300 hover:text-red-500 transition-colors">
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
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Docente *</label>
                    <input value={teacherName} onChange={e => setTeacherName(e.target.value)} placeholder="André Boscolli" className="w-full p-4 bg-white border border-gray-200 rounded-2xl font-bold focus:ring-2 ring-indigo-500 outline-none text-sm shadow-inner" />
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

              <section className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100 space-y-4 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-700 ml-1">Recursos Digitais</h3>
                <div className="space-y-2">
                  {extraLinks.map((link, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input value={link} onChange={e => { const nl = [...extraLinks]; nl[idx] = e.target.value; setExtraLinks(nl); }} placeholder="https://..." className="flex-1 p-3 bg-white border border-amber-200 rounded-xl text-[11px] font-bold shadow-inner" />
                      {idx === extraLinks.length - 1 && (
                        <button onClick={() => setExtraLinks([...extraLinks, ''])} className="w-10 h-10 bg-amber-600 text-white rounded-xl flex items-center justify-center hover:bg-amber-700 transition-colors"><i className="fa-solid fa-plus text-xs"></i></button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="xl:col-span-5 space-y-8">
              <section className="bg-purple-50/40 p-6 rounded-[2rem] border border-purple-100 space-y-6 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-700">Competências BNCC *</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={noBncc} onChange={e => setNoBncc(e.target.checked)} className="w-4 h-4 rounded text-purple-600" />
                    <span className="text-[9px] font-black uppercase text-purple-400">Não Aplicável</span>
                  </label>
                </div>

                {!noBncc && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={bnccGradeFilter} onChange={e => setBnccGradeFilter(e.target.value)} className="w-full p-3 bg-white border border-purple-200 rounded-xl text-[10px] font-bold outline-none shadow-inner">
                        {GRADES_YEARS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <select value={bnccSubjectFilter} onChange={e => setBnccSubjectFilter(e.target.value)} className="w-full p-3 bg-white border border-purple-200 rounded-xl text-[10px] font-bold outline-none shadow-inner">
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-2 custom-scrollbar border-t border-purple-100 pt-4">
                      {filteredBnccList.length > 0 ? filteredBnccList.map(skill => (
                        <button 
                          key={skill.id} 
                          onClick={() => setSelectedBnccCodes(prev => prev.includes(skill.code) ? prev.filter(c => c !== skill.code) : [...prev, skill.code])}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all flex flex-col gap-1 ${selectedBnccCodes.includes(skill.code) ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white border-purple-100 text-purple-900 hover:border-purple-300'}`}
                        >
                          <span className="text-[10px] font-black">{skill.code}</span>
                          <span className="text-[9px] font-medium leading-tight opacity-70 line-clamp-2">{skill.description}</span>
                        </button>
                      )) : (
                        <p className="text-center py-10 text-[10px] font-black opacity-30 uppercase italic">Importe habilidades para visualizar</p>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <div className="space-y-6">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className={`w-full py-12 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all ${loading ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-indigo-400 shadow-sm'}`}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-black text-[9px] text-indigo-500 uppercase tracking-widest">Processando Material...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center text-indigo-500"><i className="fa-solid fa-file-pdf text-xl"></i></div>
                      <span className="font-black text-[10px] text-gray-900 uppercase tracking-widest">{pdfFileName || 'Substituir ou Importar PDF Base'}</span>
                    </>
                  )}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="application/pdf" />

                {generatedPlan && (
                  <section className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-md space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Teoria Pedagógica (Transcrição Integral)</h3>
                    <input 
                      value={generatedPlan.title || ''} 
                      onChange={e => setGeneratedPlan({...generatedPlan, title: e.target.value})} 
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl font-black text-sm outline-none focus:bg-white transition-all shadow-inner" 
                      placeholder="Título do Documento" 
                    />
                    <textarea 
                      value={generatedPlan.content || ''} 
                      onChange={e => setGeneratedPlan({...generatedPlan, content: e.target.value})} 
                      className="w-full h-[32rem] p-8 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] leading-relaxed custom-scrollbar font-medium shadow-inner focus:bg-white transition-all" 
                      placeholder="O conteúdo teórico aparecerá aqui após a importação..."
                    />
                  </section>
                )}
              </div>
            </div>

            <div className="xl:col-span-4 space-y-8">
              <section className="bg-indigo-950 p-8 rounded-[2.5rem] border border-indigo-900 shadow-2xl space-y-8 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Verificação de Aprendizagem ({generatedQuestions.length})</h3>
                  <button onClick={handleAddQuestionManual} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2">
                    <i className="fa-solid fa-plus"></i> Manual
                  </button>
                </div>
                
                <div className="space-y-6 max-h-[65rem] overflow-y-auto pr-2 custom-scrollbar">
                  {generatedQuestions.length > 0 ? generatedQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10 relative group">
                      <button 
                        onClick={() => setGeneratedQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                        className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110"
                      >
                        <i className="fa-solid fa-xmark text-xs"></i>
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
                            <input value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-medium text-white outline-none focus:bg-white/10 transition-all" placeholder={`Opção ${String.fromCharCode(65+oIdx)}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center space-y-4 opacity-30">
                       <i className="fa-solid fa-list-check text-4xl text-white"></i>
                       <p className="text-[10px] font-black uppercase text-white tracking-widest">Sem questões registradas</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <footer className="pt-10 border-t flex flex-col items-center gap-6">
            {!isReadyToPublish && (
              <div className="bg-amber-50 px-8 py-4 rounded-full border border-amber-100 flex items-center gap-3 animate-pulse">
                <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Complete: Escola, Disciplina, Professor, Turma, BNCC e PDF de conteúdo.</p>
              </div>
            )}
            <button 
              disabled={!isReadyToPublish || loading} 
              onClick={handlePublish} 
              className={`w-full max-w-2xl py-8 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.5em] transition-all shadow-[0_30px_60px_rgba(79,70,229,0.2)] ${isReadyToPublish ? 'bg-indigo-600 text-white hover:scale-[1.02] hover:shadow-indigo-300' : 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-50'}`}
            >
              {loading ? <i className="fa-solid fa-spinner animate-spin mr-3"></i> : <i className="fa-solid fa-cloud-arrow-up mr-3"></i>}
              {editingLessonId ? 'SALVAR ALTERAÇÕES' : 'CONSOLIDAR PLANEJAMENTO'}
            </button>
          </footer>
        </div>
      )}

      {!showGenerator && !viewingLessonId && (
        <div className="space-y-10">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/20 pb-8">
            <div>
              <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-strong">Aulas Planejadas</h1>
              <p className="text-xl text-white/80 font-medium mt-2 max-w-xl">Central de planejamento pedagógico estruturado por IA.</p>
            </div>
            {(isAdmin || isProfessor) && (
              <button 
                onClick={() => { setShowGenerator(true); setEditingLessonId(null); setGeneratedPlan(null); setGeneratedQuestions([]); }} 
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-5 rounded-2xl font-black text-[11px] tracking-widest transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-3 uppercase"
              >
                <i className="fa-solid fa-plus text-lg"></i> Criar Nova Aula
              </button>
            )}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {lessons.map(lesson => (
              <div key={lesson.id} className="group relative bg-white/10 backdrop-blur-xl rounded-[3rem] border border-white/20 p-8 flex flex-col min-h-[460px] transition-all hover:bg-white/15 hover:shadow-[0_40px_80px_rgba(0,0,0,0.4)] hover:-translate-y-2">
                 <div className="flex justify-between items-start mb-8">
                    <span className="bg-indigo-500/20 text-indigo-300 px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-widest border border-indigo-500/30">
                      {lesson.subject}
                    </span>
                    <span className="text-white/20 text-[10px] font-black uppercase tracking-widest">{lesson.grade}</span>
                 </div>
                 
                 <h3 className="text-3xl font-black text-white mb-6 line-clamp-2 leading-tight group-hover:text-indigo-300 transition-colors tracking-tight">{lesson.title}</h3>
                 
                 <div className="space-y-3 mb-10">
                   <div className="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                     <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center"><i className="fa-solid fa-school text-[8px]"></i></div>
                     {lesson.schoolName}
                   </div>
                   <div className="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                     <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center"><i className="fa-solid fa-user-tie text-[8px]"></i></div>
                     {lesson.teacherName}
                   </div>
                 </div>
                 
                 <div className="mt-auto pt-8 border-t border-white/10 space-y-3">
                   <button onClick={() => setViewingLessonId(lesson.id)} className="w-full py-4 bg-white text-gray-900 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] transition-all hover:bg-indigo-600 hover:text-white shadow-lg active:scale-95">
                     Acessar Conteúdo
                   </button>
                   
                   <div className="grid grid-cols-4 gap-2">
                     <button onClick={() => handleEditLesson(lesson)} className="p-4 bg-white/5 hover:bg-indigo-600 text-white/40 hover:text-white rounded-2xl transition-all border border-white/10 flex flex-col items-center justify-center gap-1 group/btn" title="Editar">
                       <i className="fa-solid fa-pen text-sm"></i>
                       <span className="text-[7px] font-black hidden group-hover/btn:block uppercase">Edit</span>
                     </button>
                     <button onClick={() => exportLessonToDoc(lesson)} className="p-4 bg-white/5 hover:bg-emerald-600 text-white/40 hover:text-white rounded-2xl transition-all border border-white/10 flex flex-col items-center justify-center gap-1 group/btn" title="Exportar DOCX">
                       <i className="fa-solid fa-file-word text-sm"></i>
                       <span className="text-[7px] font-black hidden group-hover/btn:block uppercase">Docx</span>
                     </button>
                     <button onClick={() => setPerformanceLessonId(lesson.id)} className="p-4 bg-white/5 hover:bg-amber-600 text-white/40 hover:text-white rounded-2xl transition-all border border-white/10 flex flex-col items-center justify-center gap-1 group/btn" title="Desempenho">
                       <i className="fa-solid fa-chart-line text-sm"></i>
                       <span className="text-[7px] font-black hidden group-hover/btn:block uppercase">Dash</span>
                     </button>
                     <button onClick={() => setLessonToDelete(lesson.id)} className="p-4 bg-white/5 hover:bg-red-600 text-white/40 hover:text-white rounded-2xl transition-all border border-white/10 flex flex-col items-center justify-center gap-1 group/btn" title="Excluir">
                       <i className="fa-solid fa-trash-can text-sm"></i>
                       <span className="text-[7px] font-black hidden group-hover/btn:block uppercase">Del</span>
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
            <button onClick={() => setViewingLessonId(null)} className="w-20 h-20 rounded-[2.5rem] bg-white text-indigo-600 flex items-center justify-center shadow-2xl hover:bg-indigo-50 transition-all active:scale-95"><i className="fa-solid fa-chevron-left text-2xl"></i></button>
            <div className="space-y-1">
              <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-strong">{viewingLesson.title}</h1>
              <div className="flex items-center gap-4 text-white/50 text-[11px] font-black uppercase tracking-widest">
                <span>{viewingLesson.schoolName}</span>
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                <span className="text-indigo-400">{viewingLesson.teacherName}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white text-gray-900 rounded-[4rem] p-12 md:p-20 shadow-[0_60px_120px_rgba(0,0,0,0.5)] border border-white/40 space-y-20">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-8 border-b pb-12">
               <div>
                 <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Instituição</p>
                 <p className="text-xl font-black text-gray-900">{viewingLesson.schoolName}</p>
               </div>
               <div>
                 <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Disciplina / Série</p>
                 <p className="text-xl font-black text-gray-900">{viewingLesson.subject} • {viewingLesson.grade}</p>
               </div>
               <div>
                 <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Docente Responsável</p>
                 <p className="text-xl font-black text-gray-900">{viewingLesson.teacherName}</p>
               </div>
            </section>

            <section className="space-y-10">
              <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-600 flex items-center gap-6">
                <div className="w-16 h-1 bg-indigo-600 rounded-full"></div> Conteúdo Teórico Literal
              </h2>
              <div className="text-2xl leading-relaxed whitespace-pre-wrap font-medium text-gray-800 tracking-tight">
                {viewingLesson.content}
              </div>
            </section>

            <section className="space-y-8">
              <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-purple-600 flex items-center gap-6">
                <div className="w-16 h-1 bg-purple-600 rounded-full"></div> Competências e Habilidades BNCC
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

            {viewingLesson.extraMaterials && viewingLesson.extraMaterials.filter(l => l.trim()).length > 0 && (
              <section className="space-y-8">
                <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-amber-600 flex items-center gap-6">
                  <div className="w-16 h-1 bg-amber-600 rounded-full"></div> Materiais de Apoio e Links
                </h2>
                <div className="flex flex-wrap gap-4">
                  {viewingLesson.extraMaterials.filter(l => l.trim()).map((link, idx) => (
                    <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="px-8 py-4 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] font-black text-amber-900 hover:bg-amber-600 hover:text-white transition-all flex items-center gap-3">
                      <i className="fa-solid fa-link"></i> RECURSO EXTERNO {idx + 1}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {viewingLesson.questions && viewingLesson.questions.length > 0 && (
              <section className="space-y-10">
                 <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-emerald-600 flex items-center gap-6">
                  <div className="w-16 h-1 bg-emerald-600 rounded-full"></div> Verificação de Aprendizado (Gabarito)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {viewingLesson.questions.map((q, idx) => (
                    <div key={idx} className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 space-y-6 shadow-sm relative group overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 -mr-12 -mt-12 rounded-full"></div>
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
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-[3rem] p-12 text-center space-y-8 shadow-2xl">
             <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner"><i className="fa-solid fa-trash-can"></i></div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">Excluir do Ensinoverso?</h3>
                <p className="text-gray-400 font-medium text-sm">O plano de aula e todos os vínculos em turmas e registros de alunos serão removidos permanentemente.</p>
             </div>
             <div className="flex flex-col gap-3">
               <button 
                 onClick={handleFullDelete} 
                 className="w-full py-6 bg-red-600 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl hover:bg-red-700 transition-colors"
                 disabled={loading}
               >
                 {loading ? <i className="fa-solid fa-spinner animate-spin mr-2"></i> : null}
                 Confirmar Exclusão
               </button>
               <button onClick={() => setLessonToDelete(null)} className="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-gray-600 transition-colors">Cancelar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonPlanner;
