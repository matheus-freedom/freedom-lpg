import { CEFRLevel } from '../types';

/**
 * ─── Freedom Language Center · Sequência gramatical oficial ───────────────
 *
 * Esta é a ordem cronológica em que a escola trabalha os temas gramaticais
 * em cada nível do CEFR. A ordem do array É a ordem das aulas — não
 * reordene sem alinhar com a coordenação pedagógica.
 *
 * Os rótulos estão em inglês porque o valor escolhido aqui vai direto para
 * o prompt do Gemini (que é escrito em inglês) e aparece para o aluno na
 * Student Worksheet e no cartão da aula. Um rótulo em português dentro de
 * um prompt em inglês ainda funciona, mas gera aulas menos consistentes.
 *
 * Para acrescentar um tema novo: basta adicionar uma string no lugar certo
 * do array do nível. Numeração e dropdown são gerados automaticamente.
 */
export const GRAMMAR_CURRICULUM: Record<CEFRLevel, string[]> = {
  A1: [
    'Verb to be (present)',
    'Present Continuous',
    'Simple Present',
    'Was / Were',
    'Simple Past',
    'Used to',
    'Present Perfect',
    'Future with Present Continuous and Simple Present',
    'Going to',
    'Will',
    'Might / May',
    'Can / Could',
    'Must',
    'Should',
    'Would',
  ],
  A2: [
    'There is / There are',
    'In, On, At (prepositions)',
    'Telling the time',
    'Verb get',
    'Do & Make',
    'Personal pronouns (subject & object)',
    'Possessives',
    'Reflexive pronouns',
    'How much / How many',
    'Demonstratives + one / ones',
    'Some and Any',
    'Little / Few',
    'Comparatives',
    'Superlatives',
    'Conditionals (zero, first, second, third)',
    'Gerund vs. Infinitive',
    'Phrasal Verbs',
  ],
  B1: [
    'Present Continuous',
    'Simple Present',
    'Simple Past',
    'Past Continuous',
    'Present Perfect',
    'Present Perfect Continuous',
    'For, Since and Ago',
    'Past Perfect',
    'Past Perfect Continuous',
    'Have vs. Have got',
    'Used to',
    'Future with present tenses',
    'Going to',
    'Will',
    'Will be doing (Future Continuous)',
    'Will have done (Future Perfect)',
    'Can, Could and Be able to',
    'Could have done',
    'Must',
    'May and Might',
    'Have to',
    'Need',
    'Should',
    'Would',
    'Formal requests',
    'Had better',
  ],
  B2: [
    'First Conditional',
    'Second Conditional',
    'Third Conditional',
    'Wish',
    'Passive Voice',
    'Passive Voice 2',
    'Reported Speech',
    'ING / Infinitive',
    'Infinitives with "to"',
    'Prefer to / Would rather',
    'Prepositions + ING',
    'Adjectives (-ing / -ed)',
    'Adverbs',
    'Reflexive pronouns',
    'Possessive pronouns',
    'Some and Any',
    'No, None, Any',
    'Comparatives',
    'Superlatives',
    'Enough and Too',
    'Quite, Pretty, Rather, Fairly',
    'In, On, At (time)',
    'In, On, At (place)',
    'Phrasal Verbs',
    'Relative Clauses',
    'Much, Many, Little, Few, A lot, Plenty',
    'Conjunctions',
    'All, Most, None',
    'Both, Neither, Either',
    'Each and Every',
  ],
  C1: [
    'Inversion with negative adverbials',
    'Third conditional and inverted conditionals',
    'Participle clauses',
    'Reporting verbs + modals of probability (hedging)',
    'Subjunctive',
    'Formal relative clauses with prepositions',
    'Contrast markers',
    'Advanced passive voice',
    'Passive voice + result clauses with -ing',
    'Embedded questions (whether) + whose',
    'Infinitive of purpose',
    'Narrative Past Perfect',
    'Future + first conditional',
    'Third conditional variations (if not for)',
    'Comparisons (as...as, rather than)',
    'Cause and effect language',
    'Impersonal passive (It is said that...)',
    'If only / Wish',
    'Comment adverbs and discourse markers',
    'Reporting verbs',
    'As if / As though',
    'Concession (although, even though, despite)',
    'Advanced conditionals (were to)',
    'Mixed conditionals',
    'Non-defining relative clauses',
    'Inversion with No sooner / Hardly',
    'Reduced concessive clauses + cleft sentences',
    'Advanced concession',
    'Correlatives (Not only... but also)',
  ],
};

/**
 * Valor-sentinela usado pelo dropdown para representar a opção
 * "Other (custom topic)". Nunca vai para o Gemini nem para o Firestore:
 * o componente troca esse valor pelo texto digitado pelo professor.
 */
export const CUSTOM_GRAMMAR_TOPIC = '__custom__';
