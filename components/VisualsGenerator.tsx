
import React, { useState } from 'react';
import { generateVisualAid } from '../services/geminiService';

const VisualsGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
      const url = await generateVisualAid(prompt);
      if (url) setImageUrl(url);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar imagem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12 animate-fadeIn pb-12">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
           <span className="bg-indigo-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">Módulo Visual</span>
        </div>
        <h1 className="text-5xl font-black text-gray-900 tracking-tighter">Estúdio de Ilustrações ✨</h1>
        <p className="text-xl text-gray-500 font-medium">Transforme conceitos abstratos em recursos didáticos de alta definição.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Painel de Controle */}
        <div className="lg:col-span-5 space-y-8">
            <section className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 shadow-inner space-y-8">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">O que você deseja ilustrar?</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex: Uma representação colorida e didática do ciclo da água com setas explicativas em estilo infográfico."
                  className="w-full h-48 p-6 rounded-[2rem] border-2 border-gray-100 focus:border-indigo-500 focus:bg-white transition-all outline-none font-medium text-gray-700 text-lg shadow-sm"
                />
              </div>
              
              <button 
                onClick={handleGenerate}
                disabled={loading}
                className={`w-full py-8 rounded-[2rem] font-black text-white text-sm uppercase tracking-[0.4em] transition-all shadow-2xl flex items-center justify-center gap-4 ${
                  loading ? 'bg-gray-400 scale-[0.98]' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 shadow-indigo-100'
                }`}
              >
                {loading ? <i className="fa-solid fa-spinner animate-spin text-xl"></i> : <i className="fa-solid fa-wand-sparkles text-xl"></i>}
                {loading ? 'GERANDO IMAGEM...' : 'CRIAR ILUSTRAÇÃO'}
              </button>

              <div className="grid grid-cols-1 gap-4 pt-4">
                <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500"><i className="fa-solid fa-highlighter"></i></div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase leading-tight">DICA: Use palavras como "esquemático" ou "infográfico" para resultados mais didáticos.</p>
                </div>
              </div>
            </section>
        </div>

        {/* Visualização da Imagem */}
        <div className="lg:col-span-7">
          {imageUrl ? (
            <div className="bg-white p-6 rounded-[3.5rem] shadow-2xl border border-gray-100 animate-scaleUp text-center group">
              <div className="relative overflow-hidden rounded-[2.5rem] bg-gray-50 border border-gray-100">
                <img src={imageUrl} alt="Generated aid" className="w-full h-auto object-contain transition-transform duration-700 group-hover:scale-[1.02]" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none"></div>
              </div>
              
              <div className="flex justify-center gap-4 mt-8">
                 <a 
                   href={imageUrl} 
                   download="ensinoverso-recurso.png"
                   className="flex-1 bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl"
                 >
                   <i className="fa-solid fa-download"></i> Baixar Alta Resolução
                 </a>
                 <button 
                   onClick={() => setImageUrl(null)}
                   className="px-10 py-5 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-50 hover:text-red-500 transition-all border border-gray-200"
                 >
                   Limpar
                 </button>
              </div>
            </div>
          ) : (
            <div className="w-full h-[600px] bg-gray-50 border-4 border-dashed border-gray-100 rounded-[3.5rem] flex flex-col items-center justify-center text-center p-12 space-y-6">
               <div className="w-24 h-24 rounded-[2rem] bg-white shadow-sm flex items-center justify-center text-gray-200">
                  <i className="fa-solid fa-image text-5xl"></i>
               </div>
               <div className="space-y-2">
                 <p className="text-xl font-black text-gray-300 uppercase tracking-widest leading-none">Aguardando seu Comando</p>
                 <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">O resultado visual aparecerá neste painel</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualsGenerator;
