
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FredGuide from '../components/FredGuide';
import { generateLessonPlan, generateLessonImage } from '../services/geminiService';
import { saveLessonPlanSafely } from '../services/storageService';
import { CEFRLevel, StudentCount, Duration, User } from '../types';

const VOCABULARY_BY_LEVEL: Record<CEFRLevel, string[]> = {
  'A1': [
    'Greetings & Farewells', 'Numbers 1-100', 'Colors', 'Days of the week', 'Months & Seasons',
    'Personal Pronouns', 'Family Members', 'Common Objects', 'Basic Adjectives', 'The Alphabet',
    'Animals', 'Rooms of the house', 'Fruits & Vegetables', 'Daily Routines', 'Countries & Nationalities',
    'Jobs & Occupations', 'Telling the time', 'Clothes', 'Body Parts', 'Feelings & Emotions',
    'Prepositions of Place', 'School Subjects', 'Weather', 'Transportation', 'Places in the city',
    'Verbs of Action', 'Kitchenware', 'Hobbies', 'Shapes', 'Question Words'
  ],
  'A2': [
    'Routine Verbs', 'Appearance', 'Ordering Food', 'Past Events', 'Irregular Verbs',
    'Comparative Adjectives', 'Superlative Adjectives', 'Direction Signs', 'Health Problems',
    'Giving Advice', 'Electronic Devices', 'Shopping', 'Future Plans', 'Outdoor Activities',
    'House Chores', 'Quantifiers', 'Sports Equipment', 'Natural Landscapes', 'Frequency Adverbs',
    'Linking Words', 'Simple Phrasal Verbs', 'Travel Documents', 'Airport Vocabulary',
    'Describing Personality', 'Musical Instruments', 'Materials', 'Celebrations', 'Pets Care',
    'Money', 'Common Collocations'
  ],
  'B1': [
    'Education System', 'Workplace Vocabulary', 'Environment', 'Movies & Genres', 'Life Experiences',
    'Modals of Probability', 'Phrasal Verbs (Everyday)', 'Describing Relationships', 'Health & Fitness',
    'Technology Trends', 'Crime & Law', 'Entertainment', 'Opinions & Agreement', 'Travel Problems',
    'Cooking Methods', 'Inventions', 'Character Traits', 'Describing Pictures', 'Prefixed Words',
    'Suffixes', 'Compound Nouns', 'Conditional Situations', 'Social Issues', 'Banking',
    'Driving & Traffic', 'Holidays & Traditions', 'Giving Reasons', 'Art & Literature',
    'Space & Astronomy', 'Emergency Situations'
  ],
  'B2': [
    'Business Negotiations', 'Academic Vocabulary', 'Abstract Nouns', 'Advertising & Marketing',
    'Idiomatic Expressions', 'Advanced Phrasal Verbs', 'Politics', 'Economy', 'Sustainable Development',
    'Psychology', 'Reporting Verbs', 'Body Language', 'Nuance Adverbs', 'Complex Prepositions',
    'News & Media', 'Architecture', 'Energy Sources', 'Career Development', 'Justice System',
    'Scientific Discovery', 'Cultural Diversity', 'Consumerism', 'Ecosystems', 'Debating Phrases',
    'Fashion Industry', 'Internet Security', 'Global Trade', 'Philosophy Basics',
    'Conflict Resolution', 'Urbanization'
  ],
  'C1': [
    'Subtle Synonyms', 'Advanced Idioms', 'Euphemisms', 'Academic Jargon', 'Literary Devices',
    'Complex Phrasal Verbs', 'Legal Terminology', 'Medical Jargon', 'Financial Fluency',
    'Speculative Language', 'Formal vs. Informal shifts', 'Binomial Pairs', 'Collocations with High Precision',
    'Metaphorical Language', 'Historical Contexts', 'Social Commentary', 'Advanced Connectors',
    'Emotional Nuance', 'Rhetorical Questions', 'Institutional Vocabulary', 'Environmental Ethics',
    'Human Rights', 'Technological Ethics', 'Inversion for Emphasis', 'Slang & Colloquialisms',
    'Cleft Sentences', 'Hedging', 'Diplomatic Language', 'Cultural Allusions', 'Archaic Words'
  ]
};

const LessonGenerator: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [customVocab, setCustomVocab] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('freedom_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  const [formData, setFormData] = useState({
    level: 'A1' as CEFRLevel,
    studentCount: 1 as StudentCount,
    duration: '1h' as Duration,
    grammarTopic: '',
    vocabularyFocus: '',
    includeExplanations: true,
    generateImage: true,
    generateText: true,
    generateAudio: false,
    audioVoice: 'female' as 'male' | 'female',
    audioAccent: 'american' as 'american' | 'british' | 'australian' | 'indian',
    includeConversationQuestions: true,
    icebreaker: true,
    closing: true,
    homework: true
  });

  const handleGenerate = async () => {
    if (!formData.grammarTopic || !formData.vocabularyFocus) {
      alert("Fred needs a grammar topic and a vocabulary focus to create the best lesson!");
      return;
    }

    setLoading(true);
    try {
      const plan = await generateLessonPlan({
        ...formData
      } as any);
      
      let image = undefined;
      if (formData.generateImage) {
        // Usa o visualPrompt gerado pela IA de texto
        image = await generateLessonImage(plan.visualPrompt || plan.vocabularyFocus);
      }

      const planWithMultimedia = {
        ...plan,
        illustrationImage: image,
        authorName: currentUser?.name || 'Freedom Teacher'
      };

      const success = saveLessonPlanSafely(planWithMultimedia);
      if (success) {
        navigate(`/lesson/${plan.id}`);
      }
    } catch (error) {
      console.error(error);
      alert("Oops! Fred ran into a small issue. Let's try again!");
    } finally {
      setLoading(false);
    }
  };

  const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const counts: StudentCount[] = [1, 2, 3, 4, 5];
  const durations: Duration[] = ['30 min', '1h', '2h', '3h'];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <FredGuide message="I'm so excited to help you build this lesson! Every great class starts with a great plan. Tell me, what are we teaching today?" />

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <label className="block text-freedom-gray font-bold mb-3">Qual nível da turma?</label>
              <div className="grid grid-cols-5 gap-2">
                {levels.map(l => (
                  <button
                    key={l}
                    onClick={() => {
                      setFormData({...formData, level: l, vocabularyFocus: ''});
                      setCustomVocab(false);
                    }}
                    className={`py-3 rounded-lg font-bold transition-all ${formData.level === l ? 'bg-freedom-orange text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-freedom-gray font-bold mb-3">Quantos alunos?</label>
                <div className="flex justify-between space-x-2">
                  {counts.map(c => (
                    <button
                      key={c}
                      onClick={() => setFormData({...formData, studentCount: c})}
                      className={`flex-1 py-3 rounded-lg font-bold ${formData.studentCount === c ? 'bg-freedom-orange text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-freedom-gray font-bold mb-3">Duração da aula?</label>
                <div className="grid grid-cols-2 gap-2">
                  {durations.map(d => (
                    <button
                      key={d}
                      onClick={() => setFormData({...formData, duration: d})}
                      className={`py-2 text-sm rounded-lg font-bold ${formData.duration === d ? 'bg-freedom-orange text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => setStep(2)} className="w-full bg-freedom-gray text-white py-4 rounded-xl font-title hover:bg-black transition-all">
              Continue to Topics
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <label className="block text-freedom-gray font-bold mb-2">Qual tópico gramatical?</label>
              <input
                type="text"
                placeholder="Ex: Present Continuous, Conditionals..."
                className="w-full p-4 border border-gray-200 rounded-xl focus:border-freedom-orange outline-none"
                value={formData.grammarTopic}
                onChange={e => setFormData({...formData, grammarTopic: e.target.value})}
              />
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-freedom-gray font-bold">Qual vocabulário focar?</label>
                <button 
                  onClick={() => {
                    setCustomVocab(!customVocab);
                    setFormData({...formData, vocabularyFocus: ''});
                  }}
                  className="text-xs text-freedom-orange font-bold uppercase hover:underline"
                >
                  {customVocab ? "Select from list" : "Type custom topic"}
                </button>
              </div>

              {customVocab ? (
                <input
                  type="text"
                  placeholder="Type any vocabulary topic..."
                  className="w-full p-4 border border-gray-200 rounded-xl focus:border-freedom-orange outline-none"
                  value={formData.vocabularyFocus}
                  onChange={e => setFormData({...formData, vocabularyFocus: e.target.value})}
                />
              ) : (
                <div className="max-h-60 overflow-y-auto p-4 border border-gray-100 bg-gray-50 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VOCABULARY_BY_LEVEL[formData.level].map((vocab) => (
                    <button
                      key={vocab}
                      onClick={() => setFormData({...formData, vocabularyFocus: vocab})}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                        formData.vocabularyFocus === vocab 
                        ? 'bg-freedom-orange text-white border-freedom-orange shadow-md' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-freedom-orange'
                      }`}
                    >
                      {vocab}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <label className="flex items-center p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={formData.includeExplanations}
                  onChange={(e) => setFormData({...formData, includeExplanations: e.target.checked})}
                  className="w-5 h-5 text-freedom-orange border-gray-300 rounded focus:ring-freedom-orange"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">Breve explicação + Múltipla escolha?</span>
              </label>

              <div className="bg-gray-50 rounded-xl overflow-hidden">
                <label className="flex items-center p-4 cursor-pointer hover:bg-gray-100 border-b border-gray-200">
                  <input
                    type="checkbox"
                    checked={formData.generateAudio}
                    onChange={(e) => setFormData({...formData, generateAudio: e.target.checked})}
                    className="w-5 h-5 text-freedom-orange border-gray-300 rounded focus:ring-freedom-orange"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">Gerar áudio</span>
                </label>
                
                {formData.generateAudio && (
                  <div className="p-4 bg-white/50 space-y-4 border-l-4 border-freedom-orange animate-slideDown">
                    <div className="flex space-x-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Voice</label>
                        <select 
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                          value={formData.audioVoice}
                          onChange={(e) => setFormData({...formData, audioVoice: e.target.value as any})}
                        >
                          <option value="female">Female voice</option>
                          <option value="male">Male voice</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Accent</label>
                        <select 
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                          value={formData.audioAccent}
                          onChange={(e) => setFormData({...formData, audioAccent: e.target.value as any})}
                        >
                          <option value="american">American</option>
                          <option value="british">British</option>
                          <option value="australian">Australian</option>
                          <option value="indian">Indian</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {[
                { id: 'generateImage', label: 'Gerar pretexto de imagem p/ conversação?' },
                { id: 'generateText', label: 'Gerar pretexto de texto p/ conversação?' },
                { id: 'includeConversationQuestions', label: 'Perguntas de conversação adequadas?' },
                { id: 'icebreaker', label: 'Dinâmica de quebra-gelo (Icebreaker)?' },
                { id: 'closing', label: 'Dinâmica de encerramento?' },
                { id: 'homework', label: 'Ideias de atividades para casa?' },
              ].map((item) => (
                <label key={item.id} className="flex items-center p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={(formData as any)[item.id]}
                    onChange={(e) => setFormData({...formData, [item.id]: e.target.checked})}
                    className="w-5 h-5 text-freedom-orange border-gray-300 rounded focus:ring-freedom-orange"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">{item.label}</span>
                </label>
              ))}
            </div>

            <div className="flex space-x-4">
              <button onClick={() => setStep(1)} className="flex-1 bg-gray-200 text-gray-700 py-4 rounded-xl font-title">Back</button>
              <button onClick={handleGenerate} className="flex-[2] bg-freedom-orange text-white py-4 rounded-xl font-title hover:bg-orange-600">Generate Lesson Plan</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonGenerator;
