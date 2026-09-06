import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LessonPlan, QuizQuestion } from '../types';
import { generateLessonImage, generateAudioFromText, translateWordToPortuguese } from '../services/geminiService';
import { getPlanById, updateLessonPlan } from '../services/storageService';

// --- Funções Auxiliares de Áudio ---
function createWavBlob(pcmData: Uint8Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 32 + pcmData.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length, true);

  const finalBuffer = new Uint8Array(buffer);
  finalBuffer.set(pcmData, 44);
  return new Blob([finalBuffer], { type: 'audio/wav' });
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Tokens visuais do "palco" (variante Cinema) ──
// A ilustracao da aula vira o fundo de todos os slides: desfocada e coberta por um
// veu escuro, para o texto branco continuar 100% legivel. O SCRIM controla o quanto
// a imagem aparece (0.95 = quase invisivel, 0.45 = muito forte).
const STAGE_INK = '20,20,20';
const SCRIM = 0.72;
const STAGE_SCRIM_STYLE: React.CSSProperties = {
  background: `linear-gradient(180deg, rgba(${STAGE_INK},${SCRIM + 0.08}) 0%, rgba(${STAGE_INK},${SCRIM}) 45%, rgba(${STAGE_INK},${SCRIM + 0.12}) 100%)`,
};
const STAGE_VIGNETTE_STYLE: React.CSSProperties = {
  background: `radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(${STAGE_INK},.55) 100%)`,
};
const STAGE_FALLBACK_STYLE: React.CSSProperties = {
  background: `radial-gradient(80% 60% at 70% 30%, rgba(247,147,30,.18), transparent 60%), #141414`,
};

// Classes reutilizadas nos cards "de vidro" (fundo translucido + blur), para os
// tres tipos de slide parecerem uma familia so.
const GLASS_CARD = "bg-[#141414]/60 border border-white/15 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,.45)]";
const GO_FURTHER_BTN = "inline-flex items-center gap-3 rounded-full font-black text-[11px] uppercase tracking-[0.22em] px-7 py-3.5 transition-all active:translate-y-px";

const ClassroomView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [quizState, setQuizState] = useState<Record<number, { selected: number; confirmed: boolean }>>({});
  const [showBackground, setShowBackground] = useState(false);
  const [fontSize, setFontSize] = useState(24);
  const [translation, setTranslation] = useState<{ word: string; translated: string; x: number; y: number } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Audio States
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Image Generation State (Fallback)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [dynamicImage, setDynamicImage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Guarda as funcoes next/prev mais recentes para o atalho de teclado (setas),
  // sem precisar recriar o listener a cada render.
  const navRef = useRef<{ next: () => void; prev: () => void } | null>(null);

  useEffect(() => {
    const loadPlan = async () => {
      if (!id) return;
      try {
        const found = await getPlanById(id);
        if (found) {
          setPlan(found);
          if (found.isQuickLesson) setFontSize(28);
          if (found.illustrationImage) setDynamicImage(found.illustrationImage);
        } else {
          console.error("Plano não encontrado no Firebase");
        }
      } catch (error) {
        console.error("Erro ao carregar aula:", error);
      }
    };
    loadPlan();
  }, [id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      if ('preservesPitch' in audioRef.current) {
        (audioRef.current as any).preservesPitch = true;
      }
    }
  }, [playbackRate]);

  // ── Navegacao pelo teclado: ← e → trocam de slide ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight') navRef.current?.next();
      if (e.key === 'ArrowLeft') navRef.current?.prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── TRADUÇÃO: usa geminiService (chave protegida no servidor) ──
  const handleTranslate = async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").trim();
    if (!cleanWord || isTranslating) return;

    setTranslation({ word: cleanWord, translated: "Thinking...", x: e.clientX, y: e.clientY });
    setIsTranslating(true);

    try {
      const result = await translateWordToPortuguese(cleanWord);
      setTranslation(prev => prev ? { ...prev, translated: result.trim() } : null);
    } catch {
      setTranslation(prev => prev ? { ...prev, translated: "Error" } : null);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleManualImageGeneration = async () => {
    if (isGeneratingImage || !plan) return;
    setIsGeneratingImage(true);
    try {
      const prompt = `${plan.vocabularyFocus} ultra realistic photographic style`;
      const img = await generateLessonImage(prompt);
      if (img) {
        setDynamicImage(img);
        await updateLessonPlan(plan.id, { illustrationImage: img });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // ── ÁUDIO: usa geminiService com suporte a accentInstruction ──
  const handleGenerateAudio = async (text: string) => {
    if (isAudioLoading || isAudioReady) return;

    setIsAudioLoading(true);
    try {
      const voiceName = plan?.audioConfig?.voiceName || 'Zephyr';
      const accentInstruction = (plan?.audioConfig as any)?.accentInstruction;

      const base64Audio = await generateAudioFromText(text, voiceName, accentInstruction);

      if (!base64Audio) throw new Error("Audio error");

      const pcmBytes = decode(base64Audio);
      const wavBlob = createWavBlob(pcmBytes, 24000);
      const audioUrl = URL.createObjectURL(wavBlob);

      const audio = new Audio(audioUrl);
      audio.onloadedmetadata = () => setDuration(audio.duration);
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onended = () => setIsPlaying(false);
      audioRef.current = audio;

      setIsAudioReady(true);
    } catch (e) {
      console.error("Audio generation failed", e);
      alert("Fred couldn't generate the audio. Please check your connection.");
    } finally {
      setIsAudioLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [currentSlide]);

  if (!plan) return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-title text-sm uppercase tracking-widest">Loading Presentation...</p>
      </div>
    </div>
  );

  const cleanTitle = (title: string) => {
    return title
      .replace(/^Reading:?\s*/i, '')
      .replace(/^Reading\s*[-–—]\s*/i, '')
      .replace(/^Reading\s*Task:?\s*/i, '')
      .replace(/^Text:?\s*/i, '')
      .trim();
  };

  let slides: any[] = [];
  if (plan.isQuickLesson) {
    const readingSection = plan.sections[0];
    const rawContent = (readingSection?.studentContent || "")
      .replace(/\\n/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n');

    let textOnly = "";
    let vocabListRaw = "";
    if (rawContent.includes('||VOCAB||')) {
      const parts = rawContent.split('||VOCAB||');
      textOnly = parts[0]?.trim();
      vocabListRaw = parts[1]?.trim();
    } else { textOnly = rawContent; }

    slides.push({
      type: 'reading-compact',
      title: cleanTitle(readingSection?.title || plan.title),
      content: { text: textOnly, vocab: vocabListRaw },
      illustration: dynamicImage
    });

    // Uma pergunta por slide: a tela fica limpa e o grupo foca em uma questao de cada vez.
    const quickQuiz = (plan.quiz || []).slice(0, 5);
    quickQuiz.forEach((q, i) => {
      slides.push({ type: 'quiz', question: q, qIndex: i, qTotal: quickQuiz.length });
    });

    plan.sections.slice(1, 11).forEach((sec, idx) => {
      slides.push({
        type: 'question-v2',
        title: `Conversation Point`,
        index: idx + 1,
        content: sec.studentContent,
        backgroundQuestions: sec.backgroundQuestions
      });
    });
  } else {
    slides = [
      { type: 'title', title: cleanTitle(plan.title), subtitle: `${plan.level} Class` },
      ...plan.sections.map(s => ({ type: 'content', title: cleanTitle(s.title), content: s.studentContent, backgroundQuestions: s.backgroundQuestions })),
      ...(plan.quiz || []).map((q, i, arr) => ({ type: 'quiz', question: q, qIndex: i, qTotal: arr.length }))
    ];
  }

  const renderClickableText = (text: string, vocabWords: string[]) => {
    const clean = (w: string) => w.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").trim();
    const vocabSet = new Set(vocabWords.map(v => clean(v)));
    const paragraphs = text.split(/\n+/);

    return paragraphs.map((para, pIdx) => (
      <p key={pIdx} className="mb-7 last:mb-0">
        {para.split(/(\s+)/).map((part, i) => {
          if (part.trim() === '') return part;
          const isVocab = vocabSet.has(clean(part));
          return (
            <span
              key={i}
              onClick={(e) => handleTranslate(part, e)}
              onMouseLeave={() => setTranslation(null)}
              className={`transition-all rounded px-0.5 cursor-pointer inline ${isVocab ? 'text-freedom-orange font-extrabold border-b-2 border-freedom-orange/40' : 'hover:text-freedom-orange hover:bg-white/10'}`}
            >
              {part}
            </span>
          );
        })}
      </p>
    ));
  };

  // Cards com as perguntas de apoio do professor (abrem no botao "Go Further").
  const renderSupportCards = (questions: string[] | undefined) => {
    if (!questions || questions.length === 0) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full max-w-5xl animate-fadeIn overflow-y-auto max-h-[28vh] custom-scrollbar pr-1">
        {questions.map((bq: string, bi: number) => (
          <div key={bi} className={`${GLASS_CARD} rounded-[20px] p-4 text-left grid grid-cols-[26px_1fr] gap-3 items-start`}>
            <span className="text-freedom-orange font-black italic text-lg leading-tight">{bi + 1}</span>
            <p className="m-0 text-[13.5px] font-semibold italic leading-snug text-white">"{bq}"</p>
          </div>
        ))}
      </div>
    );
  };

  const renderGoFurther = (questions: string[] | undefined) => {
    if (!questions || questions.length === 0) return null;
    return (
      <div className="mt-8 flex flex-col items-start gap-4 shrink-0 w-full">
        <button
          onClick={() => setShowBackground(!showBackground)}
          className={`${GO_FURTHER_BTN} ${showBackground
            ? 'bg-white/10 text-white border border-white/15 backdrop-blur'
            : 'bg-freedom-orange text-white shadow-[0_14px_34px_rgba(247,147,30,.4),inset_0_-3px_0_rgba(0,0,0,.18)] hover:-translate-y-px'}`}
        >
          <span>{showBackground ? "Hide" : "Go Further"}</span>
          <span className="w-[22px] h-[22px] rounded-full bg-black/20 flex items-center justify-center text-[13px]">→</span>
        </button>
        {showBackground && renderSupportCards(questions)}
      </div>
    );
  };

  const renderContent = (slide: any) => {
    if (slide.type === 'reading-compact') {
      const { text, vocab } = slide.content;
      const vocabLines = vocab ? vocab.split('\n').filter((l:any) => l.trim()) : [];
      const vocabWords = vocabLines.map((line: string) => {
        const parts = line.split(/[-:]/);
        return parts[0].replace(/^\d+[\.\)]\s*/, '').trim();
      });

      return (
        <div className="flex flex-col w-full h-full text-left overflow-hidden relative">
          {translation && (
            <div
              className="fixed bg-freedom-gray text-white p-3 rounded-2xl shadow-2xl z-[100] border-2 border-freedom-orange text-sm font-black animate-fadeIn pointer-events-none transform -translate-x-1/2 -translate-y-full mb-4"
              style={{ top: translation.y, left: translation.x }}
            >
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-freedom-orange uppercase tracking-widest mb-1">{translation.word}</span>
                <span>{translation.translated}</span>
              </div>
            </div>
          )}

          <div className="flex flex-1 gap-10 overflow-hidden min-h-0">
            <div className="flex-1 max-w-[38%] flex flex-col gap-3.5">
              <div className="w-full flex-1 min-h-0 rounded-[28px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.55)] outline outline-2 outline-white/15 bg-white/5 relative">
                {dynamicImage ? (
                  <img src={dynamicImage} alt="Context" className="w-full h-full object-cover animate-fadeIn" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-freedom-orange/15 rounded-full flex items-center justify-center mb-4 text-freedom-orange">
                      {isGeneratingImage ? (
                        <div className="w-10 h-10 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      )}
                    </div>
                    <p className="text-white/50 font-bold text-xs uppercase tracking-widest mb-4">
                      {isGeneratingImage ? "Fred is painting..." : "No image found"}
                    </p>
                    <button
                      onClick={handleManualImageGeneration}
                      disabled={isGeneratingImage}
                      className="bg-freedom-orange text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isGeneratingImage ? "Working..." : "✨ Generate Illustration"}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white/10 border border-white/15 backdrop-blur-md p-3.5 rounded-[20px] flex flex-col gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  {!isAudioReady ? (
                    <button
                      onClick={() => handleGenerateAudio(text)}
                      disabled={isAudioLoading}
                      className="w-12 h-12 flex items-center justify-center rounded-[14px] shadow-[0_8px_20px_rgba(247,147,30,.35)] transition-all active:scale-90 bg-freedom-orange text-white hover:brightness-110"
                      title="Prepare Audio"
                    >
                      {isAudioLoading ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={togglePlay}
                      className={`w-12 h-12 flex items-center justify-center rounded-[14px] shadow-[0_8px_20px_rgba(247,147,30,.35)] transition-all active:scale-90 text-white ${isPlaying ? 'bg-white/15' : 'bg-freedom-orange'}`}
                    >
                      {isPlaying ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                        <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>
                  )}

                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[9px] font-extrabold text-white/55 tabular-nums uppercase tracking-wider">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      step="0.01"
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-freedom-orange"
                    />
                  </div>

                  <div className="flex bg-white/10 rounded-xl p-1 shrink-0">
                    {[0.75, 1, 1.5].map(r => (
                      <button key={r} onClick={() => setPlaybackRate(r)} className={`px-2.5 py-1.5 text-[9px] font-black rounded-lg transition-colors ${playbackRate === r ? 'bg-freedom-orange text-white' : 'text-white/55 hover:text-white'}`}>{r}x</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-[1.8] flex flex-col overflow-hidden min-w-0">
              <div className="mb-5">
                <div className="text-[11px] font-extrabold tracking-[0.28em] uppercase text-freedom-orange mb-1.5">Reading · {plan.level}</div>
                <h2 className="text-2xl lg:text-4xl font-extrabold text-white tracking-tight uppercase leading-[1.08]" style={{ textWrap: 'balance' } as React.CSSProperties}>{slide.title}</h2>
              </div>

              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                <div
                  className="text-white leading-relaxed font-medium"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {renderClickableText(text, vocabWords)}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (slide.type === 'quiz') {
      // Um slide por pergunta. O estado das respostas continua indexado pela posicao
      // da pergunta no quiz (qIndex), entao voltar um slide mantem a resposta dada.
      const q = slide.question as QuizQuestion;
      const qIdx = slide.qIndex as number;
      const state = quizState[qIdx];
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      return (
        <div className="w-full h-full flex flex-col justify-center relative px-4 lg:px-10">
          <div className="flex items-center gap-4 mb-6 shrink-0">
            <div className="w-11 h-11 rounded-xl bg-freedom-orange text-white flex items-center justify-center font-black italic text-xl shadow-[0_8px_18px_rgba(247,147,30,.35)]">{qIdx + 1}</div>
            <div>
              <div className="text-[11px] font-extrabold tracking-[0.28em] uppercase text-freedom-orange">Knowledge Lab</div>
              <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/45">Question {qIdx + 1} of {slide.qTotal}</div>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col justify-center overflow-y-auto custom-scrollbar">
            <h2
              className="text-white font-bold max-w-[30ch] m-0"
              style={{ fontSize: `${fontSize * 1.25}px`, lineHeight: 1.2, letterSpacing: '-.01em', textShadow: `0 2px 30px rgba(${STAGE_INK},.6)`, textWrap: 'balance' } as React.CSSProperties}
            >
              {q.question}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 max-w-5xl w-full">
              {q.options.map((opt, oIdx) => {
                const isCorrect = oIdx === q.correctIndex;
                const isSelected = state?.selected === oIdx;
                let btnClass = `${GLASS_CARD} rounded-[18px] px-5 py-4 text-left transition-all flex items-start gap-4 `;
                let letterClass = "w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-black text-sm ";
                if (state?.confirmed) {
                  if (isCorrect) { btnClass += "border-green-500 bg-green-500/15 text-green-300"; letterClass += "bg-green-500 text-white"; }
                  else if (isSelected) { btnClass += "border-red-500 bg-red-500/15 text-red-300"; letterClass += "bg-red-500 text-white"; }
                  else { btnClass += "text-white opacity-35"; letterClass += "bg-white/10 text-white"; }
                } else {
                  btnClass += "text-white hover:border-freedom-orange hover:-translate-y-px";
                  letterClass += "bg-white/10 text-white";
                }
                return (
                  <button
                    key={oIdx}
                    onClick={() => { if (!quizState[qIdx]?.confirmed) setQuizState({ ...quizState, [qIdx]: { selected: oIdx, confirmed: true } }); }}
                    className={btnClass}
                  >
                    <span className={letterClass}>{letters[oIdx] || oIdx + 1}</span>
                    <span className="font-bold leading-snug" style={{ fontSize: `${Math.max(fontSize * 0.7, 15)}px` }}>{opt}</span>
                  </button>
                );
              })}
            </div>

            {state?.confirmed && q.explanation && (
              <div className={`${GLASS_CARD} rounded-[18px] px-5 py-4 mt-5 max-w-5xl w-full animate-fadeIn flex items-start gap-3`}>
                <span className="text-freedom-orange font-black text-[10px] tracking-[0.22em] uppercase mt-1 shrink-0">Why</span>
                <p className="m-0 text-white/85 font-semibold italic leading-snug" style={{ fontSize: `${Math.max(fontSize * 0.62, 14)}px` }}>{q.explanation}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (slide.type === 'question-v2') {
      return (
        <div className="w-full h-full flex flex-col justify-center relative px-4 lg:px-10">
          {/* Numeral gigante em marca-d'agua: identifica a pergunta sem rotulo nem chip. */}
          <div
            aria-hidden="true"
            className="absolute right-[4%] top-1/2 -translate-y-1/2 font-black italic leading-none pointer-events-none select-none"
            style={{ fontSize: 'min(70vh, 40vw)', color: 'rgba(247,147,30,.17)', letterSpacing: '-.06em', textShadow: '0 0 60px rgba(247,147,30,.15)' }}
          >
            {slide.index}
          </div>

          <div className="relative flex-1 min-h-0 flex flex-col justify-center overflow-y-auto custom-scrollbar">
            <h2
              className="text-white font-bold max-w-[26ch] m-0"
              style={{ fontSize: `${fontSize * 1.5}px`, lineHeight: 1.18, letterSpacing: '-.015em', textShadow: `0 2px 30px rgba(${STAGE_INK},.6)`, textWrap: 'balance' } as React.CSSProperties}
            >
              {slide.content}
            </h2>
            {renderGoFurther(slide.backgroundQuestions)}
          </div>
        </div>
      );
    }

    // ── Aulas "Standard": slide de titulo e slides de conteudo ──
    if (slide.type === 'title') {
      return (
        <div className="w-full h-full flex flex-col justify-center relative px-4 lg:px-10">
          <div className="text-[11px] font-extrabold tracking-[0.28em] uppercase text-freedom-orange mb-4">{slide.subtitle}</div>
          <h1
            className="text-white font-extrabold uppercase tracking-tight m-0 max-w-[20ch]"
            style={{ fontSize: `${fontSize * 1.9}px`, lineHeight: 1.05, textWrap: 'balance' } as React.CSSProperties}
          >
            {slide.title}
          </h1>
        </div>
      );
    }

    const contentText = slide.content || "";
    return (
      <div className="w-full h-full flex flex-col justify-center relative px-4 lg:px-10 overflow-hidden">
        {slide.title && (
          <div className="mb-5 shrink-0">
            <span className="inline-block text-[10px] font-extrabold text-white bg-white/10 border border-white/15 backdrop-blur px-5 py-2 rounded-full tracking-[0.22em] uppercase">
              {slide.title}
            </span>
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col justify-center overflow-y-auto custom-scrollbar">
          <div
            className="text-white font-semibold max-w-[34ch] whitespace-pre-line"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.3, textShadow: `0 2px 30px rgba(${STAGE_INK},.6)` }}
          >
            {contentText}
          </div>
          {renderGoFurther(slide.backgroundQuestions)}
        </div>
      </div>
    );
  };

  const stopAudio = () => {
    setShowBackground(false);
    setIsAudioReady(false);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const next = () => {
    stopAudio();
    setCurrentSlide(c => Math.min(c + 1, slides.length - 1));
  };

  const prev = () => {
    stopAudio();
    setCurrentSlide(c => Math.max(c - 1, 0));
  };
  navRef.current = { next, prev };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col z-50 overflow-hidden select-none">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f7931e; border-radius: 10px; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .slide-rise { animation: slideRise .45s cubic-bezier(.2,.8,.2,1); }
        @keyframes slideRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .slide-rise { animation: none; } }
      `}</style>

      <div className="flex justify-between items-center py-1.5 px-6 bg-[#0a0a0a] border-b border-white/5 z-30">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 bg-freedom-orange rounded-lg flex items-center justify-center shadow-[0_6px_16px_rgba(247,147,30,.35)]">
            <span className="text-white font-black text-xl italic leading-none">F</span>
          </div>
          <h2 className="text-white font-black text-sm tracking-tighter uppercase">
            FREEDOM<span className="text-freedom-orange">ACADEMY</span>
          </h2>
        </div>
        <button onClick={() => navigate('/')} className="text-white/40 font-black border border-white/10 px-4 py-1.5 rounded-lg hover:bg-white hover:text-black transition-all uppercase text-[8px] tracking-widest">
          Close Presentation
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-2 lg:p-4 overflow-hidden relative">
        <div className="w-[98vw] h-[92vh] rounded-[2.5rem] shadow-[0_40px_120px_rgba(0,0,0,.6)] relative overflow-hidden border-b-[10px] border-freedom-orange bg-[#141414] text-white">
          {/* Palco: ilustracao da aula ao fundo (desfocada) + veu escuro + vinheta */}
          {dynamicImage ? (
            <div
              className="absolute -inset-[6%] bg-center bg-cover"
              style={{ backgroundImage: `url(${dynamicImage})`, filter: 'blur(14px) saturate(1.15)', transform: 'scale(1.06)' }}
            />
          ) : (
            <div className="absolute inset-0" style={STAGE_FALLBACK_STYLE} />
          )}
          <div className="absolute inset-0" style={STAGE_SCRIM_STYLE} />
          <div className="absolute inset-0" style={STAGE_VIGNETTE_STYLE} />

          <div key={currentSlide} className="relative z-10 w-full h-full p-6 lg:p-11 slide-rise">
            {renderContent(slides[currentSlide])}
          </div>

          <div className="absolute top-5 right-5 z-[60] group">
            <div className="p-1.5 rounded-2xl flex flex-col space-y-1.5 opacity-15 group-hover:opacity-100 transition-all">
              <button onClick={() => setFontSize(prev => Math.min(prev + 2, 160))} className="w-8 h-8 rounded-lg bg-freedom-orange text-white flex items-center justify-center text-xl font-black shadow-lg">+</button>
              <button onClick={() => setFontSize(prev => Math.max(prev - 2, 16))} className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center text-xl font-black shadow-lg">×</button>
            </div>
          </div>
        </div>
      </div>

      <div className="py-2 px-8 flex items-center justify-between bg-[#0a0a0a] z-30 border-t border-white/5">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <span className="text-white font-black text-xl tabular-nums leading-none">{currentSlide + 1}</span>
            <span className="text-white/20 font-black text-xl leading-none">/</span>
            <span className="text-white/20 font-black text-xl tabular-nums leading-none">{slides.length}</span>
            <div className="flex space-x-1.5 px-2">
              {slides.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-8 bg-freedom-orange shadow-[0_0_10px_rgba(247,147,30,0.5)]' : i < currentSlide ? 'w-1.5 bg-freedom-orange/45' : 'w-1.5 bg-white/10'}`} />
              ))}
            </div>
          </div>
          <span className="text-freedom-orange/40 font-black tracking-widest text-[8px] uppercase">Live Presentation</span>
        </div>
        <div className="flex space-x-4">
          <button onClick={prev} disabled={currentSlide === 0} className="w-12 h-10 rounded-xl bg-white/5 text-white flex items-center justify-center disabled:opacity-0 hover:bg-white/10 transition-all active:scale-95">
            <span className="text-xl">←</span>
          </button>
          <button onClick={next} disabled={currentSlide === slides.length - 1} className="w-20 h-10 rounded-xl bg-freedom-orange text-white flex items-center justify-center disabled:opacity-20 hover:bg-orange-600 transition-all text-2xl shadow-lg border-b-4 border-orange-900 active:translate-y-0.5 active:border-b-0">
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassroomView;
