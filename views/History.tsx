
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LessonPlan, User } from '../types';
import FredGuide from '../components/FredGuide';
import { getSavedPlans, deletePlanSafely } from '../services/storageService';

const History: React.FC = () => {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<LessonPlan[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'MINE'>('ALL');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const savedPlans = await getSavedPlans();
      setPlans(savedPlans);
      
      const userStr = localStorage.getItem('freedom_user');
      if (userStr) setCurrentUser(JSON.parse(userStr));
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    let result = plans;

    // Filter by ownership
    if (ownershipFilter === 'MINE' && currentUser) {
      result = result.filter(p => p.authorName === currentUser.name || p.authorName === currentUser.username);
    }

    if (searchTerm) {
      result = result.filter(p => 
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.grammarTopic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.vocabularyFocus.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (levelFilter !== 'ALL') {
      result = result.filter(p => p.level === levelFilter);
    }

    if (typeFilter !== 'ALL') {
      result = result.filter(p => typeFilter === 'QUICK' ? p.isQuickLesson : !p.isQuickLesson);
    }

    setFilteredPlans(result);
  }, [plans, searchTerm, levelFilter, typeFilter, ownershipFilter, currentUser]);

  const deletePlan = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if(window.confirm('Excluir este plano de aula permanentemente?')) {
      await deletePlanSafely(id);
      const updated = plans.filter(p => p.id !== id);
      setPlans(updated);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <FredGuide message="Welcome to the Freedom Library! Este é o nosso legado compartilhado. Aqui você encontra suas criações e as aulas incríveis de outros teachers. Use os filtros para explorar o banco global!" />
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-freedom-gray tracking-tighter uppercase leading-none">
            Freedom <span className="text-freedom-orange">Library</span>
          </h1>
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2">Banco de Dados Global da Escola</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-gray-100 p-1 rounded-2xl shadow-inner border border-gray-200">
            <button
              onClick={() => setOwnershipFilter('ALL')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ownershipFilter === 'ALL' ? 'bg-white text-freedom-orange shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Banco Global
            </button>
            <button
              onClick={() => setOwnershipFilter('MINE')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ownershipFilter === 'MINE' ? 'bg-white text-freedom-orange shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Minhas Aulas
            </button>
          </div>
          <Link to="/quick-generate" className="bg-freedom-orange text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:scale-105 transition-all active:scale-95 border-b-4 border-orange-800">
            + Nova Aula
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Buscar Conteúdo</label>
          <input 
            type="text" 
            placeholder="Tópico, gramática, título..."
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-freedom-orange outline-none font-medium text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nível CEFR</label>
          <select 
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-freedom-orange outline-none font-bold text-sm"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="ALL">Todos os Níveis</option>
            <option value="A1">A1 - Beginner</option>
            <option value="A2">A2 - Elementary</option>
            <option value="B1">B1 - Intermediate</option>
            <option value="B2">B2 - Upper Intermediate</option>
            <option value="C1">C1 - Advanced</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Metodologia</label>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {['ALL', 'QUICK', 'STANDARD'].map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${typeFilter === type ? 'bg-white text-freedom-orange shadow-sm' : 'text-gray-400'}`}
              >
                {type === 'ALL' ? 'Todos' : type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-[3rem] shadow-sm border border-dashed border-gray-200">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-gray-400 font-bold uppercase text-sm tracking-widest">Nenhuma aula encontrada nos filtros selecionados.</p>
          <button onClick={() => {setSearchTerm(''); setLevelFilter('ALL'); setTypeFilter('ALL'); setOwnershipFilter('ALL');}} className="mt-4 text-freedom-orange font-black text-xs uppercase hover:underline">Limpar Filtros</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPlans.map((plan) => {
            const isMine = currentUser && (plan.authorName === currentUser.name || plan.authorName === currentUser.username);
            return (
              <Link key={plan.id} to={`/lesson/${plan.id}`} className="group bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all border border-gray-100 relative flex flex-col h-full overflow-hidden">
                
                {/* Image Header */}
                <div className="h-40 w-full relative overflow-hidden bg-gray-200 shrink-0">
                  {plan.illustrationImage ? (
                    <img 
                      src={plan.illustrationImage} 
                      alt={plan.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${
                      plan.level.startsWith('A') ? 'from-orange-400 to-orange-600' : 
                      plan.level.startsWith('B') ? 'from-gray-700 to-gray-900' : 
                      'from-black to-gray-800'
                    }`}>
                      <span className="text-white font-black text-4xl opacity-20 italic">{plan.level}</span>
                    </div>
                  )}
                  
                  {/* Tags over image */}
                  <div className="absolute top-4 left-4 flex space-x-2">
                    <span className="bg-freedom-orange text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg border border-white/20">{plan.level}</span>
                    {plan.isQuickLesson && (
                      <span className="bg-freedom-gray text-freedom-orange px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg border border-freedom-orange/30">QUICK</span>
                    )}
                  </div>

                  <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-3 right-4">
                     <span className="text-[9px] text-white font-black uppercase tracking-tighter drop-shadow-md opacity-80">{new Date(plan.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-7 flex flex-col flex-1">
                  <div className="mb-4">
                    {isMine && (
                      <span className="inline-block bg-green-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter mb-2">Minha Aula</span>
                    )}
                    <h3 className="text-lg font-black text-freedom-gray group-hover:text-freedom-orange transition-colors leading-tight uppercase tracking-tighter line-clamp-2">
                      {plan.title}
                    </h3>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-[11px] font-bold text-gray-500 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                       <span className="text-freedom-orange mr-2">📚</span>
                       <span className="truncate">Grammar: {plan.grammarTopic}</span>
                    </div>
                    <div className="flex items-center text-[11px] font-bold text-gray-500 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                       <span className="text-freedom-orange mr-2">🎯</span>
                       <span className="truncate">Focus: {plan.vocabularyFocus}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-5 border-t border-gray-50">
                    <div className="flex flex-col">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Created By</p>
                      <p className="text-[10px] font-bold text-freedom-gray leading-none truncate max-w-[120px]">{plan.authorName || 'Teacher'}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                       <div className="flex items-center space-x-2 text-[9px] font-black text-gray-400 uppercase">
                          <span>⏱ {plan.duration}</span>
                       </div>
                       {isMine && (
                        <button 
                          onClick={(e) => deletePlan(plan.id, e)}
                          className="p-2 text-gray-200 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default History;
