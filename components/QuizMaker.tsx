
import React, { useState } from 'react';
import { generateQuiz } from '../services/geminiService';
import { QuizQuestion } from '../types';

const QuizMaker: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('5º Ano');
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleCreate = async () => {
    if (!topic) return;
    setLoading(true);
    setQuiz(null);
    setShowResults(false);
    setUserAnswers([]);
    try {
      const questions = await generateQuiz('Geral', grade, topic, 5);
      setQuiz(questions);
      setUserAnswers(new Array(questions.length).fill(-1));
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (qIdx: number, oIdx: number) => {
    if (showResults) return;
    const newAnswers = [...userAnswers];
    newAnswers[qIdx] = oIdx;
    setUserAnswers(newAnswers);
  };

  const score = quiz ? userAnswers.filter((ans, idx) => ans === quiz[idx].correctAnswer).length : 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 animate-fadeIn pb-20">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
           <span className="bg-purple-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">Módulo Interativo</span>
        </div>
        <h1 className="text-5xl font-black text-gray-900 tracking-tighter">Gerador de Atividades 📝</h1>
        <p className="text-xl text-gray-500 font-medium">Crie sequências didáticas interativas de verificação em instantes.</p>
      </header>

      <section className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 space-y-2 w-full">
           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assunto da Atividade</label>
           <input 
             type="text" 
             value={topic}
             onChange={(e) => setTopic(e.target.value)}
             placeholder="Ex: Frações, Independência do Brasil, Cadeia Alimentar..."
             className="w-full p-5 rounded-2xl border-2 border-gray-50 bg-gray-50 focus:border-purple-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
           />
        </div>
        <div className="space-y-2 w-full md:w-56">
           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nível de Dificuldade</label>
           <select 
             value={grade}
             onChange={(e) => setGrade(e.target.value)}
             className="w-full p-5 rounded-2xl border-2 border-gray-50 bg-gray-50 focus:border-purple-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
           >
             {Array.from({length: 9}, (_, i) => `${i+1}º Ano`).map(g => (
               <option key={g} value={g}>{g}</option>
             ))}
           </select>
        </div>
        <button 
          onClick={handleCreate}
          disabled={loading}
          className={`px-12 py-5 rounded-2xl font-black text-white text-xs uppercase tracking-[0.3em] transition-all whitespace-nowrap shadow-2xl active:scale-95 ${
            loading ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-100'
          }`}
        >
          {loading ? <i className="fa-solid fa-spinner animate-spin mr-3"></i> : <i className="fa-solid fa-plus mr-3"></i>}
          {loading ? 'GERANDO...' : 'CRIAR QUIZ'}
        </button>
      </section>

      {quiz && (
        <div className="space-y-10">
          <div className="flex items-center justify-between border-b pb-4">
             <h2 className="text-2xl font-black text-gray-900 tracking-tight">Questões Geradas ({quiz.length})</h2>
             {showResults && (
                <span className="bg-indigo-600 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest">
                  Seu Score: {score} / {quiz.length}
                </span>
             )}
          </div>
          <div className="space-y-8">
            {quiz.map((q, qIdx) => (
              <div key={qIdx} className="bg-white p-10 rounded-[2.5rem] shadow-lg border border-gray-100 animate-slideUp relative overflow-hidden" style={{ animationDelay: `${qIdx * 0.1}s` }}>
                <div className="absolute top-0 left-0 w-2 h-full bg-purple-100"></div>
                <div className="flex items-start gap-4 mb-8">
                   <span className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-lg">{qIdx + 1}</span>
                   <p className="text-2xl font-black text-gray-900 tracking-tight leading-tight">{q.question}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {q.options.map((opt, oIdx) => {
                    const isSelected = userAnswers[qIdx] === oIdx;
                    const isCorrect = q.correctAnswer === oIdx;
                    let btnClass = "p-6 rounded-[1.5rem] border-2 text-left transition-all font-bold text-base flex items-center gap-4 ";
                    
                    if (showResults) {
                      if (isCorrect) btnClass += "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-emerald-50 ";
                      else if (isSelected && !isCorrect) btnClass += "bg-rose-50 border-rose-500 text-rose-700 shadow-rose-50 ";
                      else btnClass += "bg-gray-50 border-gray-100 text-gray-300 opacity-60 ";
                    } else {
                      if (isSelected) btnClass += "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xl shadow-indigo-100 scale-[1.02] ";
                      else btnClass += "bg-white border-gray-100 hover:border-indigo-200 text-gray-600 hover:bg-gray-50 ";
                    }

                    return (
                      <button 
                        key={oIdx}
                        onClick={() => handleSelectOption(qIdx, oIdx)}
                        className={btnClass}
                      >
                        <span className={`inline-block w-8 h-8 rounded-lg border-2 border-current text-center text-xs leading-7 font-black shrink-0 transition-colors ${isSelected ? 'bg-current text-white border-transparent' : 'bg-transparent text-gray-200 group-hover:text-indigo-600'}`}>
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

          <div className="flex justify-center pt-8">
            {!showResults ? (
              <button 
                onClick={() => setShowResults(true)}
                disabled={userAnswers.includes(-1)}
                className={`px-16 py-6 rounded-[2rem] font-black text-white text-lg uppercase tracking-[0.4em] transition-all shadow-[0_25px_50px_rgba(5,150,105,0.3)] active:scale-95 ${
                  userAnswers.includes(-1) ? 'bg-gray-300 cursor-not-allowed grayscale' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                FINALIZAR ATIVIDADE
              </button>
            ) : (
              <div className="bg-gray-950 p-12 rounded-[3.5rem] shadow-2xl text-center space-y-6 animate-scaleUp w-full max-w-md border border-white/10">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em]">Desempenho da Atividade</p>
                <div className="text-8xl font-black text-white tracking-tighter">
                  {score}<span className="text-white/20">/</span>{quiz.length}
                </div>
                <p className="text-white/60 font-bold text-lg uppercase tracking-widest px-4">
                  {score === quiz.length ? "EXCELÊNCIA! DOMÍNIO TOTAL 🎉" : "BOM TRABALHO! CONTINUE EVOLUINDO 🚀"}
                </p>
                <button 
                  onClick={handleCreate}
                  className="w-full bg-white text-gray-900 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-xl"
                >
                  REINICIAR GERADOR
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizMaker;
