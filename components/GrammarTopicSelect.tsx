import React from 'react';
import { CEFRLevel } from '../types';
import { GRAMMAR_CURRICULUM, CUSTOM_GRAMMAR_TOPIC } from '../data/grammarCurriculum';

/**
 * Dropdown de tema gramatical que segue a sequência oficial da escola.
 *
 * Como funciona:
 *  - Recebe o `level` escolhido no formulário e mostra SÓ os temas daquele nível,
 *    numerados na ordem em que as aulas acontecem.
 *  - Enquanto nenhum nível foi escolhido, o dropdown fica desabilitado com um
 *    aviso — assim o professor entende por que não consegue escolher ainda.
 *  - A última opção é sempre "Other (custom topic)". Ao escolhê-la, aparece um
 *    campo de texto livre para temas fora do padrão.
 *
 * O componente é "controlado": quem guarda o estado é o formulário-pai.
 * Ele só avisa (via callbacks) quando o professor muda algo.
 */
interface GrammarTopicSelectProps {
  level: CEFRLevel | null;
  /** Tema escolhido no dropdown, ou CUSTOM_GRAMMAR_TOPIC, ou '' se vazio. */
  selection: string;
  onSelectionChange: (value: string) => void;
  /** Texto digitado quando a opção custom está ativa. */
  customValue: string;
  onCustomChange: (value: string) => void;
}

const GrammarTopicSelect: React.FC<GrammarTopicSelectProps> = ({
  level, selection, onSelectionChange, customValue, onCustomChange,
}) => {
  const topics = level ? GRAMMAR_CURRICULUM[level] : [];
  const isCustom = selection === CUSTOM_GRAMMAR_TOPIC;
  const selectedIndex = level ? topics.indexOf(selection) : -1;

  return (
    <div>
      <label className="block text-freedom-gray font-black mb-2 uppercase text-[10px] tracking-widest">
        Grammar Topic <span className="text-red-400">*</span>
        {!level && <span className="text-red-400 ml-1 normal-case tracking-normal">← Choose a CEFR level first</span>}
      </label>

      <div className="relative">
        <select
          value={selection}
          disabled={!level}
          onChange={e => onSelectionChange(e.target.value)}
          className={`w-full p-3.5 pr-10 border-2 rounded-xl outline-none font-medium text-sm transition-all appearance-none bg-white ${
            !level
              ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
              : isCustom
                ? 'border-freedom-orange text-freedom-gray'
                : 'border-gray-200 focus:border-freedom-orange text-freedom-gray'
          }`}
        >
          <option value="" disabled>
            {level ? `Select a grammar topic (${level} sequence)...` : 'Choose a CEFR level first'}
          </option>
          {topics.map((topic, i) => (
            <option key={topic} value={topic}>
              {i + 1}. {topic}
            </option>
          ))}
          {level && (
            <option value={CUSTOM_GRAMMAR_TOPIC}>✍️ Other (custom topic)</option>
          )}
        </select>
        {/* Seta customizada: `appearance-none` remove a seta nativa, então desenhamos a nossa */}
        <span className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-black text-xs ${level ? 'text-freedom-orange' : 'text-gray-300'}`}>
          ▼
        </span>
      </div>

      {level && selectedIndex >= 0 && (
        <p className="text-[9px] text-gray-400 font-bold mt-1.5 uppercase tracking-widest">
          Lesson {selectedIndex + 1} of {topics.length} · {level} grammar sequence
        </p>
      )}

      {isCustom && (
        <input type="text"
          autoFocus
          placeholder="Type the grammar topic. Ex: Question tags, Articles (a / an / the)..."
          className="w-full mt-3 p-3.5 border-2 border-freedom-orange rounded-xl focus:outline-none font-medium text-sm animate-fadeIn"
          value={customValue}
          onChange={e => onCustomChange(e.target.value)}
        />
      )}
    </div>
  );
};

export default GrammarTopicSelect;
