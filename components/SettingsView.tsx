
import React, { useState, useMemo, useRef } from 'react';
import { AppUser, BNCCSkill, ClassRoom, UserRole } from '../types';
import { dbService } from '../services/firebase';

interface SettingsViewProps {
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  bnccSkills: BNCCSkill[];
  setBnccSkills: React.Dispatch<React.SetStateAction<BNCCSkill[]>>;
  classes: ClassRoom[];
}

const SettingsView: React.FC<SettingsViewProps> = ({ users, setUsers, bnccSkills, setBnccSkills, classes }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'bncc'>('users');
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  const [bnccSearch, setBnccSearch] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const confirmDeleteUser = async () => {
    if (userToDelete) {
      try {
        await dbService.delete('users', userToDelete);
        setUserToDelete(null);
      } catch (err) { console.error(err); }
    }
  };

  const updateUser = async (updated: AppUser) => {
    try {
      await dbService.save('users', updated.id, updated);
      setEditingUser(null);
    } catch (err) { console.error(err); }
  };

  const toggleClassForUser = (classId: string) => {
    if (!editingUser) return;
    const currentLinks = editingUser.linkedClassIds || [];
    const newLinks = currentLinks.includes(classId)
      ? currentLinks.filter(id => id !== classId)
      : [...currentLinks, classId];
    setEditingUser({ ...editingUser, linkedClassIds: newLinks });
  };

  const filteredBncc = useMemo(() => {
    return bnccSkills.filter(skill => 
      skill.code.toLowerCase().includes(bnccSearch.toLowerCase()) ||
      skill.description.toLowerCase().includes(bnccSearch.toLowerCase())
    );
  }, [bnccSkills, bnccSearch]);

  const handleDeleteSkill = async (id: string) => {
    if (confirm('Deseja excluir esta habilidade da base de dados?')) {
      try {
        await dbService.delete('bncc', id);
      } catch (err) { console.error(err); }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setImportCsv(text);
      };
      reader.readAsText(file);
    }
  };

  const handleImportBNCC = async () => {
    if (!importCsv.trim()) return;
    setImportLoading(true);
    
    try {
      const lines = importCsv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes('código') || firstLine.includes('codigo') || firstLine.includes('descrição');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const skillsToSave: BNCCSkill[] = dataLines.map(line => {
        let separator = ',';
        if (line.includes(';')) separator = ';';
        else if (line.includes('\t')) separator = '\t';
        
        const parts = line.split(separator).map(p => p.trim());
        const [code, description, subject, grade] = parts;
        const id = bnccSkills.find(s => s.code === code)?.id || Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        return {
          id,
          code: code || 'S/C',
          description: description || 'Sem descrição',
          grade: grade || 'Geral',
          subject: subject || 'Geral'
        };
      });

      const promises = skillsToSave.map(skill => 
        dbService.save('bncc', skill.id, skill)
      );

      await Promise.all(promises);
      setImportCsv('');
      setShowImportModal(false);
      alert(`${promises.length} habilidades processadas!`);
    } catch (err) {
      alert("Erro no processamento.");
      console.error(err);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[95%] lg:max-w-7xl flex flex-col gap-12 animate-desktop-in pb-40 text-white">
      {userToDelete && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
          <div className="w-full max-w-md bg-white text-gray-900 rounded-[3.5rem] p-12 text-center space-y-8 shadow-2xl">
             <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner"><i className="fa-solid fa-user-xmark"></i></div>
             <h3 className="text-3xl font-black tracking-tighter">Remover Perfil?</h3>
             <div className="flex flex-col gap-3">
               <button onClick={confirmDeleteUser} className="w-full py-6 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl">REMOVER PERMANENTEMENTE</button>
               <button onClick={() => setUserToDelete(null)} className="w-full py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">CANCELAR</button>
             </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
          <div className="w-full max-w-4xl bg-white text-gray-900 rounded-[4rem] p-16 space-y-10 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 -mr-32 -mt-32 rounded-full"></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-1">
                <h3 className="text-4xl font-black tracking-tighter">Importação em Lote</h3>
                <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Alimentação da Base Curricular BNCC</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="w-14 h-14 rounded-full bg-gray-50 text-gray-400 hover:text-red-500 transition-all border border-gray-100"><i className="fa-solid fa-xmark text-2xl"></i></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="group flex items-center gap-6 p-10 bg-indigo-50 border-4 border-indigo-100 border-dashed rounded-[3rem] hover:bg-indigo-600 hover:border-indigo-600 transition-all text-left"
              >
                <div className="w-16 h-16 rounded-[1.5rem] bg-white flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform shadow-lg">
                  <i className="fa-solid fa-cloud-arrow-up text-3xl"></i>
                </div>
                <div>
                  <p className="font-black text-indigo-900 group-hover:text-white text-xs uppercase tracking-widest">Arquivo CSV</p>
                  <p className="text-[10px] text-indigo-400 group-hover:text-indigo-200 font-bold uppercase mt-1">Sincronizar dados físicos</p>
                </div>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.txt" className="hidden" />

              <div className="bg-amber-50 p-10 rounded-[3rem] border border-amber-100 flex gap-6 items-center">
                <i className="fa-solid fa-circle-question text-amber-500 text-4xl opacity-40"></i>
                <div>
                  <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-2">Estrutura Sugerida</p>
                  <p className="text-[10px] text-amber-700/70 font-bold uppercase leading-relaxed tracking-wider">
                    Colunas: Código, Descrição, Disciplina, Série. 
                  </p>
                </div>
              </div>
            </div>

            <textarea 
              value={importCsv}
              onChange={e => setImportCsv(e.target.value)}
              placeholder="Cole os dados aqui diretamente do seu arquivo original..."
              className="w-full h-80 p-8 bg-gray-50 border-2 border-gray-100 rounded-[2.5rem] font-mono text-xs outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:text-gray-300 custom-scrollbar shadow-inner relative z-10"
            />

            <div className="flex gap-4 pt-4 relative z-10">
              <button 
                onClick={handleImportBNCC}
                disabled={importLoading || !importCsv.trim()}
                className="flex-[2] py-8 bg-indigo-600 text-white font-black rounded-[2rem] uppercase text-[11px] tracking-[0.4em] shadow-2xl shadow-indigo-200 disabled:bg-gray-300 transition-all active:scale-[0.98]"
              >
                {importLoading ? <i className="fa-solid fa-spinner animate-spin mr-3"></i> : <i className="fa-solid fa-database mr-3"></i>}
                {importLoading ? 'PROCESSANDO...' : 'ALIMENTAR BANCO DE DADOS'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-white/20 pb-12 space-y-4">
        <div className="flex items-center gap-3">
           <span className="bg-indigo-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">Console Admin</span>
        </div>
        <h1 className="text-7xl font-black tracking-tighter drop-shadow-strong">Configurações</h1>
        <p className="text-2xl text-white/50 font-medium">Gestão sistêmica de usuários, fluxos e currículos BNCC.</p>
      </header>

      <div className="flex gap-4 p-2 bg-white/10 backdrop-blur-md rounded-[2rem] w-fit shadow-2xl">
        <button 
          onClick={() => setActiveTab('users')} 
          className={`px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-gray-900 shadow-xl scale-105' : 'text-white/40 hover:text-white'}`}
        >
          Usuários e Papéis
        </button>
        <button 
          onClick={() => setActiveTab('bncc')} 
          className={`px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'bncc' ? 'bg-white text-gray-900 shadow-xl scale-105' : 'text-white/40 hover:text-white'}`}
        >
          Repositório BNCC
        </button>
      </div>

      {activeTab === 'users' && (
        <section className="bg-white/5 backdrop-blur-3xl rounded-[4rem] border border-white/10 p-12 shadow-2xl animate-desktop-in overflow-hidden relative">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-8 text-[11px] font-black uppercase tracking-[0.4em] text-white/30">Identidade Digital</th>
                  <th className="pb-8 text-[11px] font-black uppercase tracking-[0.4em] text-white/30 text-right">Controles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-white/5 transition-all group">
                    <td className="py-8">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center font-black text-xl shadow-2xl text-white group-hover:scale-110 transition-transform">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-2xl tracking-tight text-white group-hover:text-indigo-300 transition-colors">{user.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-white/30 text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg">{user.role}</span>
                            <span className="text-white/20 text-[10px] font-black truncate max-w-xs">{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-8 text-right">
                      <button onClick={() => setEditingUser(user)} className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-indigo-600 transition-all mr-3 text-white/40 hover:text-white shadow-inner group/btn" title="Ajustes">
                        <i className="fa-solid fa-user-gear text-lg"></i>
                      </button>
                      <button onClick={() => setUserToDelete(user.id)} className="w-14 h-14 rounded-2xl bg-rose-500/10 hover:bg-rose-600 transition-all text-rose-400 hover:text-white shadow-inner group/btn" title="Remover">
                        <i className="fa-solid fa-user-minus text-lg"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'bncc' && (
        <section className="space-y-10 animate-desktop-in">
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
            <div className="relative w-full md:w-[500px]">
              <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-white/20"></i>
              <input 
                value={bnccSearch}
                onChange={e => setBnccSearch(e.target.value)}
                placeholder="Localizar habilidade por código ou palavra-chave..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 py-5 text-white font-black outline-none focus:bg-white/10 transition-all text-sm placeholder:text-white/20"
              />
            </div>
            <button 
              onClick={() => setShowImportModal(true)}
              className="w-full md:w-fit px-12 py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.3em] shadow-2xl shadow-emerald-500/10 transition-all flex items-center gap-4"
            >
              <i className="fa-solid fa-database text-lg"></i>
              ALIMENTAR REPOSITÓRIO
            </button>
          </div>

          <div className="bg-white/5 backdrop-blur-2xl rounded-[4rem] border border-white/10 p-12 shadow-2xl overflow-hidden relative">
            <div className="max-h-[65vh] overflow-y-auto pr-6 custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[#050505]/95 backdrop-blur-md z-10">
                  <tr className="border-b border-white/10">
                    <th className="pb-8 text-[11px] font-black uppercase tracking-[0.4em] text-white/30">Código/Habilidade</th>
                    <th className="pb-8 text-[11px] font-black uppercase tracking-[0.4em] text-white/30 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredBncc.length > 0 ? filteredBncc.map(skill => (
                    <tr key={skill.id} className="hover:bg-white/5 transition-all group">
                      <td className="py-8 align-top">
                        <div className="flex gap-8 items-start">
                           <span className="bg-indigo-600/20 text-indigo-300 px-5 py-2 rounded-xl font-black text-xs border border-indigo-500/30 whitespace-nowrap shadow-sm group-hover:scale-110 transition-transform">
                             {skill.code}
                           </span>
                           <div className="space-y-3">
                              <p className="text-lg font-bold leading-relaxed text-white/70 group-hover:text-white transition-colors tracking-tight">{skill.description}</p>
                              <div className="flex gap-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/20 bg-white/5 px-3 py-1 rounded-lg border border-white/5">{skill.grade}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/20 bg-white/5 px-3 py-1 rounded-lg border border-white/5">{skill.subject}</span>
                              </div>
                           </div>
                        </div>
                      </td>
                      <td className="py-8 text-right align-top">
                        <button 
                          onClick={() => handleDeleteSkill(skill.id)}
                          className="w-14 h-14 rounded-2xl bg-rose-500/10 hover:bg-rose-600 transition-all text-rose-400 hover:text-white shadow-inner"
                        >
                          <i className="fa-solid fa-trash-can text-lg"></i>
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={2} className="py-32 text-center text-white/10 font-black uppercase tracking-[0.5em] text-xs">
                        Base de dados em branco. Realize a importação.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="w-full max-w-2xl bg-white text-gray-900 rounded-[4rem] p-16 space-y-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 -mr-32 -mt-32 rounded-full"></div>
            <div className="space-y-2 relative z-10">
              <h3 className="text-4xl font-black tracking-tighter">Modificar Acesso</h3>
              <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Ajuste de perfil e papéis operacionais</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-5 bg-gray-50 border-2 border-gray-50 rounded-2xl font-black text-gray-700 focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-inner" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Papel Administrativo</label>
                <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="w-full p-5 bg-gray-50 border-2 border-gray-50 rounded-2xl font-black text-gray-700 focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-inner">
                  <option value="administrador">Administrador</option>
                  <option value="professor">Professor</option>
                  <option value="estudante">Estudante</option>
                </select>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Matricula / Turmas</label>
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Vinculação Multi-Turma</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-3 custom-scrollbar">
                {classes.length > 0 ? classes.map(cls => (
                  <button 
                    key={cls.id} 
                    onClick={() => toggleClassForUser(cls.id)} 
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group/btn ${editingUser.linkedClassIds?.includes(cls.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-200'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${editingUser.linkedClassIds?.includes(cls.id) ? 'bg-white/20' : 'bg-gray-50 group-hover/btn:bg-indigo-50'}`}>
                      <i className={`fa-solid ${cls.icon}`}></i>
                    </div>
                    <span className="font-black text-xs uppercase tracking-tight">{cls.name}</span>
                  </button>
                )) : (
                  <p className="text-center py-10 text-gray-300 font-bold uppercase text-[9px] border-2 border-dashed rounded-3xl">Base de turmas vazia</p>
                )}
              </div>
            </div>

            <div className="pt-6 space-y-4 relative z-10">
              <button onClick={() => updateUser(editingUser)} className="w-full py-8 bg-indigo-600 text-white font-black rounded-[2rem] uppercase text-[11px] tracking-[0.4em] shadow-2xl shadow-indigo-200 hover:scale-[1.02] transition-all active:scale-95">CONFIRMAR ALTERAÇÕES</button>
              <button onClick={() => setEditingUser(null)} className="w-full py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">VOLTAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
