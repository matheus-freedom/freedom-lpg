
import React, { useState } from 'react';
import FredGuide from '../components/FredGuide';
import { generateExam } from '../services/geminiService';
import { CEFRLevel } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

const ExamGenerator: React.FC = () => {
  const [level, setLevel] = useState<CEFRLevel>('A1');
  const [examContent, setExamContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResultInput, setShowResultInput] = useState(false);
  const [scores, setScores] = useState({ listening: 80, reading: 70, speaking: 90, writing: 60 });

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const content = await generateExam(level);
      setExamContent(content);
    } catch (e) {
      alert("Error generating exam");
    } finally {
      setLoading(false);
    }
  };

  const radarData = [
    { subject: 'Listening', A: scores.listening, fullMark: 100 },
    { subject: 'Reading', A: scores.reading, fullMark: 100 },
    { subject: 'Speaking', A: scores.speaking, fullMark: 100 },
    { subject: 'Writing', A: scores.writing, fullMark: 100 },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <FredGuide message="Assessments are key to growth! Let's build a challenging but fair exam that celebrates what your students have learned." />

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
        {!examContent ? (
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-title mb-6">Select Level for Exam</h3>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`w-16 h-16 rounded-2xl font-bold transition-all ${level === l ? 'bg-freedom-orange text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button 
              onClick={handleGenerate} 
              disabled={loading}
              className="bg-freedom-orange text-white px-12 py-4 rounded-xl font-title shadow-lg hover:bg-orange-600 transition-all disabled:opacity-50"
            >
              {loading ? 'Preparing Exam...' : 'Generate Comprehensive Exam'}
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="font-title text-2xl text-freedom-orange">Exam Level {level}</h3>
              <button onClick={() => setExamContent(null)} className="text-gray-400 font-bold hover:text-red-500">Reset</button>
            </div>
            
            <div className="prose max-w-none whitespace-pre-wrap text-freedom-gray leading-relaxed font-medium bg-gray-50 p-6 rounded-xl border border-gray-200">
              {examContent}
            </div>

            <div className="mt-8 pt-8 border-t border-gray-100">
              <h4 className="font-title mb-4">Want to simulate student performance?</h4>
              <button 
                onClick={() => setShowResultInput(!showResultInput)} 
                className="bg-freedom-gray text-white px-6 py-2 rounded-lg font-bold"
              >
                {showResultInput ? 'Hide Simulator' : 'Show Result Simulator'}
              </button>

              {showResultInput && (
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="space-y-4">
                    {Object.keys(scores).map((skill) => (
                      <div key={skill}>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{skill}</label>
                        <input 
                          type="range" 
                          min="0" max="100" 
                          value={(scores as any)[skill]} 
                          onChange={(e) => setScores({...scores, [skill]: parseInt(e.target.value)})}
                          className="w-full accent-freedom-orange"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="h-64 bg-gray-50 rounded-2xl p-4">
                    <h5 className="text-center font-title text-sm mb-4">Performance Dashboard</h5>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                          name="Student"
                          dataKey="A"
                          stroke="#f7931e"
                          fill="#f7931e"
                          fillOpacity={0.6}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamGenerator;
