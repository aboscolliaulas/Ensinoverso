
import React, { useMemo } from 'react';
import { LessonPlan, LessonPerformance, ClassRoom } from '../types';

interface PerformanceModalProps {
  lesson: LessonPlan;
  classes: ClassRoom[];
  onClose: () => void;
}

const PerformanceModal: React.FC<PerformanceModalProps> = ({ lesson, classes, onClose }) => {
  const performanceData: LessonPerformance[] = useMemo(() => {
    return lesson.linkedClassIds?.map(classId => {
      const cls = classes.find(c => c.id === classId);
      const students = cls?.students || [];
      const questionCount = lesson.questions?.length || 10;

      const studentScores = students.map(s => {
        // Mock de geração de desempenho realista baseado no progresso
        const correctAnswers = Math.min(questionCount, Math.floor(Math.random() * (questionCount + 1)) + Math.floor(questionCount * 0.4));
        const scorePercentage = Math.round((correctAnswers / questionCount) * 100);
        return {
          studentId: s.id,
          studentName: s.name,
          scorePercentage,
          correctAnswers
        };
      });

      const totalPercentage = studentScores.reduce((acc, curr) => acc + curr.scorePercentage, 0);
      const averageScore = studentScores.length ? Math.round(totalPercentage / studentScores.length) : 0;

      const questionStats = Array.from({ length: questionCount }, (_, qIdx) => {
        const baseDifficulty = 0.9 - (qIdx * 0.05);
        const correctCount = studentScores.filter(() => Math.random() < baseDifficulty).length;
        const correctRate = studentScores.length ? Math.round((correctCount / studentScores.length) * 100) : 0;
        return {
          questionIndex: qIdx,
          correctRate
        };
      });

      return {
        classId,
        className: cls?.name || 'Turma Desconhecida',
        averageScore,
        studentScores: studentScores.map(({ studentId, studentName, scorePercentage }) => ({ studentId, studentName, scorePercentage })),
        questionStats
      };
    }) || [];
  }, [lesson, classes]);

  const [activeTab, setActiveTab] = React.useState(0);
  const currentPerf = performanceData[activeTab];

  const exportFullPerformanceToDoc = (lesson: LessonPlan, data: LessonPerformance[]) => {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Relatório Consolidado de Desempenho - ${lesson.title}</title>
        <style>
          @page { size: 21cm 29.7cm; margin: 2.5cm; }
          body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.4; color: #333; }
          .header { text-align: center; border-bottom: 2pt solid #4f46e5; padding-bottom: 10pt; margin-bottom: 20pt; }
          h1 { font-size: 16pt; font-weight: bold; margin: 0; color: #4f46e5; }
          h2 { font-size: 13pt; font-weight: bold; margin-top: 25pt; border-bottom: 1pt solid #ccc; padding-bottom: 3pt; color: #1e1b4b; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: 20pt; }
          th, td { border: 0.5pt solid #ddd; padding: 10pt; text-align: left; }
          th { background-color: #f8fafc; font-weight: bold; font-size: 9pt; text-transform: uppercase; }
          .highlight { font-weight: bold; color: #4f46e5; }
          .class-section { page-break-before: always; }
          .class-section:first-child { page-break-before: auto; }
          .summary-box { background: #f0fdf4; padding: 15pt; border: 1pt solid #bbf7d0; border-radius: 8pt; margin-bottom: 20pt; }
        </style>
      </head>
      <body>
        <div class='header'>
          <h1>RELATÓRIO CONSOLIDADO DE DESEMPENHO</h1>
          <p>Ensinoverso - Sistema de Gestão Educacional por IA</p>
          <p><strong>AULA ANALISADA:</strong> ${lesson.title.toUpperCase()}</p>
          <p><strong>DOCENTE:</strong> ${lesson.teacherName}</p>
        </div>

        ${data.map(perf => `
          <div class='class-section'>
            <h2>DADOS DA TURMA: ${perf.className.toUpperCase()}</h2>
            <div class='summary-box'>
              <p><strong>APROVEITAMENTO MÉDIO DA TURMA:</strong> <span class='highlight'>${perf.averageScore}%</span></p>
              <p><strong>TOTAL DE ESTUDANTES AVALIADOS:</strong> ${perf.studentScores.length}</p>
            </div>

            <h3>Desempenho por Aluno</h3>
            <table>
              <thead>
                <tr>
                  <th>Estudante</th>
                  <th>Aproveitamento (%)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${perf.studentScores.sort((a,b) => b.scorePercentage - a.scorePercentage).map(s => `
                  <tr>
                    <td>${s.studentName}</td>
                    <td><strong>${s.scorePercentage}%</strong></td>
                    <td>${s.scorePercentage >= 60 ? 'Satisfatório' : 'Abaixo da Média'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <h3>Análise de Eficácia por Questão</h3>
            <table>
              <thead>
                <tr>
                  <th>Indicador de Questão</th>
                  <th>Índice de Acerto (%)</th>
                </tr>
              </thead>
              <tbody>
                ${perf.questionStats.map(q => `
                  <tr>
                    <td>Questão #${q.questionIndex + 1}</td>
                    <td><span class='highlight'>${q.correctRate}%</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Desempenho_Docente_${lesson.title.replace(/\s+/g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className="w-full max-w-6xl bg-white rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <header className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <span className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-md">Auditoria de Dados</span>
              <h2 className="text-3xl font-black text-indigo-950 tracking-tighter">{lesson.title}</h2>
            </div>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <i className="fa-solid fa-graduation-cap text-indigo-500"></i>
              Relatório Geral de Absorção Pedagógica
            </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => exportFullPerformanceToDoc(lesson, performanceData)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl active:scale-95"
            >
              <i className="fa-solid fa-file-export text-lg"></i>
              Exportar DOCX Consolidado
            </button>
            <button onClick={onClose} className="w-16 h-16 rounded-[1.5rem] bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all shadow-sm active:scale-90">
              <i className="fa-solid fa-xmark text-2xl"></i>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          {performanceData.length > 0 ? (
            <div className="space-y-16">
              <div className="flex flex-wrap gap-2 p-1.5 bg-gray-100 rounded-[2rem] w-fit shadow-inner">
                {performanceData.map((p, idx) => (
                  <button 
                    key={p.classId}
                    onClick={() => setActiveTab(idx)}
                    className={`px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === idx ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {p.className} <span className="ml-2 opacity-50">• {p.averageScore}%</span>
                  </button>
                ))}
              </div>

              {currentPerf && (
                <div className="space-y-12 animate-fadeIn">
                  <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-indigo-700 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-4">Aproveitamento Médio</p>
                      <span className="text-7xl font-black tracking-tighter block">{currentPerf.averageScore}%</span>
                      <p className="text-[10px] mt-6 font-bold uppercase tracking-widest opacity-40">Métrica da Turma: {currentPerf.className}</p>
                    </div>
                    <div className="bg-emerald-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-4">Melhor Desempenho</p>
                      <span className="text-7xl font-black tracking-tighter block">
                        {Math.max(...currentPerf.studentScores.map(s => s.scorePercentage))}%
                      </span>
                      <p className="text-[10px] mt-6 font-bold uppercase tracking-widest opacity-40">Pico de Aprendizagem</p>
                    </div>
                    <div className="bg-gray-950 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-4">Amostragem</p>
                      <span className="text-7xl font-black tracking-tighter block">{currentPerf.studentScores.length}</span>
                      <p className="text-[10px] mt-6 font-bold uppercase tracking-widest opacity-40">Estudantes Sincronizados</p>
                    </div>
                  </section>

                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
                    <section className="lg:col-span-3 space-y-8">
                      <div className="flex items-center justify-between border-b pb-4">
                        <h3 className="text-[12px] font-black text-indigo-900 uppercase tracking-[0.5em] flex items-center gap-4">
                          <i className="fa-solid fa-users-viewfinder text-indigo-600 text-xl"></i> Painel de Alunos
                        </h3>
                        <span className="text-[10px] font-black text-gray-300 uppercase">Ordenado por Nota</span>
                      </div>
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-6 custom-scrollbar">
                        {currentPerf.studentScores.sort((a,b) => b.scorePercentage - a.scorePercentage).map((s) => (
                          <div key={s.studentId} className="bg-gray-50 p-6 rounded-[2rem] flex items-center justify-between group hover:bg-white hover:shadow-2xl transition-all border border-transparent hover:border-indigo-100">
                            <div className="flex items-center gap-5">
                               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg ${s.scorePercentage >= 60 ? 'bg-emerald-100 text-emerald-600 shadow-emerald-50' : 'bg-rose-100 text-rose-600 shadow-rose-50'}`}>
                                 {s.studentName.charAt(0)}
                               </div>
                               <div>
                                 <p className="text-lg font-black text-gray-900 tracking-tight">{s.studentName}</p>
                                 <div className="w-56 h-2 bg-gray-200 rounded-full mt-3 overflow-hidden shadow-inner">
                                   <div className={`h-full rounded-full transition-all duration-1000 ${s.scorePercentage >= 75 ? 'bg-indigo-600' : s.scorePercentage >= 50 ? 'bg-amber-500' : 'bg-rose-600'}`} style={{ width: `${s.scorePercentage}%` }}></div>
                                 </div>
                               </div>
                            </div>
                            <div className="text-right">
                              <span className="text-3xl font-black text-indigo-950 tracking-tighter">{s.scorePercentage}%</span>
                              <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${s.scorePercentage >= 60 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {s.scorePercentage >= 60 ? 'Aprovado' : 'Revisão Necessária'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="lg:col-span-2 space-y-8">
                      <div className="flex items-center justify-between border-b pb-4">
                        <h3 className="text-[12px] font-black text-rose-900 uppercase tracking-[0.5em] flex items-center gap-4">
                          <i className="fa-solid fa-chart-bar text-rose-600 text-xl"></i> Eficácia do Quiz
                        </h3>
                        <span className="text-[10px] font-black text-gray-300 uppercase">Por Item</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {currentPerf.questionStats.map((q) => (
                          <div key={q.questionIndex} className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 flex flex-col items-center gap-3 transition-all hover:scale-[1.05] hover:shadow-xl group">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Questão {q.questionIndex + 1}</span>
                            <span className={`text-4xl font-black tracking-tighter ${q.correctRate > 80 ? 'text-emerald-600' : q.correctRate > 50 ? 'text-amber-600' : 'text-rose-600'}`}>{q.correctRate}%</span>
                            <div className="w-12 h-1 bg-gray-200 rounded-full group-hover:bg-indigo-200 transition-colors"></div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-gray-200">
              <div className="w-24 h-24 rounded-[2.5rem] bg-gray-50 flex items-center justify-center border-4 border-dashed border-gray-100 mb-6">
                <i className="fa-solid fa-chart-area text-4xl"></i>
              </div>
              <p className="font-black uppercase tracking-[0.4em] text-xs">Sincronize com turmas para gerar gráficos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceModal;
