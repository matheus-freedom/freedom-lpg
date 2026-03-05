import React, { useState, useRef } from 'react';
import { User } from '../types';
// AQUI MUDOU: Importamos o Firebase ao invés do storageService
import { auth, db } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface LoginProps {
  onLogin?: (user: User) => void; // Deixei opcional pois o App.tsx gerencia o estado agora, mas mantive para compatibilidade
}

const Login: React.FC<LoginProps> = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // 1. Login Admin Especial (Mestre) - Mantive sua lógica
    if (email === 'admin' && password === 'f1') {
      // O admin a gente não autentica no Firebase, simulamos direto
      // Nota: Como mudamos o App.tsx para ouvir o Firebase, o ideal seria criar um user admin no firebase.
      // Mas para manter seu atalho funcionando, vamos tentar logar normal abaixo.
      alert("Para acessar como Admin neste novo sistema, crie uma conta ou use as credenciais do Firebase.");
      setLoading(false);
      return;
    }

    try {
      // 2. Login Professor via Firebase
      await signInWithEmailAndPassword(auth, email, password);
      // Não precisamos chamar onLogin, o App.tsx vai perceber a mudança automaticamente!
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential') alert("E-mail ou senha incorretos.");
      else alert("Erro ao entrar: " + error.message);
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.startsWith('@')) {
      alert("O nome de usuário deve começar com @ (ex: @teacherfred)");
      return;
    }

    setLoading(true);

    try {
      // 1. Cria o usuário na Autenticação do Firebase (Email/Senha)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Atualiza o perfil básico (Nome)
      await updateProfile(user, {
        displayName: fullName
      });

      // 3. Salva os dados extras (Idade, Sexo, Foto, Username) no Banco de Dados (Firestore)
      // Criamos um documento na coleção 'users' com o mesmo ID do login
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        name: fullName,
        email: email,
        username: username.toLowerCase(),
        age: parseInt(age),
        gender: gender,
        photo: photo || null, // Firebase aceita string base64, embora não seja o ideal para apps gigantes, para o seu funciona bem!
        role: 'teacher',
        createdAt: new Date().toISOString()
      });

      // Sucesso! O App.tsx vai redirecionar sozinho.
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') alert("Este e-mail já está em uso.");
      else if (error.code === 'auth/weak-password') alert("A senha deve ter pelo menos 6 caracteres.");
      else alert("Erro ao criar conta: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-freedom-orange/10 rounded-full blur-[120px] animate-pulse"></div>
      
      <div className="max-w-md w-full z-10">
        <div className="text-center mb-10 space-y-2">
          <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(247,147,30,0.3)]">
            FREEDOM<span className="text-freedom-orange">LPG</span>
          </h1>
          <p className="text-freedom-orange font-bold text-[11px] uppercase tracking-[0.4em] mt-4">
            The future of lesson generation
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl p-8 lg:p-10 rounded-[3rem] border border-white/10 shadow-2xl">
          <form onSubmit={isRegistering ? handleRegisterSubmit : handleLoginSubmit} className="space-y-5">
            
            {isRegistering && (
              <div className="flex flex-col items-center mb-6">
                <div 
                  onClick={() => photoInputRef.current?.click()}
                  className="w-24 h-24 rounded-3xl bg-white/10 border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-freedom-orange transition-all"
                >
                  {photo ? (
                    <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-white/40 flex flex-col items-center">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      <span className="text-[8px] font-black uppercase mt-1">Add Photo</span>
                    </div>
                  )}
                </div>
                <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoSelect} />
              </div>
            )}

            {isRegistering && (
              <>
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white text-sm focus:border-freedom-orange transition-colors"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">@username</label>
                  <input
                    type="text"
                    required
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white text-sm focus:border-freedom-orange transition-colors"
                    placeholder="@teachername"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Idade</label>
                    <input
                      type="number"
                      required
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white text-sm focus:border-freedom-orange"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Sexo</label>
                    <select
                      required
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white text-sm focus:border-freedom-orange appearance-none"
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                    >
                      <option value="" className="bg-slate-900">Selecione</option>
                      <option value="Male" className="bg-slate-900">Masculino</option>
                      <option value="Female" className="bg-slate-900">Feminino</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">E-mail</label>
              <input
                type="text"
                required
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white text-sm focus:border-freedom-orange transition-colors"
                placeholder="teacher@freedom.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Senha</label>
              <input
                type="password"
                required
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white text-sm focus:border-freedom-orange transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-freedom-orange text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-freedom-orange/20 mt-4"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : (isRegistering ? "Criar Minha Conta" : "Acessar Plataforma")}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)} 
              className="text-[10px] text-gray-400 font-bold uppercase hover:text-freedom-orange transition-colors tracking-widest"
            >
              {isRegistering ? "Já tenho uma conta? Entrar" : "Ainda não tem conta? Cadastrar-se"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;