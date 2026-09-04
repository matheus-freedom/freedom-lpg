import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FredGuide from '../components/FredGuide';
import GrammarTopicSelect from '../components/GrammarTopicSelect';
import { generateQuickLessonPlan, generateLessonImage } from '../services/geminiService';
import { saveLessonPlanSafely } from '../services/storageService';
import { CEFRLevel, StudentCount, AudioConfig, User } from '../types';
import { GRAMMAR_CURRICULUM, CUSTOM_GRAMMAR_TOPIC } from '../data/grammarCurriculum';

// ─── Tipos ────────────────────────────────────────────────────────────────
type TextType = 'narrative' | 'descriptive' | 'argumentative' | 'expository' | 'procedural' | 'comparative' | 'custom';
type ImageStyle = 'realistic' | 'cinematic' | 'cartoon' | 'minimalist' | 'vintage' | 'watercolor' | 'custom';
type QuizFocus = 'vocabulary' | 'grammar' | 'comprehension' | 'inference' | 'mixed';
type ConversationApproach = 'debate' | 'roleplay' | 'opinion' | 'problem-solving' | 'storytelling' | 'interview' | 'custom';
type Difficulty = 'easy' | 'standard' | 'challenging' | 'mixed';

// ─── Opções ───────────────────────────────────────────────────────────────
const TEXT_TYPE_OPTIONS: { id: TextType; label: string; desc: string; icon: string }[] = [
  { id: 'narrative',     label: 'Narrative',     desc: 'Story-based text',       icon: '📖' },
  { id: 'descriptive',   label: 'Descriptive',   desc: 'Vivid descriptions',     icon: '🎨' },
  { id: 'argumentative', label: 'Argumentative', desc: 'Opinion & debate text',  icon: '⚖️' },
  { id: 'expository',    label: 'Expository',    desc: 'Facts & explanation',    icon: '📚' },
  { id: 'procedural',    label: 'Procedural',    desc: 'Step-by-step guide',     icon: '📋' },
  { id: 'comparative',   label: 'Comparative',   desc: 'Compare & contrast',     icon: '🔄' },
  { id: 'custom',        label: 'Custom',        desc: 'Describe your own type', icon: '✍️' },
];

const IMAGE_STYLE_OPTIONS: { id: ImageStyle; label: string; icon: string }[] = [
  { id: 'realistic',  label: 'Realistic',  icon: '📷' },
  { id: 'cinematic',  label: 'Cinematic',  icon: '🎬' },
  { id: 'cartoon',    label: 'Cartoon',    icon: '✏️' },
  { id: 'minimalist', label: 'Minimalist', icon: '◻️' },
  { id: 'vintage',    label: 'Vintage',    icon: '🕰️' },
  { id: 'watercolor', label: 'Watercolor', icon: '🖌️' },
  { id: 'custom',     label: 'Custom',     icon: '🎭' },
];

const QUIZ_FOCUS_OPTIONS: { id: QuizFocus; label: string; desc: string }[] = [
  { id: 'vocabulary',    label: 'Vocabulary',    desc: 'Word meaning & usage' },
  { id: 'grammar',       label: 'Grammar',       desc: 'Structural patterns' },
  { id: 'comprehension', label: 'Comprehension', desc: 'Text understanding' },
  { id: 'inference',     label: 'Inference',     desc: 'Reading between lines' },
  { id: 'mixed',         label: 'Mixed',         desc: 'All of the above' },
];

const CONVERSATION_OPTIONS: { id: ConversationApproach; label: string; icon: string; desc: string }[] = [
  { id: 'debate',          label: 'Debate',          icon: '🗣️', desc: 'Structured arguments' },
  { id: 'roleplay',        label: 'Role-play',       icon: '🎭', desc: 'Simulate real situations' },
  { id: 'opinion',         label: 'Opinion',         icon: '💬', desc: 'Express personal views' },
  { id: 'problem-solving', label: 'Problem Solving', icon: '🧩', desc: 'Find solutions together' },
  { id: 'storytelling',    label: 'Storytelling',    icon: '📝', desc: 'Create narratives' },
  { id: 'interview',       label: 'Interview',       icon: '🎙️', desc: 'Q&A format' },
  { id: 'custom',          label: 'Custom',          icon: '✍️', desc: 'Describe your own style' },
];

// ─── Componente Section colapsável ────────────────────────────────────────
const Section: React.FC<{
  title: string; icon: string; badge?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}> = ({ title, icon, badge, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-black text-freedom-gray text-sm uppercase tracking-wider">{title}</span>
          {badge && <span className="bg-freedom-orange text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">{badge}</span>}
        </div>
        <span className={`text-freedom-orange font-black transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="p-4 space-y-4 animate-fadeIn">{children}</div>}
    </div>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────
const QuickLessonGenerator: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading]             = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Fred is starting...');
  const [currentUser, setCurrentUser]     = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('freedom_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  // ── Form base — sem pré-seleção ───────────────────────────────
  const [level, setLevel]                           = useState<CEFRLevel | null>(null);
  const [studentCount, setStudentCount]             = useState<StudentCount | null>(null);
  const [vocabularyFocus, setVocabularyFocus]       = useState('');

  // ── Gramática: dropdown filtrado pelo nível + opção custom ─────
  // `grammarSelection` guarda o que está marcado no dropdown (um tema da
  // sequência, CUSTOM_GRAMMAR_TOPIC ou '' quando vazio). O texto livre fica
  // em `customGrammarTopic`. O valor final enviado ao Gemini é derivado dos
  // dois em `grammarTopic`, logo abaixo — assim o resto do código não muda.
  const [grammarSelection, setGrammarSelection]     = useState('');
  const [customGrammarTopic, setCustomGrammarTopic] = useState('');
  const grammarTopic = grammarSelection === CUSTOM_GRAMMAR_TOPIC
    ? customGrammarTopic.trim()
    : grammarSelection;

  // Ao trocar de nível, a lista de temas muda. Um tema da sequência do A2 não
  // existe no B1, então limpamos a seleção para o professor escolher de novo.
  // A opção custom é independente de nível, por isso é preservada.
  const handleLevelChange = (newLevel: CEFRLevel) => {
    setLevel(newLevel);
    if (grammarSelection && grammarSelection !== CUSTOM_GRAMMAR_TOPIC
        && !GRAMMAR_CURRICULUM[newLevel].includes(grammarSelection)) {
      setGrammarSelection('');
    }
  };

  // ── Texto ─────────────────────────────────────────────────────
  const [textType, setTextType]                     = useState<TextType | null>(null);
  const [customTextType, setCustomTextType]         = useState('');
  const [paragraphCount, setParagraphCount]         = useState<number | null>(null);

  // ── Imagem ────────────────────────────────────────────────────
  const [imageStyle, setImageStyle]                 = useState<ImageStyle | null>(null);
  const [customImageStyle, setCustomImageStyle]     = useState('');

  // ── Quiz ──────────────────────────────────────────────────────
  const [quizQuestionCount, setQuizQuestionCount]   = useState<number>(5);
  const [quizFocuses, setQuizFocuses]               = useState<QuizFocus[]>([]);

  // ── Conversação ───────────────────────────────────────────────
  const [conversationApproaches, setConversationApproaches] = useState<ConversationApproach[]>([]);
  const [customConversation, setCustomConversation]         = useState('');
  const [extraInfo, setExtraInfo]                           = useState('');

  // ── Dificuldade ───────────────────────────────────────────────
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  // ── Áudio ─────────────────────────────────────────────────────
  type AudioAccent = 'american' | 'british' | 'spanish' | 'italian' | 'french' | 'german' | 'indian' | 'chinese';

  const ACCENT_OPTIONS: { id: AudioAccent; flag: string; label: string; instruction: string }[] = [
    { id: 'american', flag: '🇺🇸', label: 'American', instruction: '' },
    { id: 'british',  flag: '🇬🇧', label: 'British',  instruction: 'with a British RP accent' },
    { id: 'spanish',  flag: '🇪🇸', label: 'Spanish',  instruction: 'with a Spanish accent, as if the speaker is a native Spanish speaker' },
    { id: 'italian',  flag: '🇮🇹', label: 'Italian',  instruction: 'with an Italian accent, as if the speaker is a native Italian speaker' },
    { id: 'french',   flag: '🇫🇷', label: 'French',   instruction: 'with a French accent, as if the speaker is a native French speaker' },
    { id: 'german',   flag: '🇩🇪', label: 'German',   instruction: 'with a German accent, as if the speaker is a native German speaker' },
    { id: 'indian',   flag: '🇮🇳', label: 'Indian',   instruction: 'with an Indian English accent' },
    { id: 'chinese',  flag: '🇨🇳', label: 'Chinese',  instruction: 'with a Chinese accent, as if the speaker is a native Mandarin speaker' },
  ];

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioGender, setAudioGender]   = useState<'female' | 'male'>('female');
  const [audioAccent, setAudioAccent]   = useState<AudioAccent>('american');

  const getVoiceName = (gender: 'male' | 'female', accent: AudioAccent): string => {
    if (gender === 'female' && accent === 'american') return 'Zephyr';
    if (gender === 'female' && accent === 'british')  return 'Aoede';
    if (gender === 'male'   && accent === 'american') return 'Puck';
    if (gender === 'male'   && accent === 'british')  return 'Fenrir';
    return gender === 'female' ? 'Zephyr' : 'Puck';
  };

  const getAccentInstruction = (accent: AudioAccent): string =>
    ACCENT_OPTIONS.find(a => a.id === accent)?.instruction || '';

  const toggleQuizFocus = (id: QuizFocus) => {
    setQuizFocuses(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const toggleConversation = (id: ConversationApproach) => {
    setConversationApproaches(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  // ── Monta prompt enriquecido com todas as customizações ───────
  const buildEnrichedPrompt = (): string => {
    const parts: string[] = [];

    const resolvedTextType = textType === 'custom' ? customTextType : textType;
    if (resolvedTextType) parts.push(`TEXT TYPE: Write a ${resolvedTextType} text.`);

    if (paragraphCount) parts.push(`PARAGRAPHS: The reading text must have exactly ${paragraphCount} paragraph(s).`);

    const resolvedImageStyle = imageStyle === 'custom' ? customImageStyle : imageStyle;
    if (resolvedImageStyle) parts.push(`IMAGE STYLE: The visualPrompt should describe a ${resolvedImageStyle} style image.`);

    parts.push(`QUIZ: Generate exactly ${quizQuestionCount} quiz questions.`);
    if (quizFocuses.length > 0) parts.push(`QUIZ FOCUS: Distribute questions across these areas: ${quizFocuses.join(', ')}.`);

    const resolvedConversations = conversationApproaches
      .map(a => a === 'custom' ? customConversation : a)
      .filter(Boolean);
    if (resolvedConversations.length > 0) {
      parts.push(`CONVERSATION APPROACH: The 10 conversation questions should blend these approaches: ${resolvedConversations.join(', ')}.`);
    }

    if (difficulty) parts.push(`DIFFICULTY: The lesson difficulty should be ${difficulty} for a ${level} student.`);

    if (extraInfo.trim()) parts.push(`EXTRA CONTEXT: ${extraInfo.trim()}`);

    return parts.join('\n');
  };

  const canGenerate = !!level && !!studentCount && !!grammarTopic.trim() && !!vocabularyFocus.trim();

  // ── GERAÇÃO com onProgress para feedback em tempo real ───────
  const handleGenerate = async () => {
    if (!canGenerate) return;

    setLoading(true);
    try {
      const voiceName         = getVoiceName(audioGender, audioAccent);
      const accentInstruction = getAccentInstruction(audioAccent);
      const audioConfig: AudioConfig | undefined = audioEnabled
        ? { enabled: true, gender: audioGender, accent: audioAccent, voiceName, accentInstruction }
        : undefined;

      // Gera o plano com callback de progresso em tempo real
      const plan = await generateQuickLessonPlan(
        {
          level: level!,
          studentCount: studentCount!,
          grammarTopic,
          vocabularyFocus,
          extraInfo: buildEnrichedPrompt(),
        },
        (msg) => setLoadingStatus(msg)   // ← onProgress: atualiza status na tela
      );

      // Gera a imagem com callback de progresso
      const resolvedImageStyle = imageStyle === 'custom' ? customImageStyle : imageStyle;
      const imagePrompt = plan.visualPrompt || `${vocabularyFocus} ${resolvedImageStyle || 'realistic'} style`;
      const image = await generateLessonImage(
        imagePrompt,
        (msg) => setLoadingStatus(msg)  // ← onProgress
      );

      const finalPlan = {
        ...plan,
        illustrationImage: image,
        authorName: currentUser?.name || 'Freedom Teacher',
        audioConfig,
      };

      setLoadingStatus('Syncing with Freedom Cloud...');
      const success = await saveLessonPlanSafely(finalPlan);
      if (success) navigate(`/lesson/${finalPlan.id}`);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      alert(`Fred encontrou um problema: ${msg}\n\nTente novamente.`);
    } finally {
      setLoading(false);
      setLoadingStatus('Fred is starting...');
    }
  };

  const levels: CEFRLevel[]    = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const counts: StudentCount[] = [1, 2, 3, 4, 5];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <FredGuide message="Power lesson mode! Choose your level and students first — nothing is pre-selected so you always make a conscious choice. Then customize everything below!" />

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

        {/* CABEÇALHO */}
        <div className="bg-freedom-gray p-6">
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
            ⚡ Quick <span className="text-freedom-orange">Lesson</span>
          </h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">
            Reading · Quiz · 10 Conversation Points
          </p>
        </div>

        <div className="p-6 space-y-5">

          {/* ── SEÇÃO 1: CLASS SETUP ──────────────────────────────────── */}
          <Section title="Class Setup" icon="🎯" defaultOpen={true}>
            <div>
              <label className="block text-freedom-gray font-black mb-2 uppercase text-[10px] tracking-widest">
                CEFR Level {!level && <span className="text-red-400 ml-1">← Choose one</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {levels.map(l => (
                  <button key={l} type="button" onClick={() => handleLevelChange(l)}
                    className={`flex-1 min-w-[48px] py-2.5 rounded-xl font-black text-sm transition-all ${
                      level === l
                        ? 'bg-freedom-orange text-white shadow-lg shadow-orange-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >{l}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-freedom-gray font-black mb-2 uppercase text-[10px] tracking-widest">
                Students {!studentCount && <span className="text-red-400 ml-1">← Choose one</span>}
              </label>
              <div className="flex gap-1.5">
                {counts.map(c => (
                  <button key={c} type="button" onClick={() => setStudentCount(c)}
                    className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${
                      studentCount === c
                        ? 'bg-freedom-orange text-white shadow-lg shadow-orange-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >{c}</button>
                ))}
              </div>
            </div>

            <GrammarTopicSelect
              level={level}
              selection={grammarSelection}
              onSelectionChange={setGrammarSelection}
              customValue={customGrammarTopic}
              onCustomChange={setCustomGrammarTopic}
            />

            <div>
              <label className="block text-freedom-gray font-black mb-2 uppercase text-[10px] tracking-widest">
                Vocabulary Focus <span className="text-red-400">*</span>
              </label>
              <input type="text"
                placeholder="Ex: Kitchen, Business, Travel, Technology..."
                className="w-full p-3.5 border-2 border-gray-200 rounded-xl focus:border-freedom-orange outline-none font-medium text-sm transition-all"
                value={vocabularyFocus}
                onChange={e => setVocabularyFocus(e.target.value)}
              />
            </div>
          </Section>

          {/* ── SEÇÃO 2: READING TEXT ─────────────────────────────────── */}
          <Section title="Reading Text" icon="📖" badge="NEW">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Text Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TEXT_TYPE_OPTIONS.map(opt => (
                  <button key={opt.id} type="button" onClick={() => setTextType(opt.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      textType === opt.id
                        ? 'border-freedom-orange bg-orange-50'
                        : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-lg mb-1">{opt.icon}</div>
                    <div className="font-black text-[11px] text-freedom-gray leading-tight">{opt.label}</div>
                    <div className="text-[9px] text-gray-400 font-bold leading-tight mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
              {textType === 'custom' && (
                <textarea
                  placeholder="Describe exactly how you want the text to be written. Ex: A formal academic text with technical vocabulary about space exploration, written in third person..."
                  className="w-full mt-3 p-3.5 border-2 border-freedom-orange rounded-xl focus:outline-none font-medium text-sm h-20 resize-none animate-fadeIn"
                  value={customTextType}
                  onChange={e => setCustomTextType(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Number of Paragraphs
                {paragraphCount
                  ? <span className="ml-2 text-freedom-orange font-black">{paragraphCount}</span>
                  : <span className="ml-2 text-gray-400">(not specified)</span>
                }
              </label>
              <div className="flex gap-2 flex-wrap">
                {[null, 1, 2, 3, 4].map(n => (
                  <button key={n ?? 'none'} type="button"
                    onClick={() => setParagraphCount(n)}
                    className={`px-5 py-2 rounded-xl font-black text-sm transition-all ${
                      paragraphCount === n
                        ? 'bg-freedom-orange text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {n === null ? 'Any' : n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Difficulty Level</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'easy',        label: '🟢 Easy',        color: 'bg-green-500' },
                  { id: 'standard',    label: '🟡 Standard',    color: 'bg-yellow-500' },
                  { id: 'challenging', label: '🔴 Challenging',  color: 'bg-red-500' },
                  { id: 'mixed',       label: '🌈 Mixed',        color: 'bg-freedom-orange' },
                ] as { id: Difficulty; label: string; color: string }[]).map(d => (
                  <button key={d.id} type="button" onClick={() => setDifficulty(d.id)}
                    className={`py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all ${
                      difficulty === d.id
                        ? `${d.color} text-white shadow-md`
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >{d.label}</button>
                ))}
              </div>
            </div>
          </Section>

          {/* ── SEÇÃO 3: LESSON IMAGE ─────────────────────────────────── */}
          <Section title="Lesson Image" icon="🖼️" badge="NEW">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Image Style</label>
              <div className="grid grid-cols-4 gap-2">
                {IMAGE_STYLE_OPTIONS.map(opt => (
                  <button key={opt.id} type="button" onClick={() => setImageStyle(opt.id)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      imageStyle === opt.id
                        ? 'border-freedom-orange bg-orange-50'
                        : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <div className="font-black text-[10px] text-freedom-gray leading-tight">{opt.label}</div>
                  </button>
                ))}
              </div>
              {imageStyle === 'custom' && (
                <textarea
                  placeholder="Describe the image style you want. Ex: A dark dramatic oil painting style with warm lighting, like a Dutch golden age masterpiece..."
                  className="w-full mt-3 p-3.5 border-2 border-freedom-orange rounded-xl focus:outline-none font-medium text-sm h-20 resize-none animate-fadeIn"
                  value={customImageStyle}
                  onChange={e => setCustomImageStyle(e.target.value)}
                />
              )}
            </div>
          </Section>

          {/* ── SEÇÃO 4: QUIZ ─────────────────────────────────────────── */}
          <Section title="Quiz Settings" icon="🧠" badge="NEW">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Number of Questions: <span className="text-freedom-orange">{quizQuestionCount}</span>
              </label>
              <input type="range" min={3} max={10} value={quizQuestionCount}
                onChange={e => setQuizQuestionCount(parseInt(e.target.value))}
                className="w-full accent-freedom-orange"
              />
              <div className="flex justify-between text-[9px] text-gray-400 font-bold mt-1">
                <span>3 (quick)</span><span>5 (standard)</span><span>10 (intensive)</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                Quiz Focus <span className="text-gray-300 font-normal">(select one or more)</span>
              </label>
              {quizFocuses.length === 0 && (
                <p className="text-[9px] text-gray-400 italic mb-2">No focus selected — the AI will decide</p>
              )}
              <div className="grid grid-cols-1 gap-2">
                {QUIZ_FOCUS_OPTIONS.map(opt => {
                  const selected = quizFocuses.includes(opt.id);
                  return (
                    <button key={opt.id} type="button" onClick={() => toggleQuizFocus(opt.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        selected ? 'border-freedom-orange bg-orange-50' : 'border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        selected ? 'bg-freedom-orange border-freedom-orange' : 'border-gray-300'
                      }`}>
                        {selected && <span className="text-white text-[10px] font-black">✓</span>}
                      </div>
                      <div>
                        <div className="font-black text-sm text-freedom-gray">{opt.label}</div>
                        <div className="text-[10px] text-gray-400 font-bold">{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* ── SEÇÃO 5: CONVERSATION ─────────────────────────────────── */}
          <Section title="Conversation Approach" icon="💬" badge="NEW">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Approach Style <span className="text-gray-300 font-normal">(select one or more)</span>
            </label>
            {conversationApproaches.length === 0 && (
              <p className="text-[9px] text-gray-400 italic mb-2">No approach selected — the AI will decide</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {CONVERSATION_OPTIONS.map(opt => {
                const selected = conversationApproaches.includes(opt.id);
                return (
                  <button key={opt.id} type="button" onClick={() => toggleConversation(opt.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                      selected ? 'border-freedom-orange bg-orange-50' : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {selected && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-freedom-orange rounded-full flex items-center justify-center">
                        <span className="text-white text-[9px] font-black">✓</span>
                      </div>
                    )}
                    <div className="text-xl mb-1">{opt.icon}</div>
                    <div className="font-black text-[11px] text-freedom-gray">{opt.label}</div>
                    <div className="text-[9px] text-gray-400 font-bold leading-tight">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
            {conversationApproaches.includes('custom') && (
              <textarea
                placeholder="Describe your custom conversation approach. Ex: Each question should be a hypothetical scenario where the student must decide what they would do, justifying their choice using the grammar topic..."
                className="w-full mt-2 p-3.5 border-2 border-freedom-orange rounded-xl focus:outline-none font-medium text-sm h-20 resize-none animate-fadeIn"
                value={customConversation}
                onChange={e => setCustomConversation(e.target.value)}
              />
            )}
          </Section>

          {/* ── SEÇÃO 6: AUDIO ────────────────────────────────────────── */}
          <Section title="Audio Settings" icon="🔊">
            <label className="flex items-center space-x-3 cursor-pointer p-3 bg-orange-50/50 rounded-xl hover:bg-orange-50 transition-colors">
              <input type="checkbox" checked={audioEnabled}
                onChange={e => setAudioEnabled(e.target.checked)}
                className="w-5 h-5 rounded text-freedom-orange focus:ring-freedom-orange"
              />
              <div>
                <span className="font-bold text-freedom-gray text-sm">Add reading audio</span>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Generated by Gemini AI TTS</p>
              </div>
            </label>

            {audioEnabled && (
              <div className="space-y-3 animate-fadeIn">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-gray-400 mb-2">Voice Gender</label>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                      {(['female', 'male'] as const).map(g => (
                        <button key={g} type="button" onClick={() => setAudioGender(g)}
                          className={`flex-1 py-2 text-[10px] font-black rounded-lg uppercase transition-all ${
                            audioGender === g ? 'bg-white text-freedom-orange shadow-sm' : 'text-gray-400'
                          }`}
                        >{g === 'female' ? '👩 Female' : '👨 Male'}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-gray-400 mb-2">English Accent</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ACCENT_OPTIONS.map(a => (
                      <button key={a.id} type="button" onClick={() => setAudioAccent(a.id)}
                        className={`py-2 px-1 rounded-xl text-center transition-all border-2 ${
                          audioAccent === a.id
                            ? 'border-freedom-orange bg-orange-50'
                            : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-lg leading-none">{a.flag}</div>
                        <div className={`text-[9px] font-black mt-1 leading-none ${audioAccent === a.id ? 'text-freedom-orange' : 'text-gray-500'}`}>
                          {a.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Selected Voice</p>
                  <p className="text-sm font-black text-freedom-orange">
                    {getVoiceName(audioGender, audioAccent)}
                    <span className="text-gray-400 font-bold text-[10px] ml-2 uppercase">
                      ({audioGender}, {ACCENT_OPTIONS.find(a => a.id === audioAccent)?.label})
                    </span>
                  </p>
                  {!['american', 'british'].includes(audioAccent) && (
                    <p className="text-[9px] text-gray-400 mt-1 italic">
                      ✓ Accent instruction will be passed to the AI
                    </p>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* ── SEÇÃO 7: EXTRA CONTEXT ────────────────────────────────── */}
          <Section title="Extra Context" icon="✨">
            <textarea
              placeholder="Add specific context, student interests, current events, or special scenarios you want Fred to include..."
              className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-freedom-orange outline-none font-medium text-sm h-24 resize-none transition-all"
              value={extraInfo}
              onChange={e => setExtraInfo(e.target.value)}
            />
          </Section>

          {/* ── RESUMO ────────────────────────────────────────────────── */}
          <div className="bg-freedom-gray/5 border border-gray-200 rounded-2xl p-4">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Your Lesson Summary</p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {[
                { label: 'Level',        value: level || '—',                                                                   warn: !level },
                { label: 'Students',     value: studentCount ? `${studentCount} Student${studentCount > 1 ? 's' : ''}` : '—',  warn: !studentCount },
                { label: 'Grammar',      value: grammarTopic || '—',                                                            warn: !grammarTopic },
                { label: 'Vocabulary',   value: vocabularyFocus.trim() || '—',                                                  warn: !vocabularyFocus.trim() },
                { label: 'Text',         value: textType === 'custom' ? 'Custom' : textType || '—' },
                { label: 'Paragraphs',   value: paragraphCount ? String(paragraphCount) : 'Any' },
                { label: 'Image',        value: imageStyle === 'custom' ? 'Custom' : imageStyle || '—' },
                { label: 'Quiz',         value: `${quizQuestionCount}q · ${quizFocuses.length > 0 ? quizFocuses.join('+') : 'AI decides'}` },
                { label: 'Conversation', value: conversationApproaches.length > 0 ? conversationApproaches.join('+') : 'AI decides' },
                { label: 'Difficulty',   value: difficulty || '—' },
              ].map(item => (
                <div key={item.label}
                  className={`flex justify-between items-center rounded-lg px-3 py-2 border ${
                    item.warn ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
                  }`}
                >
                  <span className="text-gray-400 font-bold">{item.label}</span>
                  <span className={`font-black capitalize truncate max-w-[80px] ${item.warn ? 'text-red-400' : 'text-freedom-orange'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── BOTÃO GERAR ───────────────────────────────────────────── */}
          <button type="button" onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full bg-freedom-orange text-white py-5 rounded-xl font-black text-lg shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed border-b-4 border-orange-800"
          >
            <span>⚡ GENERATE QUICK LESSON</span>
            {!canGenerate && <span className="text-[10px] font-bold opacity-70">Complete required fields</span>}
          </button>

        </div>
      </div>

      {/* ── LOADING com status em tempo real e aviso de paciência ── */}
      {loading && (
        <div className="fixed inset-0 bg-freedom-orange flex flex-col items-center justify-center text-white p-6 text-center z-50">
          <div className="w-24 h-24 border-8 border-white border-t-transparent rounded-full animate-spin mb-8"></div>
          <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">Quick Power Up!</h2>
          <p className="text-xl font-bold opacity-90 mb-3">{loadingStatus}</p>
          <p className="text-sm text-white/70 max-w-sm leading-relaxed">
            Aulas com muitas customizações podem levar até 2 minutos. Fred está trabalhando para garantir a melhor qualidade!
          </p>
        </div>
      )}
    </div>
  );
};

export default QuickLessonGenerator;
