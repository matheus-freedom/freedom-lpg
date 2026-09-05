import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { User, WeeklyInspirations, InspirationCategoryId, InspirationProposal, CEFRLevel, InspirationWeekSummary } from '../types';
import FredGuide from '../components/FredGuide';
import {
  getCurrentInspirations,
  getInspirationsByWeek,
  listInspirationWeeks,
  regenerateInspirations,
  proposalToPrefill,
  getNextRefreshDate,
  formatRefreshCountdown,
} from '../services/inspirationsService';

interface InspirationsProps {
  user: User | null;
}

const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

const formatWeek = (weekId?: string) => {
  if (!weekId) return '';
  const [y, m, d] = weekId.split('-');
  return `${d}/${m}/${y}`;
};

const formatNextRefresh = () => {
  const next = getNextRefreshDate();
  return next.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
    + ' às 18h';
};

// ─── Card de proposta ─────────────────────────────────────────────────────
const ProposalCard: React.FC<{
  proposal: InspirationProposal;
  categoryLabel: string;
  onUse: () => void;
}> = ({ proposal, categoryLabel, onUse }) => (
  <article className="group bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all p-7 flex flex-col h-full">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="bg-freedom-orange text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest">{proposal.level}</span>
        {proposal.isTrending ? (
          <span className="bg-freedom-gray text-freedom-orange px-3 py-1 rounded-full text-[10px] font-black tracking-widest">🔥 Em alta</span>
        ) : (
          <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black tracking-widest">Atemporal</span>
        )}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 hidden sm:block">{categoryLabel}</span>
    </div>

    <h3 className="text-freedom-gray font-extrabold text-xl leading-tight tracking-tight mb-2">{proposal.title}</h3>
    <p className="text-gray-600 text-sm font-medium leading-relaxed mb-4">{proposal.hook}</p>

    {proposal.whyNow && (
      <p className="text-[11px] font-semibold text-freedom-orange bg-freedom-orange/5 border border-freedom-orange/10 rounded-xl px-3 py-2 mb-4">
        <span className="font-black uppercase tracking-widest text-[9px] mr-2">Por que agora</span>{proposal.whyNow}
      </p>
    )}

    {proposal.vocabulary.length > 0 && (
      <div className="mb-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Vocabulary</p>
        <div className="flex flex-wrap gap-1.5">
          {proposal.vocabulary.map(w => (
            <span key={w} className="bg-gray-50 border border-gray-100 text-freedom-gray px-2.5 py-1 rounded-lg text-[11px] font-bold">{w}</span>
          ))}
        </div>
      </div>
    )}

    {proposal.conversationQuestions.length > 0 && (
      <div className="mb-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Conversation starters</p>
        <ol className="space-y-1.5">
          {proposal.conversationQuestions.map((q, i) => (
            <li key={i} className="flex gap-2 text-xs font-medium text-gray-700 leading-snug">
              <span className="text-freedom-orange font-black shrink-0">{i + 1}</span>
              <span>{q}</span>
            </li>
          ))}
        </ol>
      </div>
    )}

    {proposal.grammarIdea && (
      <p className="text-[11px] font-bold text-gray-500 mb-5">
        <span className="text-freedom-orange mr-2">📚</span>Grammar idea: <span className="text-freedom-gray">{proposal.grammarIdea}</span>
      </p>
    )}

    <button
      type="button"
      onClick={onUse}
      className="mt-auto w-full bg-freedom-gray group-hover:bg-freedom-orange text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
    >
      ⚡ Criar aula com este tema
    </button>
  </article>
);

// ─── Lista de semanas anteriores ("Insights antigos") ─────────────────────
const ArchiveList: React.FC<{ currentWeekId?: string }> = ({ currentWeekId }) => {
  const [weeks, setWeeks] = useState<InspirationWeekSummary[] | null>(null);

  useEffect(() => { listInspirationWeeks().then(setWeeks); }, []);

  // A semana atual também está no histórico, mas ela já é a tela principal —
  // aqui mostramos só as anteriores.
  const past = (weeks || []).filter(w => w.weekId !== currentWeekId);

  if (weeks === null) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (past.length === 0) {
    return (
      <div className="text-center py-24 bg-white rounded-[3rem] shadow-sm border border-dashed border-gray-200 px-6">
        <div className="text-6xl mb-4">🗂️</div>
        <h2 className="text-freedom-gray font-extrabold text-2xl tracking-tight mb-2">Ainda não há semanas anteriores.</h2>
        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest max-w-md mx-auto">
          A partir do próximo domingo, cada semana que passar fica guardada aqui — nenhuma ideia se perde.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {past.map(w => (
        <Link
          key={w.weekId}
          to={`/inspirations/archive/${w.weekId}`}
          className="group bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all p-7 flex flex-col"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-freedom-orange text-[10px] font-black uppercase tracking-[0.3em]">Semana de {formatWeek(w.weekId)}</p>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{w.total} propostas</span>
          </div>
          <p className="text-freedom-gray font-extrabold text-lg leading-tight tracking-tight mb-3">
            {w.headlines.length > 0 ? w.headlines.slice(0, 3).map(h => h.topic).join(' · ') : 'Inspirações da semana'}
          </p>
          {w.headlines.length > 3 && (
            <p className="text-gray-400 text-xs font-medium mb-3">+ {w.headlines.slice(3).map(h => h.topic).join(' · ')}</p>
          )}
          <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${w.groundingUsed ? 'text-green-600' : 'text-amber-600'}`}>
              {w.groundingUsed ? '● Pesquisa ao vivo' : '● Sem pesquisa ao vivo'}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-freedom-gray group-hover:text-freedom-orange transition-colors">Abrir semana →</span>
          </div>
        </Link>
      ))}
    </div>
  );
};

// ─── Página ───────────────────────────────────────────────────────────────
// Três modos, decididos pela URL:
//   /inspirations                    → semana atual (inspirations/current)
//   /inspirations/archive            → lista "Insights antigos"
//   /inspirations/archive/:weekId    → uma semana anterior, no mesmo layout
const Inspirations: React.FC<InspirationsProps> = ({ user }) => {
  const navigate = useNavigate();
  const { weekId, view } = useParams<{ weekId?: string; view?: string }>();
  const isArchiveList = view === 'archive' && !weekId;
  const isArchivedWeek = !!weekId;

  const [data, setData] = useState<WeeklyInspirations | null>(null);
  const [currentWeekId, setCurrentWeekId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<InspirationCategoryId>('trending');
  const [levelFilter, setLevelFilter] = useState<CEFRLevel | 'ALL'>('ALL');

  // Regeneração manual (admin)
  const [regenerating, setRegenerating] = useState(false);
  const [regenStatus, setRegenStatus] = useState('');
  const [regenError, setRegenError] = useState('');

  const load = async () => {
    setLoading(true);
    if (isArchivedWeek && weekId) {
      // Semana antiga: documento inspirations/week_<id>. A semana atual é
      // lida só para sabermos qual é (o índice do arquivo a esconde).
      const [week, current] = await Promise.all([getInspirationsByWeek(weekId), getCurrentInspirations()]);
      setData(week);
      setCurrentWeekId(current?.weekId);
    } else {
      const current = await getCurrentInspirations();
      setData(current);
      setCurrentWeekId(current?.weekId);
    }
    setLoading(false);
  };

  // Recarrega quando a URL muda (atual ↔ arquivo ↔ semana X)
  useEffect(() => { load(); window.scrollTo(0, 0); }, [weekId, view]);

  const handleRegenerate = async () => {
    if (regenerating) return;
    if (!window.confirm('Gerar novas inspirações agora? As atuais serão substituídas (ficam salvas no histórico). Leva de 1 a 3 minutos.')) return;
    setRegenerating(true);
    setRegenError('');
    try {
      await regenerateInspirations(msg => setRegenStatus(msg));
      await load();
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setRegenerating(false);
      setRegenStatus('');
    }
  };

  const handleUse = (proposal: InspirationProposal, categoryLabel: string) => {
    navigate('/quick-generate', { state: { inspiration: proposalToPrefill(proposal, categoryLabel) } });
  };

  const isAdmin = user?.role === 'admin';
  const category = data?.categories.find(c => c.id === activeCategory) || data?.categories[0];
  const visibleProposals = (category?.proposals || []).filter(p => levelFilter === 'ALL' || p.level === levelFilter);

  const fredMessage = isArchiveList
    ? 'Aqui ficam guardadas as inspirações de todas as semanas anteriores. Uma boa ideia não tem prazo de validade — abra qualquer semana e crie a aula a partir dela.'
    : isArchivedWeek
      ? `Você está revendo a semana de ${formatWeek(weekId)}. Os temas "em alta" eram daquela época, mas todas as propostas continuam prontas para virar aula.`
      : 'Toda semana eu pesquiso o que o mundo — e o Brasil — está discutindo e transformo em 50 propostas de aula, cinco em cada área (incluindo Kids e Teens). Escolha um tema e eu já deixo o Quick Lesson pronto para você ajustar.';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fadeIn">
      <FredGuide message={fredMessage} />

      {/* ── Cabeçalho ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8">
        <div>
          {(isArchiveList || isArchivedWeek) && (
            <Link to="/inspirations" className="inline-block text-freedom-orange font-black text-[10px] uppercase tracking-[0.2em] hover:underline mb-3">
              ← Semana atual
            </Link>
          )}
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-freedom-gray leading-none">
            {isArchiveList ? (
              <>Insights <span className="text-freedom-orange">antigos</span></>
            ) : (
              <>Inspira<span className="text-freedom-orange">ções</span></>
            )}
          </h1>
          <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            {isArchiveList ? (
              <span>Todas as semanas anteriores, da mais recente para a mais antiga</span>
            ) : data ? (
              <>
                <span>{isArchivedWeek ? 'Arquivo · semana de' : 'Semana de'} {formatWeek(data.weekId)}</span>
                <span className="text-gray-300">·</span>
                <span className={data.groundingUsed ? 'text-green-600' : 'text-amber-600'}>
                  {data.groundingUsed ? '● Pesquisa ao vivo no Google' : '● Sem pesquisa ao vivo nesta semana'}
                </span>
                {!isArchivedWeek && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span>Renova {formatNextRefresh()} ({formatRefreshCountdown()})</span>
                  </>
                )}
              </>
            ) : (
              <span>Renova {formatNextRefresh()} ({formatRefreshCountdown()})</span>
            )}
          </p>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {!isArchiveList && (
              <Link
                to="/inspirations/archive"
                className="bg-white hover:bg-freedom-gray hover:text-white text-freedom-gray border border-gray-200 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm transition-all"
              >
                🗂️ Insights antigos
              </Link>
            )}
            {isAdmin && !isArchiveList && !isArchivedWeek && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="bg-freedom-gray hover:bg-black disabled:opacity-60 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all border-b-4 border-gray-900"
              >
                {regenerating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-freedom-orange border-t-transparent rounded-full animate-spin" />
                    {regenStatus || 'Gerando...'}
                  </span>
                ) : '↻ Gerar agora (admin)'}
              </button>
            )}
          </div>
          {regenError && <p className="text-red-500 text-[10px] font-bold">{regenError}</p>}
        </div>
      </div>

      {isArchiveList ? (
        <ArchiveList currentWeekId={currentWeekId} />
      ) : loading ? (
        <div className="flex justify-center py-32">
          <div className="w-10 h-10 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        /* ── Estado vazio ─────────────────────────────────────── */
        <div className="text-center py-24 bg-white rounded-[3rem] shadow-sm border border-dashed border-gray-200 px-6">
          <div className="text-6xl mb-4">💡</div>
          {isArchivedWeek ? (
            <>
              <h2 className="text-freedom-gray font-extrabold text-2xl tracking-tight mb-2">Não encontrei a semana de {formatWeek(weekId)}.</h2>
              <Link to="/inspirations/archive" className="text-freedom-orange font-black text-xs uppercase tracking-widest hover:underline">Ver todas as semanas</Link>
            </>
          ) : (
            <>
              <h2 className="text-freedom-gray font-extrabold text-2xl tracking-tight mb-2">As inspirações desta semana ainda não foram geradas.</h2>
              <p className="text-gray-400 font-bold text-xs uppercase tracking-widest max-w-md mx-auto">
                A plataforma gera automaticamente todo domingo às 18h.
                {isAdmin ? ' Como admin, você pode gerar agora pelo botão acima.' : ' Peça ao administrador para gerar agora.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {isArchivedWeek && (
            <div className="flex items-center justify-between gap-4 bg-freedom-gray text-white rounded-2xl px-5 py-3 mb-6">
              <p className="text-sm font-bold">
                <span className="text-freedom-orange text-[9px] font-black uppercase tracking-[0.3em] mr-3">Arquivo</span>
                Inspirações da semana de {formatWeek(data.weekId)}
              </p>
              <Link to="/inspirations/archive" className="text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-freedom-orange shrink-0">Outras semanas →</Link>
            </div>
          )}

          {/* ── Em alta ───────────────────────────────────────── */}
          {data.headlines.length > 0 && (
            <section className="relative bg-[#141414] rounded-[2.5rem] p-7 md:p-9 mb-8 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(247,147,30,0.22),transparent_55%)]" />
              <div className="relative">
                <p className="text-freedom-orange text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                  🔥 {isArchivedWeek ? `Em alta na semana de ${formatWeek(data.weekId)}` : 'Em alta esta semana'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.headlines.map((h, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur">
                      <p className="text-white font-extrabold text-sm tracking-tight leading-snug">{h.topic}</p>
                      <p className="text-white/50 text-[11px] font-medium mt-1 leading-snug">{h.why}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Categorias ──────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 mb-4 px-1">
            {data.categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={`shrink-0 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  activeCategory === c.id
                    ? 'bg-freedom-orange border-freedom-orange text-white shadow-lg shadow-orange-200'
                    : 'bg-white border-gray-100 text-gray-500 hover:border-freedom-orange hover:text-freedom-orange'
                }`}
              >
                <span className="mr-1.5">{c.emoji}</span>{c.label}
              </button>
            ))}
          </div>

          {/* ── Filtro de nível ─────────────────────────────────── */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6 px-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {category?.emoji} {category?.label} · {visibleProposals.length} {visibleProposals.length === 1 ? 'proposta' : 'propostas'}
            </p>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {(['ALL', ...LEVELS] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevelFilter(l)}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${levelFilter === l ? 'bg-white text-freedom-orange shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {l === 'ALL' ? 'Todos' : l}
                </button>
              ))}
            </div>
          </div>

          {/* ── Propostas ───────────────────────────────────────── */}
          {visibleProposals.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[2.5rem] border border-dashed border-gray-200">
              <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Nenhuma proposta neste nível. Todas as propostas podem ser adaptadas — tente "Todos".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {visibleProposals.map(p => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  categoryLabel={category?.label || ''}
                  onUse={() => handleUse(p, category?.label || '')}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Inspirations;
