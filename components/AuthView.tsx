
import React, { useState } from 'react';
import { authService, dbService } from '../services/firebase';
import { UserRole, AppUser } from '../types';

interface AuthViewProps {
  onAuthSuccess: (user: AppUser) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Fluxo de Login
        const userCredential = await authService.signIn(email, password);
        const userData = await dbService.getById<AppUser>('users', userCredential.user.uid);
        if (userData) {
          onAuthSuccess(userData);
        } else {
          setError("Perfil não encontrado. Entre em contato com o suporte.");
        }
      } else {
        // Fluxo de Cadastro
        // 1. Criar a credencial no Firebase Auth
        const userCredential = await authService.signUp(email, password);
        
        // 2. Verificar se este é o primeiro usuário do sistema
        // Se a coleção estiver vazia (ou der erro de permissão por estar vazia), tratamos como o primeiro.
        const existingUsers = await dbService.getCollection<AppUser>('users');
        const isFirstUser = !existingUsers || existingUsers.length === 0;
        
        const role: UserRole = isFirstUser ? 'administrador' : 'professor';

        const newUser: AppUser = {
          id: userCredential.user.uid,
          name,
          email,
          role,
          approved: true, // Todos começam aprovados para facilitar o teste
          linkedClassIds: []
        };

        // 3. Salvar os metadados do usuário no Firestore
        await dbService.save('users', newUser.id, newUser);
        onAuthSuccess(newUser);
      }
    } catch (err: any) {
      console.error("Erro na autenticação:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Credenciais inválidas. Verifique seu e-mail e senha.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está em uso por outro usuário.");
      } else if (err.code === 'auth/weak-password') {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setError("Ocorreu um erro inesperado. Tente novamente mais tarde.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-desktop-in">
      <div className="bg-white/10 backdrop-blur-2xl rounded-[3rem] p-10 border border-white/20 shadow-2xl space-y-8">
        <header className="text-center space-y-2">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-white text-3xl mx-auto shadow-xl mb-6">
            <i className={`fa-solid ${isLogin ? 'fa-fingerprint' : 'fa-user-plus'}`}></i>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
            {isLogin ? 'Bem-vindo' : 'Criar Conta'}
          </h1>
          <p className="text-white/40 font-bold text-[10px] uppercase tracking-[0.3em]">
            {isLogin ? 'Acesse sua conta Ensinoverso' : 'O primeiro usuário será Administrador'}
          </p>
        </header>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-2xl text-red-200 text-xs font-bold text-center animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">Nome Completo</label>
              <input 
                required 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-white/20"
                placeholder="Ex: Prof. Eduardo Silva"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">E-mail Profissional</label>
            <input 
              required 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-white/20"
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">Senha Segura</label>
            <input 
              required 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-white/20"
              placeholder="••••••••"
            />
          </div>

          <button 
            disabled={loading}
            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl uppercase text-[11px] tracking-[0.4em] transition-all shadow-xl active:scale-95 disabled:bg-gray-700 disabled:cursor-not-allowed mt-4 group"
          >
            {loading ? (
              <i className="fa-solid fa-spinner animate-spin"></i>
            ) : (
              <span className="flex items-center justify-center gap-3">
                {isLogin ? 'ENTRAR NO SISTEMA' : 'CRIAR MINHA CONTA'}
                <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
              </span>
            )}
          </button>
        </form>

        <footer className="text-center pt-4 border-t border-white/10">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
            className="text-white/60 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all"
          >
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já possui conta? Faça Login'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AuthView;
