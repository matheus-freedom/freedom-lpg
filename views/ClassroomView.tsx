import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LessonPlan, QuizQuestion } from '../types';
import { GoogleGenAI } from "@google/genai";
import { generateLessonImage } from '../services/geminiService';
// AQUI ESTÁ A MUDANÇA PRINCIPAL: Importamos do storageService
import { getPlanById, updateLessonPlan } from '../services/storageService';

// --- Funções Auxiliares de Áudio (Mantidas iguais) ---
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
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
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

  // --- CARREGAMENTO DO PLANO (CORRIGIDO PARA FIREBASE) ---
  useEffect(() => {
    const loadPlan = async () => {
      if (!id) return;
      try {
        // Busca do Firebase ao invés do localStorage
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

  const handleTranslate = async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").trim();
    if (!cleanWord || isTranslating) return;

    setTranslation({ word: cleanWord, translated: "Thinking...", x: e.clientX, y: e.clientY });
    setIsTranslating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Translate the English word "${cleanWord}" to Portuguese. Provide ONLY the Portuguese word, nothing else.` }] }],
      });
      const result = response.text || "Error";
      setTranslation(prev => prev ? { ...prev, translated: result.trim() } : null);
    } catch (err) {
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
        // --- SALVAMENTO DA IMAGEM (CORRIGIDO PARA FIREBASE) ---
        // Agora usamos o updateLessonPlan que já sabe lidar com o Firebase
        // Nota: Se a imagem for muito pesada, o ideal seria tratar isso no storageService como fizemos antes
        await updateLessonPlan(plan.id, { illustrationImage: img });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateAudio = async (text: string) => {
    if (isAudioLoading || isAudioReady) return;

    setIsAudioLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: plan?.audioConfig?.voiceName || 'Zephyr' 
              } 
            } 
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
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

  // Function to clean "Reading:" and other prefixes from titles aggressively
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

    if (plan.quiz && plan.quiz.length > 0) {
      slides.push({ type: 'quiz', title: "Knowledge Test", content: plan.quiz.slice(0, 5) });
    }

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
      ...(plan.quiz && plan.quiz.length > 0 ? [{ type: 'quiz', title: "Review Quiz", content: plan.quiz }] : [])
    ];
  }

  const renderClickableText = (text: string, vocabWords: string[]) => {
    const clean = (w: string) => w.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").trim();
    const vocabSet = new Set(vocabWords.map(v => clean(v)));
    const paragraphs = text.split(/\n+/);

    return paragraphs.map((para, pIdx) => (
      <p key={pIdx} className="mb-8 last:mb-0">
        {para.split(/(\s+)/).map((part, i) => {
          if (part.trim() === '') return part;
          const isVocab = vocabSet.has(clean(part));
          return (
            <span 
              key={i} 
              onClick={(e) => handleTranslate(part, e)}
              onMouseLeave={() => setTranslation(null)}
              className={`transition-all rounded px-0.5 cursor-pointer inline ${isVocab ? 'text-freedom-orange font-bold border-b-2 border-freedom-orange/20' : 'hover:text-freedom-orange hover:bg-orange-50'}`}
            >
              {part}
            </span>
          );
        })}
      </p>
    ));
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
            <div className="flex-1 max-w-[42%] flex flex-col gap-3">
              <div className="w-full flex-1 min-h-0 rounded-[2.5rem] overflow-hidden shadow-xl border-2 border-white bg-gray-50 relative">
                {dynamicImage ? (
                  <img src={dynamicImage} alt="Context" className="w-full h-full object-cover animate-fadeIn" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-freedom-orange">
                      {isGeneratingImage ? (
                        <div className="w-10 h-10 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      )}
                    </div>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4">
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
              
              <div className="bg-gray-100/50 p-4 rounded-3xl border border-gray-200/50 flex flex-col gap-3 shrink-0 shadow-inner">
                <div className="flex items-center gap-3">
                  {!isAudioReady ? (
                    <button 
                      onClick={() => handleGenerateAudio(text)}
                      disabled={isAudioLoading}
                      className="w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg transition-all active:scale-90 bg-freedom-gray text-white hover:brightness-110"
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
                      className={`w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg transition-all active:scale-90 ${isPlaying ? 'bg-freedom-gray text-white' : 'bg-freedom-orange text-white'}`}
                    >
                      {isPlaying ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                        <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>
                  )}
                  
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[9px] font-black text-gray-500 tabular-nums uppercase tracking-tighter">
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
                      className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-freedom-orange" 
                    />
                  </div>

                  <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100 shrink-0">
                    {[0.75, 1, 1.5].map(r => (
                      <button key={r} onClick={() => setPlaybackRate(r)} className={`px-2.5 py-1 text-[9px] font-black rounded-lg transition-colors ${playbackRate === r ? 'bg-freedom-orange text-white' : 'text-gray-400 hover:text-freedom-gray'}`}>{r}x</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-[1.8] flex flex-col overflow-hidden">
              <div className="mb-4">
                <h2 className="text-3xl lg:text-5xl font-black text-freedom-gray tracking-tighter uppercase leading-none">{slide.title}</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                <div 
                  className="text-freedom-gray leading-relaxed text-justify font-medium"
                  style={{ fontSize: `${fontSize}px`, textJustify: 'inter-word' }}
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
      const questions = slide.content as QuizQuestion[];
      return (
        <div className="w-full h-full flex flex-col overflow-hidden">
           <div className="flex items-center space-x-2 mb-4 shrink-0">
             <div className="bg-freedom-gray text-white px-4 py-1 rounded-full font-black text-[9px] uppercase tracking-widest">Exercise</div>
             <h2 className="text-2xl lg:text-4xl font-black text-freedom-gray uppercase tracking-tighter">Knowledge Lab</h2>
          </div>
          <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-4 pb-4">
            {questions.map((q, qIdx) => {
              const state = quizState[qIdx];
              return (
                <div key={qIdx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                  <h4 className="text-base font-bold text-freedom-gray mb-4">0{qIdx + 1}. {q.question}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = oIdx === q.correctIndex;
                      const isSelected = state?.selected === oIdx;
                      let btnClass = "p-4 rounded-xl border text-left transition-all text-sm font-bold ";
                      if (state?.confirmed) {
                        if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-700";
                        else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-700";
                        else btnClass += "bg-gray-50 opacity-40";
                      } else { btnClass += "bg-gray-50 hover:border-freedom-orange"; }
                      return (
                        <button key={oIdx} onClick={() => { if (!quizState[qIdx]?.confirmed) setQuizState({...quizState, [qIdx]: { selected: oIdx, confirmed: true }}); }} className={btnClass}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (slide.type === 'question-v2') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center relative">
          <div className="mb-10 shrink-0">
             <div className="flex items-center space-x-4">
                <span className="w-12 h-12 bg-freedom-orange text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg border-b-4 border-orange-800 italic">0{slide.index}</span>
                <h3 className="text-xl font-black text-freedom-gray uppercase tracking-[0.2em]">{slide.title}</h3>
             </div>
          </div>
          
          <div className="w-full flex-1 flex flex-col items-center justify-center px-12 text-center overflow-y-auto custom-scrollbar min-h-0">
            <div className="relative p-10 bg-white/40 backdrop-blur-md rounded-[4rem] border-2 border-white shadow-xl max-w-5xl">
              <svg className="absolute -top-6 -left-6 w-16 h-16 text-freedom-orange/20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 15.1046 21.017 14V11C21.017 9.89543 20.1216 9 19.017 9H16.017C14.9124 9 14.017 8.10457 14.017 7V4H21.017V9L21.017 14L21.017 21H14.017ZM3.017 21L3.017 18C3.017 16.8954 3.91243 16 5.017 16H8.017C9.12157 16 10.017 15.1046 10.017 14V11C10.017 9.89543 9.12157 9 8.017 9H5.017C3.91243 9 3.017 8.10457 3.017 7V4H10.017V9L10.017 14L10.017 21H3.017Z" />
              </svg>
              <h2 className="text-freedom-gray font-black tracking-tighter uppercase leading-[1.1] drop-shadow-sm" style={{ fontSize: `${fontSize * 1.5}px` }}>
                {slide.content}
              </h2>
            </div>
          </div>

          <div className="mt-12 shrink-0 w-full animate-fadeIn text-center">
            <button onClick={() => setShowBackground(!showBackground)} className="bg-freedom-gray text-white px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl border-b-4 border-black transition-all active:translate-y-1 active:border-b-0">
              {showBackground ? "Hide Support Questions" : "Teacher's Support Mode"}
            </button>
            {showBackground && (
              <div className="mt-6 flex flex-wrap justify-center gap-4 max-w-6xl mx-auto px-10 overflow-y-auto max-h-[25vh] pb-6 custom-scrollbar">
                {slide.backgroundQuestions && slide.backgroundQuestions.map((bq: string, bi: number) => (
                  <div key={bi} className="bg-white/90 backdrop-blur p-5 rounded-[2rem] border-t-8 border-freedom-orange shadow-2xl text-sm font-bold text-freedom-gray italic max-w-xs flex-1 min-w-[280px] flex items-center justify-center">
                    <span className="text-freedom-orange mr-2 font-black">#0{bi+1}</span> "{bq}"
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    const contentText = slide.content || slide.subtitle || "";
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
        {slide.title && (
          <div className="mb-6 shrink-0">
             <h1 className="text-xs font-black text-white bg-freedom-gray px-8 py-2 rounded-full tracking-[0.2em] uppercase border-b-2 border-freedom-orange shadow-lg">
              {slide.title}
            </h1>
          </div>
        )}
        <div className="w-full flex-1 flex items-center justify-center min-h-0 px-10 overflow-y-auto custom-scrollbar">
          <div 
            className="text-freedom-gray leading-tight font-black text-center drop-shadow-sm tracking-tight uppercase"
            style={{ fontSize: `${fontSize}px` }}
          >
            {contentText}
          </div>
        </div>
        {slide.backgroundQuestions && slide.backgroundQuestions.length > 0 && (
          <div className="mt-6 shrink-0 w-full animate-fadeIn text-center">
            <button onClick={() => setShowBackground(!showBackground)} className="bg-freedom-orange text-white px-8 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg border-b-2 border-orange-800 transition-all active:translate-y-0.5">
              {showBackground ? "Hide Hints" : "Teacher's Guide"}
            </button>
            {showBackground && (
              <div className="mt-4 flex flex-wrap justify-center gap-3 max-w-5xl mx-auto px-6 overflow-y-auto max-h-[15vh] pb-4 custom-scrollbar">
                {slide.backgroundQuestions.map((bq: string, bi: number) => (
                  <div key={bi} className="bg-white p-4 rounded-[1.5rem] border-t-4 border-freedom-orange shadow-lg text-xs font-bold text-freedom-gray italic max-w-sm">
                    "{bq}"
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const next = () => { 
    setShowBackground(false); 
    setIsAudioReady(false);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (currentSlide < slides.length - 1) setCurrentSlide(c => c + 1); 
  };
  
  const prev = () => { 
    setShowBackground(false); 
    setIsAudioReady(false);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (currentSlide > 0) setCurrentSlide(c => c - 1); 
  };

  const getSlideTheme = (idx: number) => {
    const themes = ['bg-white border-freedom-orange', 'bg-gray-50 border-freedom-gray', 'bg-orange-50 border-freedom-orange', 'bg-white border-freedom-gray'];
    return themes[idx % themes.length];
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50 overflow-hidden select-none">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f7931e; border-radius: 10px; } 
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
      
      <div className="flex justify-between items-center py-1.5 px-6 bg-black border-b border-white/5 z-30">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 bg-freedom-orange rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-xl italic leading-none">F</span>
          </div>
          <h2 className="text-white font-black text-sm tracking-tighter uppercase">
            FREEDOM<span className="text-freedom-orange">ACADEMY</span>
          </h2>
        </div>
        <button onClick={() => navigate('/')} className="text-white/40 font-black border border-white/10 px-4 py-1 rounded-lg hover:bg-white hover:text-black transition-all uppercase text-[8px] tracking-widest">
          Close Presentation
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-2 lg:p-4 overflow-hidden relative">
        <div className={`w-[98vw] h-[92vh] rounded-[3rem] shadow-2xl p-6 lg:p-12 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-700 border-b-[12px] ${getSlideTheme(currentSlide)}`}>
          <div className="w-full h-full overflow-hidden">
            {renderContent(slides[currentSlide])}
          </div>
          
          <div className="absolute top-6 right-6 z-[60] group">
            <div className="bg-freedom-gray/10 backdrop-blur-sm p-1.5 rounded-2xl border border-white/10 flex flex-col space-y-1.5 opacity-10 group-hover:opacity-100 transition-all hover:bg-freedom-gray/90">
              <button onClick={() => setFontSize(prev => Math.min(prev + 2, 160))} className="w-8 h-8 rounded-lg bg-freedom-orange text-white flex items-center justify-center text-xl font-black shadow-lg">+</button>
              <button onClick={() => setFontSize(prev => Math.max(prev - 2, 16))} className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center text-xl font-black shadow-lg">×</button>
            </div>
          </div>
        </div>
      </div>

      <div className="py-2 px-8 flex items-center justify-between bg-black z-30 border-t border-white/5">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <span className="text-white font-black text-xl tabular-nums leading-none">{String(currentSlide + 1).padStart(2, '0')}</span>
            <div className="flex space-x-1.5 px-2">
              {slides.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-8 bg-freedom-orange shadow-[0_0_10px_rgba(247,147,30,0.4)]' : 'w-1.5 bg-white/10'}`} />
              ))}
            </div>
            <span className="text-white/20 font-black text-xl tabular-nums leading-none">{String(slides.length).padStart(2, '0')}</span>
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