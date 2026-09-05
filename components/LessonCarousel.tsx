import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LessonPlan } from '../types';

// ─────────────────────────────────────────────────────────────
// LessonCarousel — "palco" da Home com as últimas aulas criadas.
//
// Segue a linguagem visual do modo apresentação (Cinema): a ilustração
// da aula vira fundo desfocado + véu escuro, e a mesma imagem aparece
// nítida como um pôster à direita (as ilustrações são 3:4, então
// esticá-las num palco largo cortaria o assunto principal).
//
// Comportamento:
//   • avança sozinho a cada AUTOPLAY_MS; pausa com o mouse em cima
//   • setas, bolinhas, filmstrip de miniaturas, teclado (← →) e swipe
//   • troca por crossfade (todas as lâminas ficam montadas, só a atual
//     tem opacidade 1) — com ≤ 12 aulas isso é leve
// ─────────────────────────────────────────────────────────────

const AUTOPLAY_MS = 6000;
const SCRIM = 0.72; // mesmo valor do ClassroomView: 0.95 = imagem quase invisível

interface LessonCarouselProps {
  plans: LessonPlan[];
  loading?: boolean;
}

const authorFirstName = (authorName?: string) => {
  if (!authorName) return 'Teacher';
  // authorName vem como "Nome Sobrenome · @username" — mostramos só o nome.
  return authorName.split('·')[0].trim().split(' ')[0] || 'Teacher';
};

const formatDate = (ms?: number) => {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};

const LessonCarousel: React.FC<LessonCarouselProps> = ({ plans, loading = false }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = plans.length;

  const go = useCallback((next: number) => {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
  }, [count]);

  // Autoplay
  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setInterval(() => go(index + 1), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [index, paused, count, go]);

  // Se a lista mudar (carregou), garante índice válido
  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(index - 1); }
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) go(delta < 0 ? index + 1 : index - 1);
    touchStartX.current = null;
  };

  // ── Estados vazios ──
  if (loading) {
    return (
      <div className="relative w-full h-[380px] md:h-[440px] rounded-[2.5rem] bg-[#141414] overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(247,147,30,0.18),transparent_60%)]" />
        <div className="w-10 h-10 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="relative w-full h-[380px] md:h-[440px] rounded-[2.5rem] bg-[#141414] overflow-hidden flex flex-col items-center justify-center text-center px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(247,147,30,0.18),transparent_60%)]" />
        <p className="relative text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-3">O palco está vazio</p>
        <h3 className="relative text-white text-2xl font-extrabold tracking-tight max-w-md">A primeira aula da comunidade pode ser a sua.</h3>
        <Link to="/quick-generate" className="relative mt-6 bg-freedom-orange text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform">
          Criar aula
        </Link>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-[380px] md:h-[440px] rounded-[2.5rem] bg-[#141414] overflow-hidden shadow-2xl outline-none select-none"
      tabIndex={0}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Últimas aulas da comunidade"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {plans.map((plan, i) => {
        const active = i === index;
        const hasImage = !!plan.illustrationImage;
        return (
          <div
            key={plan.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${active ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            aria-hidden={!active}
          >
            {/* Fundo: ilustração desfocada + véu, ou brilho laranja quando não há imagem */}
            {hasImage ? (
              <img
                src={plan.illustrationImage}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[7000ms] ease-linear ${active ? 'scale-110' : 'scale-100'}`}
                style={{ filter: 'blur(18px)' }}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(247,147,30,0.22),transparent_60%)]" />
            )}
            <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(20,20,20,${Math.min(1, SCRIM + 0.2)}) 0%, rgba(20,20,20,${SCRIM}) 55%, rgba(20,20,20,${SCRIM - 0.25}) 100%)` }} />

            {/* Conteúdo */}
            <div className="relative h-full flex items-stretch">
              {/* Texto */}
              <div className="flex-1 flex flex-col justify-between p-7 md:p-10 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-freedom-orange text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest">{plan.level}</span>
                  {plan.isQuickLesson && (
                    <span className="bg-white/10 text-freedom-orange border border-freedom-orange/30 px-3 py-1 rounded-full text-[10px] font-black tracking-widest">QUICK</span>
                  )}
                  <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest ml-1">{formatDate(plan.createdAt)}</span>
                </div>

                <div className="my-4">
                  <p className="text-freedom-orange text-[10px] font-black uppercase tracking-[0.3em] mb-3">Nova na biblioteca</p>
                  <h3 className="text-white font-extrabold tracking-tight leading-[1.05] text-2xl md:text-4xl max-w-[22ch] line-clamp-3">
                    {plan.title}
                  </h3>
                  <div className="mt-4 flex flex-col gap-1 text-white/70 text-xs font-semibold">
                    <p className="truncate"><span className="text-freedom-orange/90 mr-2">Grammar</span>{plan.grammarTopic}</p>
                    <p className="truncate"><span className="text-freedom-orange/90 mr-2">Focus</span>{plan.vocabularyFocus}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-freedom-orange text-white flex items-center justify-center font-black italic text-sm shadow-lg">
                      {authorFirstName(plan.authorName).charAt(0)}
                    </div>
                    <div className="leading-tight">
                      <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Created by</p>
                      <p className="text-white text-xs font-bold">Teacher {authorFirstName(plan.authorName)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/lesson/${plan.id}`} className="bg-white/10 hover:bg-white/20 backdrop-blur text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-white/10">
                      Abrir aula
                    </Link>
                    <Link to={`/classroom/${plan.id}`} className="bg-freedom-orange hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-orange-900/40">
                      ▶ Apresentar
                    </Link>
                  </div>
                </div>
              </div>

              {/* Pôster nítido (3:4) — só em telas médias para cima */}
              <div className="hidden md:flex items-center pr-10 shrink-0">
                <div className={`w-[210px] lg:w-[240px] aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 transition-all duration-700 ${active ? 'translate-y-0 rotate-0' : 'translate-y-4 rotate-2'}`}>
                  {hasImage ? (
                    <img src={plan.illustrationImage} alt={plan.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center">
                      <span className="text-freedom-orange font-black text-6xl italic opacity-30">{plan.level}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Setas */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Aula anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-freedom-orange text-white flex items-center justify-center transition-colors backdrop-blur"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Próxima aula"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-freedom-orange text-white flex items-center justify-center transition-colors backdrop-blur"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}

      {/* Barra de progresso do autoplay (reinicia a cada troca via key) */}
      {count > 1 && !paused && (
        <div className="absolute top-0 left-0 right-0 h-[3px] z-20 bg-white/10">
          <div
            key={index}
            className="h-full bg-freedom-orange"
            style={{ animation: `lpgCarouselProgress ${AUTOPLAY_MS}ms linear forwards` }}
          />
        </div>
      )}

      {/* Bolinhas */}
      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {plans.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir para a aula ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-freedom-orange' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes lpgCarouselProgress { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  );
};

export default LessonCarousel;
