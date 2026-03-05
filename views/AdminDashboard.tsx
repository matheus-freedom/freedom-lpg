
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell
} from 'recharts';
import { LessonPlan, CEFRLevel } from '../types';
import FredGuide from '../components/FredGuide';
import { getSavedPlans, deletePlanSafely, exportDatabase, getTeachers } from '../services/storageService';

const TeacherPerformanceModal: React.FC<{ 
  teacher: any, 
  plans: LessonPlan[], 
  onClose: () => void 
}> = ({ teacher, plans, onClose }) => {
  const teacherPlans = plans.filter(p => p.authorName === teacher.name || p.authorName === teacher.username);
  
  const levelData = (['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(level => ({
    name: level,
    value: teacherPlans.filter(p => p.level === level).length
  }));

  const COLORS = ['#f7931e', '#222222', '#6b7280', '#9ca3af', '#d1d5db'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
      <div className="absolute inset-0 bg-freedom-gray/90 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-5xl h-full max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-fadeIn">
        
        {/* Header Profissional */}
        <div className="bg-freedom-orange p-8 lg:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="w-32 h-32 rounded-[2.5rem] bg-white p-1.5 shadow-2xl overflow-hidden border-4 border-white/20">
              {teacher.photo ? (
                <img src={teacher.photo} alt={teacher.name} className="w-full h-full object-cover rounded-[2rem]" />
              ) : (
                <div className="w-full h-full bg-freedom-gray text-white flex items-center justify-center text-4xl font-black rounded-[2rem]">
                  {teacher.name?.charAt(0)}
                </div>
              )}
            </div>
            <div className="text-center md:text-left text-white">
              <h2 className="text-4xl font-black tracking-tighter uppercase leading-none mb-2">{teacher.name}</h2>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <span className="bg-white/20 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{teacher.username || '@teacher'}</span>
                <span className="bg-white/20 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{teacher.gender || 'N/A'} • {teacher.age || '??'} anos</span>
                <span className="bg-white/20 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Desde {new Date(teacher.joinedAt || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>
            <button onClick={onClose} className="md:ml-auto bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-white transition-all">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Dashboards */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar bg-gray-50/50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
             <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                <span className="text-freedom-orange text-5xl font-black mb-2">{teacherPlans.length}</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aulas Criadas</span>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                <span className="text-freedom-gray text-5xl font-black mb-2">{teacherPlans.filter(p => p.isQuickLesson).length}</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quick Lessons</span>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                <span className="text-freedom-orange text-5xl font-black mb-2">{Math.round(teacherPlans.length * 1.5)}h</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Potencial de Engajamento</span>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm h-[350px] flex flex-col">
              <h3 className="font-black text-sm uppercase tracking-widest text-freedom-gray mb-6 flex items-center">
                <span className="w-2 h-2 bg-freedom-orange rounded-full mr-2"></span> Distribuição CEFR
              </h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={levelData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {levelData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
               <h3 className="font-black text-sm uppercase tracking-widest text-freedom-gray mb-6 flex items-center">
                <span className="w-2 h-2 bg-freedom-gray rounded-full mr-2"></span> Recent Library Additions
              </h3>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {teacherPlans.slice(0, 10).map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-freedom-orange transition-all">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-freedom-orange border border-gray-200">{p.level}</span>
                      <span className="text-xs font-bold text-freedom-gray truncate max-w-[180px]">{p.title}</span>
                    </div>
                    <span className="text-[9px] font-black text-gray-400 uppercase">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
                {teacherPlans.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-sm">No content produced yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'teachers' | 'content'>('stats');

  useEffect(() => {
    refreshData();
  }, []);

  // Fixed refreshData to await async storage service calls.
  const refreshData = async () => {
    const savedPlans = await getSavedPlans();
    const teachersList = await getTeachers();
    setPlans(savedPlans);
    setTeachers(teachersList);
  };

  const handleDeleteP = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Excluir do banco global permanentemente?')) {
      deletePlanSafely(id);
      refreshData();
    }
  };

  const ranking = Object.entries(
    plans.reduce((acc, p) => {
      const name = p.authorName || 'Teacher';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, count]) => ({ 
    name, 
    count: count as number,
    profile: teachers.find(t => t.name === name || t.username === name)
  })).sort((a, b) => b.count - a.count);

  const levelData = (['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(level => ({
    name: level,
    value: plans.filter(p => p.level === level).length
  }));

  const COLORS = ['#f7931e', '#222222', '#6b7280', '#9ca3af', '#d1d5db'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 pb-20">
      <FredGuide message="Olá Admin! Clique no nome de qualquer teacher para abrir o relatório de performance individual e engajamento." />

      {selectedTeacher && (
        <TeacherPerformanceModal 
          teacher={selectedTeacher} 
          plans={plans} 
          onClose={() => setSelectedTeacher(null)} 
        />
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-freedom-gray tracking-tighter uppercase leading-none">Freedom <span className="text-freedom-orange">Management</span></h1>
          <div className="flex mt-6 space-x-2">
            {['stats', 'teachers', 'content'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)} 
                className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-freedom-orange text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <button onClick={exportDatabase} className="bg-freedom-gray text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-lg">Export Library Backup</button>
      </div>

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
           <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="font-black text-sm uppercase tracking-widest mb-6">Top Contributors</h3>
              <div className="space-y-3">
                {ranking.map((item, i) => (
                  <div 
                    key={i} 
                    onClick={() => item.profile && setSelectedTeacher(item.profile)}
                    className={`flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-transparent transition-all ${item.profile ? 'cursor-pointer hover:border-freedom-orange hover:bg-orange-50/50 shadow-sm' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-freedom-orange text-white flex items-center justify-center text-xs font-black italic">
                         {item.name?.charAt(0)}
                       </div>
                       <span className="font-bold text-sm text-freedom-gray">{item.name}</span>
                    </div>
                    <span className="bg-freedom-gray text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tabular-nums">{item.count} Lessons</span>
                  </div>
                ))}
              </div>
           </div>
           <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 h-[450px] flex flex-col">
              <h3 className="font-black text-sm uppercase tracking-widest mb-6">Produção Global CEFR</h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={levelData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {levelData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'teachers' && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                <th className="p-8">Teacher</th>
                <th className="p-8">User Info</th>
                <th className="p-8">Production</th>
                <th className="p-8 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => {
                const count = plans.filter(p => p.authorName === t.name || p.authorName === t.username).length;
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <td className="p-8">
                      <button onClick={() => setSelectedTeacher(t)} className="flex items-center gap-4 text-left group-hover:translate-x-1 transition-transform">
                        <div className="w-12 h-12 rounded-2xl bg-freedom-orange/10 p-0.5 overflow-hidden border border-freedom-orange/20">
                          {t.photo ? (
                            <img src={t.photo} alt={t.name} className="w-full h-full object-cover rounded-[14px]" />
                          ) : (
                            <div className="w-full h-full bg-freedom-orange text-white flex items-center justify-center text-sm font-black italic rounded-[14px]">
                              {t.name?.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-freedom-gray text-base leading-none mb-1">{t.name}</p>
                          <p className="text-[10px] font-bold text-freedom-orange uppercase tracking-widest leading-none">{t.username || '@teacher'}</p>
                        </div>
                      </button>
                    </td>
                    <td className="p-8">
                      <p className="text-xs font-bold text-gray-500 mb-1">{t.email}</p>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.gender || '??'} • {t.age || '??'} anos</p>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-freedom-gray tabular-nums leading-none">{count}</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Aulas</span>
                      </div>
                    </td>
                    <td className="p-8 text-right">
                       <button onClick={() => setSelectedTeacher(t)} className="px-6 py-2 bg-gray-100 text-gray-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-freedom-orange hover:text-white transition-all">Relatório</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {teachers.length === 0 && (
            <div className="p-20 text-center opacity-30 italic">No teachers registered in the database yet.</div>
          )}
        </div>
      )}

      {activeTab === 'content' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plans.map(p => (
            <div key={p.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-6">
                <span className="bg-freedom-orange text-white px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase">{p.level}</span>
                <button onClick={(e) => handleDeleteP(p.id, e)} className="text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                  <svg className="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" /></svg>
                </button>
              </div>
              <h4 className="font-bold text-sm text-freedom-gray mb-6 leading-tight uppercase tracking-tight truncate">{p.title}</h4>
              <div className="mt-auto flex justify-between items-center pt-4 border-t border-gray-50">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{p.authorName || 'Teacher'}</p>
                <Link to={`/lesson/${p.id}`} className="text-freedom-orange text-[9px] font-black uppercase tracking-widest hover:underline">View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
