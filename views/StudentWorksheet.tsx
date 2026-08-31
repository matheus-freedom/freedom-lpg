import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LessonPlan, VocabEntry } from '../types';
import { getPlanById, updateLessonPlan } from '../services/storageService';
import { translateVocabList } from '../services/geminiService';

// ============================================================
// STUDENT WORKSHEET - versao para impressao/PDF da aula,
// SEM as instrucoes do professor. Tres paginas:
//   1) Cabecalho da aula + imagem + texto + Vocab List traduzida
//   2) Quiz de multipla escolha (gabarito em fonte pequena no fim)
//   3) As 10 perguntas de conversacao + homework
//
// Como funciona o "download": o botao chama window.print() e o
// professor escolhe "Salvar como PDF" - o mesmo mecanismo do
// botao ja existente, mas aqui com um layout desenhado pagina
// por pagina para o aluno.
// ============================================================

// Extrai texto e vocabulario do studentContent.
// O Quick Lesson embute a lista de vocabulario no final do texto,
// depois do marcador ||VOCAB|| (mesma logica do ClassroomView).
const parseReading = (raw: string): { text: string; vocabWords: string[] } => {
  const content = (raw || '')
    .replace(/\\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  let text = content;
  let vocabWords: string[] = [];

  if (content.includes('||VOCAB||')) {
    const [textPart, vocabPart] = content.split('||VOCAB||');
    text = (textPart || '').trim();
    vocabWords = (vocabPart || '')
      .split('\n')
      .map(line => {
        // Aceita formatos como "1. word", "word - def", "word: def"
        const first = line.split(/[-:]/)[0] || '';
        return first.replace(/^\d+[.)]\s*/, '').replace(/[*_]/g, '').trim();
      })
      .filter(w => w.length > 0);
  }

  return { text, vocabWords };
};

// Renderiza texto com os destaques **palavra** em negrito laranja.
const renderRichText = (text: string) => {
  const clean = (text || '').replace(/^#+\s*/gm, '');
  return clean.split(/\n+/).map((para, pIdx) => (
    <p key={pIdx} className="mb-4 last:mb-0">
      {para.split(/(\*\*.*?\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="text-freedom-orange font-bold">{part.slice(2, -2)}</strong>
          : part
      )}
    </p>
  ));
};

const StudentWorksheet: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [vocabStatus, setVocabStatus] = useState<'idle' | 'translating' | 'ready' | 'failed'>('idle');

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const found = await getPlanById(id);
      setPlan(found);
      setLoading(false);

      if (!found) return;

      // Traducoes do vocabulario:
      // 1o acesso: pede ao Gemini (uma chamada para a lista toda) e
      // SALVA no plano. Acessos seguintes: usa o que ja esta salvo -
      // instantaneo e sem custo de IA.
      if (found.vocabTranslations && found.vocabTranslations.length > 0) {
        setVocab(found.vocabTranslations);
        setVocabStatus('ready');
        return;
      }

      const { vocabWords } = parseReading(found.sections?.[0]?.studentContent || '');
      if (vocabWords.length === 0) {
        setVocabStatus('ready'); // aula sem lista de vocabulario - segue sem essa secao
        return;
      }

      setVocabStatus('translating');
      const translated = await translateVocabList(vocabWords.slice(0, 20));
      if (translated.length > 0) {
        setVocab(translated);
        setVocabStatus('ready');
        // Cache no Firestore (se falhar, a proxima visita traduz de novo).
        updateLessonPlan(found.id, { vocabTranslations: translated }).catch(() => {});
      } else {
        // Sem traducao, ainda mostramos as palavras com linha para
        // o aluno completar em aula - o worksheet continua utilizavel.
        setVocab(vocabWords.map(w => ({ word: w, translations: [] })));
        setVocabStatus('failed');
      }
    };
    load();
  }, [id]);

  // Nome do arquivo ao salvar como PDF = titulo do documento.
  useEffect(() => {
    if (plan) {
      const original = document.title;
      document.title = `${plan.title} - Student Worksheet`;
      return () => { document.title = original; };
    }
  }, [plan]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-12 h-12 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!plan) return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold text-gray-400 uppercase">Plan not found</h2>
      <button onClick={() => navigate('/history')} className="mt-4 text-freedom-orange font-bold hover:underline">Return to Library</button>
    </div>
  );

  const { text: readingText } = parseReading(plan.sections?.[0]?.studentContent || '');
  const conversationSections = (plan.sections || [])
    .slice(1, 11)
    .filter(s => s.studentContent && s.studentContent.trim().length > 0);
  const quiz = plan.quiz || [];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="bg-gray-200 min-h-screen py-8 print:py-0 print:bg-white">
      <style>{`
        @page { size: A4; margin: 13mm 14mm; }
        @media print {
          .ws-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; width: auto !important; min-height: 0 !important; padding: 0 !important; }
          .ws-break { page-break-after: always; }
        }
        @media screen {
          .ws-page { width: 210mm; min-height: 297mm; padding: 14mm; }
        }
      `}</style>

      {/* Barra de controle (some na impressao) */}
      <div className="print:hidden max-w-[210mm] mx-auto mb-6 flex flex-wrap items-center gap-4 px-4">
        <button onClick={() => navigate(`/lesson/${plan.id}`)} className="bg-white border border-gray-300 text-freedom-gray px-5 py-2 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all">
          Back to Lesson
        </button>
        <button
          onClick={() => window.print()}
          disabled={vocabStatus === 'translating'}
          className="bg-freedom-orange text-white px-8 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait"
        >
          {vocabStatus === 'translating' ? 'Preparing vocab...' : 'Download PDF'}
        </button>
        {vocabStatus === 'translating' && (
          <span className="text-xs font-bold text-gray-500">Fred is translating the vocab list - just a moment...</span>
        )}
        {vocabStatus === 'failed' && (
          <span className="text-xs font-bold text-red-500">Translation unavailable - the worksheet will have blank lines for students to fill in.</span>
        )}
      </div>

      {/* PAGE 1 - Lesson info + Reading + Vocab List */}
      <div className="ws-page ws-break bg-white mx-auto shadow-xl rounded-lg mb-8 flex flex-col">
        <div className="border-b-4 border-freedom-orange pb-4 mb-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-freedom-orange mb-1">Freedom LPG - Student Worksheet</p>
              <h1 className="text-2xl font-black text-freedom-gray uppercase tracking-tight leading-tight">{plan.title}</h1>
            </div>
            <div className="bg-freedom-gray text-white px-4 py-1.5 rounded-full font-black text-xs shrink-0 ml-4">{plan.level}</div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-1 mt-3 text-[11px] font-bold text-gray-600">
            <span><span className="text-gray-400 uppercase text-[9px] tracking-widest mr-1.5">Level:</span>{plan.level}</span>
            <span><span className="text-gray-400 uppercase text-[9px] tracking-widest mr-1.5">Grammar:</span>{plan.grammarTopic}</span>
            <span><span className="text-gray-400 uppercase text-[9px] tracking-widest mr-1.5">Vocabulary Focus:</span>{plan.vocabularyFocus}</span>
          </div>
          <div className="flex gap-8 mt-3 text-[10px] font-bold text-gray-500">
            <span>Name: ______________________________</span>
            <span>Date: ____ / ____ / ______</span>
          </div>
        </div>

        <div className="flex gap-5 mb-5">
          {plan.illustrationImage && (
            <img
              src={plan.illustrationImage}
              alt="Lesson illustration"
              className="w-[62mm] rounded-2xl object-cover self-start border border-gray-200"
            />
          )}
          <div className="flex-1 text-[12.5px] leading-relaxed text-freedom-gray text-justify">
            {renderRichText(readingText)}
          </div>
        </div>

        {vocab.length > 0 && (
          <div className="mt-auto">
            <h2 className="text-sm font-black text-freedom-gray uppercase tracking-widest border-b-2 border-gray-200 pb-1.5 mb-3">
              Vocab List
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              {vocab.map((v, i) => (
                <div key={i} className="flex items-baseline text-[11px] border-b border-dotted border-gray-300 pb-1">
                  <span className="font-black text-freedom-orange mr-2">{v.word}</span>
                  <span className="text-gray-600 font-medium">
                    {v.translations.length > 0 ? v.translations.join(' / ') : '________________'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PAGE 2 - Quiz + small answer key */}
      {quiz.length > 0 && (
        <div className="ws-page ws-break bg-white mx-auto shadow-xl rounded-lg mb-8 flex flex-col">
          <div className="border-b-4 border-freedom-orange pb-3 mb-5 flex justify-between items-end">
            <h2 className="text-xl font-black text-freedom-gray uppercase tracking-tight">Quiz</h2>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400">{plan.title} - {plan.level}</p>
          </div>

          <div className="space-y-4 flex-1">
            {quiz.map((q, qIdx) => (
              <div key={qIdx}>
                <p className="text-[12px] font-bold text-freedom-gray mb-1.5">{qIdx + 1}. {q.question}</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-4">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-baseline text-[11px] text-gray-700">
                      <span className="inline-block w-4 h-4 rounded-full border border-gray-400 mr-2 shrink-0 self-center"></span>
                      <span className="font-bold mr-1.5">{letters[oIdx]})</span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Gabarito em fonte bem pequena, no rodape da pagina */}
          <div className="mt-6 pt-2 border-t border-gray-200">
            <p className="text-[6px] text-gray-400 leading-none">
              Answer key: {quiz.map((q, i) => `${i + 1}-${letters[q.correctIndex] || '?'}`).join('   ')}
            </p>
          </div>
        </div>
      )}

      {/* PAGE 3 - Conversation + Homework */}
      <div className="ws-page bg-white mx-auto shadow-xl rounded-lg flex flex-col">
        <div className="border-b-4 border-freedom-orange pb-3 mb-5 flex justify-between items-end">
          <h2 className="text-xl font-black text-freedom-gray uppercase tracking-tight">Conversation</h2>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400">{plan.title} - {plan.level}</p>
        </div>

        <div className="space-y-2.5 flex-1">
          {conversationSections.map((sec, idx) => (
            <div key={idx} className="flex items-start text-[11.5px] text-freedom-gray">
              <span className="w-6 h-6 bg-freedom-orange text-white rounded-lg flex items-center justify-center font-black text-[10px] mr-3 shrink-0">
                {idx + 1}
              </span>
              <p className="font-medium leading-snug pt-0.5">{(sec.studentContent || '').replace(/\*\*/g, '')}</p>
            </div>
          ))}
          {conversationSections.length === 0 && (
            <p className="text-gray-400 italic text-sm">This lesson has no conversation questions.</p>
          )}
        </div>

        {plan.homework && (
          <div className="mt-6 bg-orange-50 border-l-4 border-freedom-orange rounded-xl p-4">
            <h3 className="text-[10px] font-black text-freedom-orange uppercase tracking-[0.25em] mb-1.5">Homework</h3>
            <p className="text-[11.5px] text-freedom-gray leading-relaxed">{plan.homework.replace(/\*\*/g, '')}</p>
          </div>
        )}

        <p className="text-center text-[8px] font-black uppercase tracking-[0.3em] text-gray-300 mt-5">
          Freedom Language Center - Conversation First
        </p>
      </div>
    </div>
  );
};

export default StudentWorksheet;
