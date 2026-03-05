import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import FredGuide from '../components/FredGuide';
import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<User>>({});
  
  // Estados para troca de senha
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showPassForm, setShowPassForm] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Busca os dados reais do Firebase ao carregar a tela
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setUser(userData);
            setFormData(userData);
          }
        } catch (error) {
          console.error("Erro ao buscar perfil:", error);
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Mantemos em Base64 para exibir na hora, mas o ideal no futuro é subir pro Storage
        setFormData({ ...formData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user || !auth.currentUser) return;
    
    try {
      // Atualiza no Banco de Dados (Firestore)
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: formData.name,
        age: formData.age,
        gender: formData.gender,
        bio: formData.bio || '',
        photo: formData.photo || user.photo
      });

      setUser({ ...user, ...formData } as User);
      setIsEditing(false);
      alert("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      alert("Erro ao salvar alterações.");
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      alert("A nova senha e a confirmação não conferem!");
      return;
    }
    if (passwordData.new.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    
    setPassLoading(true);
    const currentUser = auth.currentUser;

    if (currentUser && currentUser.email) {
      try {
        // O Firebase exige re-autenticação antes de trocar senha (segurança)
        const credential = EmailAuthProvider.credential(currentUser.email, passwordData.current);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Se a senha atual estiver certa, atualiza para a nova
        await updatePassword(currentUser, passwordData.new);
        
        alert("Senha alterada com sucesso!");
        setShowPassForm(false);
        setPasswordData({ current: '', new: '', confirm: '' });
      } catch (error: any) {
        console.error("Erro ao mudar senha:", error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
          alert("A senha atual está incorreta.");
        } else {
          alert("Erro ao mudar senha. Tente sair e entrar novamente.");
        }
      }
    }
    setPassLoading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-10 h-10 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <div className="p-10 text-center text-gray-500">Perfil não encontrado. Tente fazer login novamente.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <FredGuide message="Seu perfil é sua identidade na Freedom! Mantenha seus dados atualizados para que todos saibam quem é o teacher por trás dessas aulas incríveis." />

      <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-gray-100">
        <div className="h-32 bg-freedom-orange relative">
          <div className="absolute -bottom-16 left-10">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[2.5rem] bg-white p-1.5 shadow-2xl overflow-hidden border-4 border-white">
                {formData.photo ? (
                  <img src={formData.photo} alt="Profile" className="w-full h-full object-cover rounded-[2rem]" />
                ) : (
                  <div className="w-full h-full bg-freedom-gray text-white flex items-center justify-center text-4xl font-black rounded-[2rem]">
                    {user.name.charAt(0)}
                  </div>
                )}
              </div>
              {isEditing && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 rounded-[2rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>
        </div>

        <div className="pt-20 px-10 pb-10">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h1 className="text-3xl font-black text-freedom-gray tracking-tighter uppercase">{user.name}</h1>
              <p className="text-freedom-orange font-bold text-xs uppercase tracking-widest">{user.role} Freedom Academy</p>
            </div>
            <button 
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className={`px-8 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isEditing ? 'bg-green-600 text-white' : 'bg-freedom-gray text-white hover:bg-black'}`}
            >
              {isEditing ? 'Salvar Alterações' : 'Editar Perfil'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                <input 
                  disabled={!isEditing}
                  type="text" 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-freedom-orange font-bold text-sm disabled:opacity-60"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">E-mail</label>
                <input 
                  disabled={true}
                  type="email" 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-sm opacity-60"
                  value={formData.email || ''}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Idade</label>
                  <input 
                    disabled={!isEditing}
                    type="number" 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-freedom-orange font-bold text-sm"
                    value={formData.age || ''}
                    onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Sexo</label>
                  <select 
                    disabled={!isEditing}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-freedom-orange font-bold text-sm"
                    value={formData.gender || ''}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Prefiro não dizer</option>
                    <option value="Male">Masculino</option>
                    <option value="Female">Feminino</option>
                    <option value="Other">Outro</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Biografia Acadêmica</label>
                <textarea 
                  disabled={!isEditing}
                  placeholder="Conte um pouco sobre sua jornada como teacher..."
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-freedom-orange font-bold text-sm h-[132px] resize-none"
                  value={formData.bio || ''}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                />
              </div>

              {!showPassForm ? (
                <button 
                  onClick={() => setShowPassForm(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold text-xs uppercase hover:border-freedom-orange hover:text-freedom-orange transition-all"
                >
                  🔒 Alterar Senha de Acesso
                </button>
              ) : (
                <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 space-y-4 animate-fadeIn">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-black text-[10px] uppercase text-freedom-orange tracking-widest">Alterar Senha</h4>
                    <button onClick={() => setShowPassForm(false)} className="text-gray-400 hover:text-red-500">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                  <input 
                    type="password" 
                    placeholder="Senha Atual" 
                    className="w-full p-3 rounded-xl border border-orange-200 outline-none text-xs"
                    value={passwordData.current}
                    onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                  />
                  <input 
                    type="password" 
                    placeholder="Nova Senha" 
                    className="w-full p-3 rounded-xl border border-orange-200 outline-none text-xs"
                    value={passwordData.new}
                    onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                  />
                  <input 
                    type="password" 
                    placeholder="Confirmar Nova Senha" 
                    className="w-full p-3 rounded-xl border border-orange-200 outline-none text-xs"
                    value={passwordData.confirm}
                    onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  />
                  <button 
                    onClick={handleChangePassword}
                    disabled={passLoading}
                    className="w-full bg-freedom-orange text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg disabled:opacity-50"
                  >
                    {passLoading ? 'Processando...' : 'Atualizar Senha'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;