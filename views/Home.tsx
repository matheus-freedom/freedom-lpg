import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LessonPlan, User, WeeklyInspirations } from '../types';
import LessonCarousel from '../components/LessonCarousel';
import { getRecentPlans, getLessonCounts } from '../services/storageService';
import { getCurrentInspirations, pickDailyHighlights, proposalToPrefill, formatRefreshCountdown } from '../services/inspirationsService';

interface HomeProps {
  user: User | null;
}

// Saudação pelo horário local do professor.
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const Home: React.FC<HomeProps> = ({ user }) => {
  const navigate = useNavigate();
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [recentPlans, setRecentPlans] = useState<LessonPlan[]>([]);
  const [counts, setCounts] = useState<{ mine: number; global: number } | null>(null);
  const [inspirations, setInspirations] = useState<WeeklyInspirations | null>(null);

  useEffect(() => {
    // As três buscas são independentes — disparamos juntas e cada uma
    // atualiza a tela quando chega, em vez de esperar a mais lenta.
    getRecentPlans(10).then(plans => {
      setRecentPlans(plans);
      setLoadingPlans(false);
    });
    getLessonCounts(user?.id).then(setCounts);
    getCurrentInspirations().then(setInspirations);
  }, [user]);

  const firstName = user ? user.name.split(' ')[0] : '';
  const highlights = inspirations ? pickDailyHighlights(inspirations, 3) : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fadeIn">

      {/* ── Cabeçalho ─────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <p className="text-freedom-orange text-[10px] font-black uppercase tracking-[0.3em] mb-2">
            {user?.role === 'admin' ? 'Modo administrador' : 'Freedom Language Center'}
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-freedom-gray leading-none">
            {greeting()}, Teacher {firstName}.
          </h1>
          <p className="text-gray-500 font-medium text-sm mt-3 max-w-xl">
            Você é a ponte entre os sonhos e a realidade dos seus alunos. O que vamos criar hoje?
          </p>
        </div>
        <Link
          to="/quick-generate"
          className="group inline-flex items-center gap-3 bg-freedom-gray hover:bg-black text-white pl-6 pr-5 py-4 rounded-2xl shadow-lg transition-all hover:-translate-y-0.5 border-b-4 border-gray-900 self-start md:self-auto"
        >
          <span className="text-2xl">⚡</span>
          <span className="leading-tight">
            <span className="block text-freedom-orange font-black uppercase tracking-tight">Nova Quick Lesson</span>
            <span className="block text-gray-400 text-[10px] font-bold uppercase tracking-widest">Reading · Quiz · Conversation</span>
          </span>
        </Link>
      </header>

      {/* ── Palco: últimas aulas ──────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h2 className="font-title text-lg text-freedom-gray uppercase tracking-tighter">Últimas aulas da comunidade</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">O que os teachers criaram por último</p>
          </div>
          <Link to="/history" className="text-freedom-orange font-black text-[10px] uppercase tracking-[0.2em] hover:underline">
            Ver biblioteca →
          </Link>
        </div>
        <LessonCarousel plans={recentPlans} loading={loadingPlans} />
      </section>

      {/* ── Inspirações da semana ─────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h2 className="font-title text-lg text-freedom-gray uppercase tracking-tighter">Inspirações da semana</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Temas em alta pesquisados pela plataforma · {formatRefreshCountdown()}
            </p>
          </div>
          <Link to="/inspirations" className="text-freedom-orange font-black text-[10px] uppercase tracking-[0.2em] hover:underline">
            Ver todas →
          </Link>
        </div>

        {highlights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {highlights.map(({ proposal, categoryLabel, emoji }) => (
              <article key={proposal.id} className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all p-6 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{emoji} {categoryLabel}</span>
                  <span className="bg-freedom-orange/10 text-freedom-orange px-2.5 py-1 rounded-full text-[10px] font-black">{proposal.level}</span>
                </div>
                <h3 className="text-freedom-gray font-extrabold text-lg leading-tight tracking-tight mb-2">{proposal.title}</h3>
                <p className="text-gray-500 text-xs font-medium leading-relaxed line-clamp-3 mb-4">{proposal.hook}</p>
                {proposal.isTrending && (
                  <p className="text-[10px] font-bold text-freedom-orange mb-4">🔥 {proposal.whyNow}</p>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/quick-generate', { state: { inspiration: proposalToPrefill(proposal, categoryLabel) } })}
                  className="mt-auto self-start text-[10px] font-black uppercase tracking-widest text-freedom-gray group-hover:text-freedom-orange transition-colors"
                >
                  Criar aula com este tema →
                </button>
              </article>
            ))}
          </div>
        ) : (
          <Link to="/inspirations" className="block bg-white rounded-3xl border border-dashed border-gray-200 p-8 text-center hover:border-freedom-orange transition-colors">
            <p className="text-2xl mb-2">💡</p>
            <p className="text-freedom-gray font-extrabold tracking-tight">As inspirações desta semana ainda não foram geradas.</p>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Abrir a aba Inspirações</p>
          </Link>
        )}
      </section>

      {/* ── Atalhos ──────────────────────────────────────────── */}
      <section className={`grid grid-cols-1 ${user?.role === 'admin' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-5 mb-12`}>
        <Link to="/history" className="group bg-white hover:bg-freedom-gray rounded-3xl border border-gray-100 p-6 flex items-center justify-between transition-all shadow-sm hover:shadow-xl">
          <div>
            <h3 className="font-extrabold tracking-tight text-freedom-gray group-hover:text-white transition-colors">Freedom Library</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-300">Todas as aulas, suas e da comunidade</p>
          </div>
          <span className="text-3xl">📚</span>
        </Link>
        <Link to="/inspirations" className="group bg-white hover:bg-freedom-gray rounded-3xl border border-gray-100 p-6 flex items-center justify-between transition-all shadow-sm hover:shadow-xl">
          <div>
            <h3 className="font-extrabold tracking-tight text-freedom-gray group-hover:text-white transition-colors">Inspirações</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-300">50 temas novos toda semana</p>
          </div>
          <span className="text-3xl">💡</span>
        </Link>
        {user?.role === 'admin' && (
          <Link to="/admin" className="group bg-white hover:bg-green-600 rounded-3xl border border-gray-100 p-6 flex items-center justify-between transition-all shadow-sm hover:shadow-xl">
            <div>
              <h3 className="font-extrabold tracking-tight text-freedom-gray group-hover:text-white transition-colors">Painel de Controle</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-green-100">Insights globais e gerenciamento</p>
            </div>
            <span className="text-3xl">📊</span>
          </Link>
        )}
      </section>

      {/* ── Contadores discretos ──────────────────────────────── */}
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
        {counts ? (
          <>
            Você criou <span className="text-freedom-gray">{counts.mine}</span> {counts.mine === 1 ? 'aula' : 'aulas'}
            <span className="mx-3 text-gray-300">·</span>
            A comunidade já soma <span className="text-freedom-orange">{counts.global}</span> aulas
          </>
        ) : '…'}
      </p>
    </div>
  );
};

export default Home;
