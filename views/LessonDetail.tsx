
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LessonPlan } from '../types';
import FredGuide from '../components/FredGuide';
import { getPlanById, updateLessonPlan } from '../services/storageService';

const LessonDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!id) return;
      setLoading(true);
      const found = await getPlanById(id);
      setPlan(found);
      setLoading(false);
    };
    fetchPlan();
  }, [id]);

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

  const handleSave = async () => {
    if (!id) return;
    const success = await updateLessonPlan(id, plan);
    if (success) {
      setEditing(false);
      alert("Changes saved to cloud!");
    } else {
      alert("Failed to save changes.");
    }
  };

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const renderCleanText = (text: string) => {
    if (!text) return null;
    let clean = text.replace(/^#+\s*/gm, '').trim();
    const parts = clean.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-freedom-orange font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 print:p-0">
      <div className="print:hidden">
        <FredGuide message="Here is your masterpiece! I've included several conversation moments because that's where the magic happens. Do you like it or should we tweak something?" />
        
        <div className="flex flex-wrap gap-4 mb-8">
          <button onClick={() => setEditing(!editing)} className="bg-freedom-gray text-white px-6 py-2 rounded-lg font-bold hover:bg-black transition-all">
            {editing ? 'Stop Editing' : 'Edit Content'}
          </button>
          <button onClick={handlePrint} className="bg-white border-2 border-freedom-orange text-freedom-orange px-6 py-2 rounded-lg font-bold hover:bg-orange-50 transition-all">
            Download PDF
          </button>
          {/* Worksheet do aluno: versao em 3 paginas SEM as notas do professor */}
          <button
            onClick={() => navigate(`/worksheet/${plan.id}`)}
            className="bg-white border-2 border-freedom-gray text-freedom-gray px-6 py-2 rounded-lg font-bold hover:bg-gray-100 transition-all"
          >
            Student Worksheet
          </button>
          <button 
            onClick={() => navigate(`/classroom/${plan.id}`)}
            className="bg-freedom-orange text-white px-8 py-2 rounded-lg font-title shadow-lg hover:scale-105 transition-all"
          >
            START CLASS
          </button>
        </div>
      </div>

      <div className="bg-white p-6 lg:p-10 rounded-3xl shadow-lg border border-gray-100 min-h-screen print:shadow-none print:border-none">
        <div className="flex justify-between items-start mb-8 border-b-2 border-freedom-orange pb-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-title text-freedom-gray leading-tight">
              {editing ? (
                <input 
                  className="border rounded px-2 w-full" 
                  value={plan.title} 
                  onChange={e => setPlan({...plan, title: e.target.value})}
                />
              ) : plan.title}
            </h1>
            <div className="flex items-center space-x-4 mt-3 text-[10px] lg:text-xs text-gray-500 font-bold uppercase tracking-widest">
              <span>LEVEL: {plan.level}</span>
              <span>DURATION: {plan.duration}</span>
              <span>STUDENTS: {plan.studentCount}</span>
            </div>
          </div>
          <div className="bg-freedom-orange text-white px-4 py-1 rounded-full font-bold text-[10px] uppercase tracking-tighter shrink-0">
            FREEDOM LPG
          </div>
        </div>

        <div className="space-y-10">
          {plan.icebreaker && (
            <section className="p-6 bg-orange-50 rounded-2xl border-l-4 border-freedom-orange">
              <h3 className="font-title text-freedom-orange mb-2 text-sm tracking-widest uppercase">ICEBREAKER</h3>
              <p className="text-freedom-gray italic leading-relaxed">{plan.icebreaker}</p>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl">
            <div>
              <h4 className="font-black text-[10px] uppercase text-gray-400 tracking-widest mb-1">Grammar Focus</h4>
              <p className="text-freedom-gray font-bold">{plan.grammarTopic}</p>
            </div>
            <div>
              <h4 className="font-black text-[10px] uppercase text-gray-400 tracking-widest mb-1">Vocabulary Focus</h4>
              <p className="text-freedom-gray font-bold">{plan.vocabularyFocus}</p>
            </div>
          </div>

          {plan.sections.map((sec, idx) => (
            <div key={idx} className="border-b border-gray-100 pb-10 last:border-0">
              <div className="flex items-center mb-4">
                <span className="w-8 h-8 flex items-center justify-center bg-freedom-gray text-white rounded-full text-xs font-bold mr-3 shrink-0">{idx + 1}</span>
                <h3 className="font-title text-lg uppercase tracking-tight">{sec.title}</h3>
                {sec.isConversation && <span className="ml-auto text-[8px] lg:text-[10px] bg-green-100 text-green-700 px-3 py-1 rounded-full font-black uppercase tracking-widest">CONVERSATION</span>}
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="print:block">
                  <h4 className="text-[9px] font-black text-freedom-orange uppercase mb-2 tracking-[0.2em]">Teacher Instructions</h4>
                  <div className="text-sm bg-white p-4 border border-gray-200 rounded-xl shadow-sm whitespace-pre-wrap leading-relaxed min-h-[120px]">
                    {editing ? (
                      <textarea 
                        className="w-full h-32 p-2 text-sm outline-none bg-gray-50 rounded" 
                        value={sec.teacherNotes}
                        onChange={e => {
                          const newSecs = [...plan.sections];
                          newSecs[idx].teacherNotes = e.target.value;
                          setPlan({...plan, sections: newSecs});
                        }}
                      />
                    ) : sec.teacherNotes}
                  </div>
                </div>
                <div>
                  <h4 className="text-[9px] font-black text-freedom-gray uppercase mb-2 tracking-[0.2em]">Student View Content</h4>
                  <div className="p-6 bg-freedom-gray text-white rounded-2xl shadow-xl min-h-[120px] flex items-center justify-center text-center whitespace-pre-wrap leading-relaxed font-medium">
                    {editing ? (
                      <textarea 
                        className="w-full h-32 p-2 text-sm text-black outline-none bg-white rounded" 
                        value={sec.studentContent}
                        onChange={e => {
                          const newSecs = [...plan.sections];
                          newSecs[idx].studentContent = e.target.value;
                          setPlan({...plan, sections: newSecs});
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        {renderCleanText(sec.studentContent || "")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {plan.homework && (
            <div className="bg-gray-100 p-8 rounded-2xl border-t-4 border-freedom-gray">
              <h3 className="font-title mb-3 uppercase tracking-widest text-sm">HOMEWORK IDEAS</h3>
              <p className="text-gray-600 text-sm leading-relaxed italic">{plan.homework}</p>
            </div>
          )}
        </div>

        {editing && (
          <div className="mt-16 text-center">
            <button 
              onClick={handleSave} 
              className="bg-green-600 text-white px-16 py-4 rounded-2xl font-title hover:bg-green-700 shadow-xl transition-all active:scale-95"
            >
              SAVE UPDATES
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonDetail;
