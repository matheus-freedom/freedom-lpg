import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import Home from './views/Home';
import LessonGenerator from './views/LessonGenerator';
import QuickLessonGenerator from './views/QuickLessonGenerator';
import LessonDetail from './views/LessonDetail';
import StudentWorksheet from './views/StudentWorksheet';
import ClassroomView from './views/ClassroomView';
import History from './views/History';
import Login from './views/Login';
import AdminDashboard from './views/AdminDashboard';
import Profile from './views/Profile';
import Inspirations from './views/Inspirations';
import { User } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let role: 'teacher' | 'admin' = 'teacher';
        
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            role = userData.role || 'teacher';
          }
        } catch (error) {
          console.error("Erro ao buscar perfil do usuário", error);
        }

        const appUser: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Teacher',
          username: firebaseUser.displayName || 'Teacher',
          email: firebaseUser.email || '',
          photo: firebaseUser.photoURL || undefined,
          role: role,
          preferences: {}
        };
        setUser(appUser);
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Carregando FreedomLPG...</div>;

  return (
    <Router>
      {!user ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <nav className="bg-freedom-gray text-white py-4 px-6 shadow-md print:hidden z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <Link to="/" className="flex items-center space-x-2 group">
                <span className="text-freedom-orange font-title text-2xl group-hover:scale-105 transition-transform">FREEDOM</span>
                <span className="text-white font-title text-2xl tracking-tighter">LPG</span>
              </Link>
              
              <div className="flex items-center space-x-6 text-xs font-bold uppercase tracking-widest">
                <div className="flex items-center space-x-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-gray-400 font-black leading-none uppercase">{user.role}</p>
                    <p className="text-xs text-white font-bold">{user.username || user.name.split(' ')[0]}</p>
                  </div>
                  <Link to="/profile" className="w-10 h-10 rounded-xl bg-freedom-orange p-0.5 shadow-lg hover:scale-110 transition-all border border-white/10 overflow-hidden">
                    {user.photo ? (
                      <img src={user.photo} alt="Profile" className="w-full h-full object-cover rounded-[10px]" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-black text-lg italic">
                        {user.name.charAt(0)}
                      </div>
                    )}
                  </Link>
                </div>

                <div className="h-6 w-[1px] bg-white/10 mx-2"></div>

                <div className="hidden lg:flex items-center space-x-6">
                  {user.role === 'admin' && (
                    <Link to="/admin" className="text-green-400 hover:text-white transition-colors border-b border-green-400/30">Admin Panel</Link>
                  )}
                  <Link to="/history" className="hover:text-freedom-orange transition-colors">Freedom Library</Link>
                  <Link to="/inspirations" className="hover:text-freedom-orange transition-colors">Inspirações</Link>
                  <Link to="/quick-generate" className="hover:text-freedom-orange transition-colors">Quick Lesson</Link>
                </div>
                <button onClick={handleLogout} className="text-red-400 hover:text-red-500 transition-colors">Logout</button>
              </div>
            </div>
          </nav>

          <main className="flex-1">
            <Routes>
              {/* MUDANÇA AQUI: Passamos o usuário para a Home */}
              <Route path="/" element={<Home user={user} />} />
              <Route path="/generate" element={<LessonGenerator />} />
              <Route path="/quick-generate" element={<QuickLessonGenerator />} />
              <Route path="/lesson/:id" element={<LessonDetail />} />
              <Route path="/worksheet/:id" element={<StudentWorksheet />} />
              <Route path="/classroom/:id" element={<ClassroomView />} />
              <Route path="/history" element={<History />} />
              <Route path="/inspirations" element={<Inspirations user={user} />} />
              <Route path="/inspirations/:view" element={<Inspirations user={user} />} />
              <Route path="/inspirations/:view/:weekId" element={<Inspirations user={user} />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" replace />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="bg-white py-8 border-t border-gray-200 mt-12 print:hidden">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center opacity-50">
              <p className="text-sm font-bold">© {new Date().getFullYear()} Freedom Language Center</p>
              <div className="flex space-x-4 mt-4 md:mt-0 text-[10px] font-bold uppercase tracking-widest">
                <span>Teacher Empowerment</span>
                <span className="text-freedom-orange">Conversation First</span>
                <span>AI Driven Learning</span>
              </div>
            </div>
          </footer>
        </div>
      )}
    </Router>
  );
};

export default App;
