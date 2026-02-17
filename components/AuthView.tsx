
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
        const userCredential = await authService.signIn(email, password);
        const userData = await dbService.getById<AppUser>('users', userCredential.user.uid);
        if (userData) {
          onAuthSuccess(userData);
        } else {
          setError("Perfil não encontrado no banco de dados.");
        }
      } else {
        const userCredential = await authService.signUp(email, password);
        const role: UserRole = 'professor'; // Cadastro padrão como professor

        const newUser: AppUser = {
          id: userCredential.user.uid,
          name,
          email,
          role,
          approved: false,
          linkedClassIds: []
        };

        await dbService.save('users', newUser.id, newUser);
        onAuthSuccess(newUser);
      }
    } catch (err: any) {
      console.error("Erro na autenticação:", err);
      if (err.code === 'auth/invalid-credential') {
        setError("Erro de credenciais. Verifique se o método Login por E-mail está ativo no Firebase Console ou se a senha está correta.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está em uso.");
      } else if (err.code === 'auth/weak-password') {
        setError("A senha é muito fraca.");
      } else {
        setError(`Erro: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-black">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-3xl rounded-[3rem] p-10 border border-white/10 shadow-2xl space-y-8 animate-desktop-in">
        <header className="text-center">
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">
            {isLogin ? 'Ensinoverso' : 'Cadastrar'}
          </h1>
          <p className="text-white/40 text-[10px] uppercase font-black tracking-widest">
            {isLogin ? 'Acesse o Sistema Operacional de Ensino' : 'Crie sua conta de docente'}
          </p>
        </header>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 p-4 rounded-2xl text-red-200 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nome Completo" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none" />
          )}
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none" />
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none" />

          <button disabled={loading} className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest transition-all">
            {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : isLogin ? 'ENTRAR' : 'CRIAR CONTA'}
          </button>
        </form>

        <footer className="text-center pt-4 border-t border-white/10">
          <button onClick={() => setIsLogin(!isLogin)} className="text-white/50 hover:text-indigo-400 font-black text-[10px] uppercase tracking-widest">
            {isLogin ? 'Criar uma nova conta' : 'Já possuo conta'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AuthView;
