
import React, { useState } from 'react';
import FredGuide from '../components/FredGuide';
import { generatePlaygroundActivity } from '../services/geminiService';
import { CEFRLevel } from '../types';

const DYNAMIC_TYPES = [
  { id: 'icebreaker', name: 'Warm-up Games', icon: '🎮', category: 'Social' },
  { id: 'debate', name: 'Formal Debates', icon: '🗣️', category: 'Critical' },
  { id: 'restaurant', name: 'Restaurant Role-play', icon: '🍕', category: 'Real Life' },
  { id: 'airport', name: 'Airport Simulation', icon: '✈️', category: 'Travel' },
  { id: 'interview', name: 'Mock Job Interview', icon: '👔', category: 'Business' },
  { id: 'negotiation', name: 'Business Negotiation', icon: '🤝', category: 'Business' },
  { id: 'sharktank', name: 'Product Pitch (Shark Tank)', icon: '🦈', category: 'Business' },
  { id: 'mystery', name: 'Mystery Solving', icon: '🔍', category: 'Games' },
  { id: 'storychain', name: 'Story Chain', icon: '📖', category: 'Creative' },
  { id: 'news', name: 'News Broadcast', icon: '📺', category: 'Professional' },
  { id: 'survival', name: 'Survival Scenario', icon: '🏝️', category: 'Problem Solving' },
  { id: 'trivia', name: 'Cultural Trivia', icon: '🌍', category: 'General' },
  { id: 'speculation', name: 'Picture Speculation', icon: '🖼️', category: 'Visual' },
  { id: 'ethics', name: 'Ethical Dilemmas', icon: '⚖️', category: 'Critical' },
  { id: 'future', name: 'Future Predictions', icon: '🔮', category: 'Grammar' },
  { id: 'advice', name: 'Advice Column', icon: '✉️', category: 'Social' },
  { id: 'speeddating', name: 'Speed Conversing', icon: '⏱️', category: 'Social' },
  { id: 'auction', name: 'Grammar Auction', icon: '🔨', category: 'Grammar' },
  { id: 'movie', name: 'Movie Pitching', icon: '🎬', category: 'Creative' },
  { id: 'conflict', name: 'Conflict Resolution', icon: '😤', category: 'Professional' },
];

const Playground: React.FC = () => {
  const [level, setLevel] = useState<CEFRLevel>('A1');
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState<any>(null);

  const handleGenerate = async (typeId: string) => {
    setLoading(true);
    try {
      const data = await generatePlaygroundActivity(level, typeId);
      setActivity(data);
    } catch (e) {
      alert("Fred error!");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-freedom-gray flex flex-col items-center justify-center text-white z-50">
        <div className="w-16 h-16 border-4 border-freedom-orange border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-2xl font-black uppercase">Fred is playing...</h2>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <FredGuide message="Welcome to the Playground! Pick a level and choose a dynamic to spark some life into your class. No rules, just English!" />

      {!activity ? (
        <>
          <div className="bg-white p-6 rounded-3xl shadow-sm mb-8 flex flex-col items-center">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Target Level</h3>
            <div className="flex gap-2">
              {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`w-12 h-12 rounded-xl font-black transition-all ${level === l ? 'bg-freedom-orange text-white' : 'bg-gray-100 text-gray-400'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {DYNAMIC_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => handleGenerate(type.id)}
                className="bg-white p-6 rounded-3xl border border-gray-100 hover:border-freedom-orange hover:shadow-xl transition-all flex flex-col items-center text-center group"
              >
                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">{type.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{type.category}</span>
                <span className="text-xs font-bold text-freedom-gray leading-tight">{type.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-fadeIn">
          <div className="bg-freedom-orange p-8 flex justify-between items-center text-white">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">{activity.title}</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Skill: {activity.targetSkills} | Level: {level}</p>
            </div>
            <button onClick={() => setActivity(null)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-freedom-orange mb-3">Teacher Prep</h4>
                <div className="bg-gray-50 p-6 rounded-2xl border-l-4 border-freedom-orange text-sm text-gray-600 leading-relaxed italic">
                  {activity.setupInstructions}
                </div>
              </section>
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-freedom-gray mb-3">Activity Steps</h4>
                <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                  {activity.activitySteps.split('\n').filter((s: string) => s.trim()).map((step: string, i: number) => {
                    const cleanStep = step.replace(/^\d+[\.\)]\s*|^\-\s*/, '').trim();
                    return (
                      <p key={i} className="flex items-start">
                        <span className="w-5 h-5 bg-freedom-gray text-white text-[10px] rounded flex items-center justify-center mr-3 mt-1 shrink-0">{i + 1}</span>
                        {cleanStep}
                      </p>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-3">Student Display</h4>
                <div className="bg-freedom-gray p-8 rounded-[2.5rem] shadow-2xl text-white text-center font-title text-xl lg:text-2xl italic tracking-tight leading-snug">
                  {activity.studentMaterial}
                </div>
              </section>
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-3">Support Questions</h4>
                <div className="grid grid-cols-1 gap-3">
                  {activity.backupQuestions.map((q: string, i: number) => (
                    <div key={i} className="bg-green-50 p-4 rounded-xl border-l-4 border-green-500 text-xs font-bold text-green-800">
                      "{q}"
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
          
          <div className="p-8 text-center bg-gray-50 border-t border-gray-100">
             <button onClick={() => window.print()} className="bg-freedom-gray text-white px-8 py-3 rounded-xl font-bold uppercase text-xs tracking-widest">Download PDF Guide</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Playground;
