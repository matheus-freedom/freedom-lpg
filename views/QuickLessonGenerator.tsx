
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FredGuide from '../components/FredGuide';
import { generateQuickLessonPlan, generateLessonImage } from '../services/geminiService';
import { saveLessonPlanSafely } from '../services/storageService';
import { CEFRLevel, StudentCount, AudioConfig, User } from '../types';

const QuickLessonGenerator: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Fred is starting...");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('freedom_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  const [formData, setFormData] = useState({
    level: 'A1' as CEFRLevel,
    studentCount: 1 as StudentCount,
    grammarTopic: '',
    vocabularyFocus: '',
    extraInfo: ''
  });

  const [audioSettings, setAudioSettings] = useState<AudioConfig>({
    enabled: false,
    gender: 'female',
    accent: 'american',
    voiceName: 'Zephyr'
  });

  const getVoiceName = (gender: 'male' | 'female', accent: 'american' | 'british') => {
    if (accent === 'american') {
      return gender === 'male' ? 'Kore' : 'Zephyr';
    } else {
      return gender === 'male' ? 'Charon' : 'Puck';
    }
  };

  const handleAudioChange = (updates: Partial<AudioConfig>) => {
    const nextSettings = { ...audioSettings, ...updates };
    nextSettings.voiceName = getVoiceName(nextSettings.gender, nextSettings.accent);
    setAudioSettings(nextSettings);
  };

  const handleGenerate = async () => {
    if (!formData.grammarTopic || !formData.vocabularyFocus) {
      alert("Fred needs a grammar topic and a vocabulary focus!");
      return;
    }

    setLoading(true);
    try {
      setLoadingStatus("Analyzing goals and generating power text...");
      const plan = await generateQuickLessonPlan(formData);
      
      setLoadingStatus("Creating custom illustration for your class...");
      const imagePrompt = plan.visualPrompt || `${formData.vocabularyFocus} ${formData.extraInfo}`;
      const image = await generateLessonImage(imagePrompt);
      
      const finalPlan = { 
        ...plan, 
        illustrationImage: image,
        authorName: currentUser?.name || 'Freedom Teacher',
        audioConfig: audioSettings.enabled ? audioSettings : undefined
      };
      
      setLoadingStatus("Syncing with Freedom Cloud...");
      const success = await saveLessonPlanSafely(finalPlan);
      if (success) {
        navigate(`/lesson/${finalPlan.id}`);
      }
    } catch (error) {
      console.error(error);
      alert("Fred needs to try that again! Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const counts: StudentCount[] = [1, 2, 3, 4, 5];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <FredGuide message="Speedy teaching! I'll generate a reading text, a 5-question quiz, and 10 conversation points. Everything will be focused on your grammar topic!" />

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-freedom-gray font-bold mb-3 uppercase text-[10px] tracking-widest">Level</label>
            <div className="flex flex-wrap gap-2">
              {levels.map(l => (
                <button
                  key={l}
                  onClick={() => setFormData({...formData, level: l})}
                  className={`flex-1 min-w-[50px] py-2 rounded-lg font-bold transition-all ${formData.level === l ? 'bg-freedom-orange text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-freedom-gray font-bold mb-3 uppercase text-[10px] tracking-widest">Students</label>
            <div className="flex gap-1">
              {counts.map(c => (
                <button
                  key={c}
                  onClick={() => setFormData({...formData, studentCount: c})}
                  className={`flex-1 py-2 rounded-lg font-bold ${formData.studentCount === c ? 'bg-freedom-orange text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-freedom-gray font-bold mb-2 uppercase text-[10px] tracking-widest">Grammar Topic (Mandatory)</label>
          <input
            type="text"
            placeholder="Ex: There is / There are, Present Perfect..."
            className="w-full p-4 border border-gray-200 rounded-xl focus:border-freedom-orange outline-none font-medium shadow-sm transition-all focus:ring-2 focus:ring-orange-100"
            value={formData.grammarTopic}
            onChange={e => setFormData({...formData, grammarTopic: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-freedom-gray font-bold mb-2 uppercase text-[10px] tracking-widest">Vocabulary Focus</label>
          <input
            type="text"
            placeholder="Ex: Kitchen, Business, Travel..."
            className="w-full p-4 border border-gray-200 rounded-xl focus:border-freedom-orange outline-none font-medium shadow-sm transition-all focus:ring-2 focus:ring-orange-100"
            value={formData.vocabularyFocus}
            onChange={e => setFormData({...formData, vocabularyFocus: e.target.value})}
          />
        </div>

        <div className="pt-4 border-t border-gray-100">
          <label className="flex items-center space-x-3 cursor-pointer p-4 bg-orange-50/50 rounded-2xl hover:bg-orange-50 transition-colors">
            <input 
              type="checkbox" 
              checked={audioSettings.enabled} 
              onChange={e => handleAudioChange({ enabled: e.target.checked })}
              className="w-5 h-5 rounded text-freedom-orange focus:ring-freedom-orange"
            />
            <div className="flex flex-col">
              <span className="font-bold text-freedom-gray text-sm">Add text audio</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">Generated by Gemini AI</span>
            </div>
          </label>

          {audioSettings.enabled && (
            <div className="grid grid-cols-2 gap-4 mt-4 animate-fadeIn">
              <div>
                <label className="block text-[9px] font-black uppercase text-gray-400 mb-2">Voice Gender</label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  {(['female', 'male'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => handleAudioChange({ gender: g })}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-lg uppercase transition-all ${audioSettings.gender === g ? 'bg-white text-freedom-orange shadow-sm' : 'text-gray-400'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase text-gray-400 mb-2">Accent</label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  {(['american', 'british'] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => handleAudioChange({ accent: a })}
                      className={`flex-1 py-2 text-[10px] font-bold rounded-lg uppercase transition-all ${audioSettings.accent === a ? 'bg-white text-freedom-orange shadow-sm' : 'text-gray-400'}`}
                    >
                      {a === 'american' ? 'USA' : 'UK'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-100">
          <label className="block text-freedom-gray font-bold mb-2 uppercase text-[10px] tracking-widest">Add Extra Information (Optional)</label>
          <textarea
            placeholder="Add specific context, student interests, or specific scenarios you want Fred to include..."
            className="w-full p-4 border border-gray-200 rounded-xl focus:border-freedom-orange outline-none font-medium shadow-sm transition-all focus:ring-2 focus:ring-orange-100 h-24 resize-none"
            value={formData.extraInfo}
            onChange={e => setFormData({...formData, extraInfo: e.target.value})}
          />
        </div>

        <button 
          onClick={handleGenerate} 
          disabled={loading}
          className="w-full bg-freedom-orange text-white py-5 rounded-xl font-title text-xl shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center space-x-2 active:scale-[0.98] disabled:opacity-50"
        >
          <span>⚡ GENERATE QUICK LESSON</span>
        </button>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-freedom-orange flex flex-col items-center justify-center text-white p-6 text-center z-50">
          <div className="w-24 h-24 border-8 border-white border-t-transparent rounded-full animate-spin mb-8"></div>
          <h2 className="text-3xl font-title mb-4">Quick Power Up!</h2>
          <p className="text-xl font-bold">{loadingStatus}</p>
        </div>
      )}
    </div>
  );
};

export default QuickLessonGenerator;
