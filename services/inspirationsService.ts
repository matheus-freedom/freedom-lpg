import { db } from "./firebase";
import { doc, getDoc, getDocs, collection, query, orderBy } from "firebase/firestore";
import { WeeklyInspirations, InspirationProposal, InspirationPrefill, InspirationWeekSummary, InspirationsIndex } from "../types";
import { startInspirationsGeneration } from "./geminiService";

// ── Leitura ──────────────────────────────────────────────────
// Uma única leitura de documento: inspirations/current.
// O documento inteiro (50 propostas) tem ~40 KB — bem abaixo do
// limite de 1 MB do Firestore e barato de ler a cada visita.
export const getCurrentInspirations = async (): Promise<WeeklyInspirations | null> => {
  try {
    const snap = await getDoc(doc(db, "inspirations", "current"));
    if (!snap.exists()) return null;
    return snap.data() as WeeklyInspirations;
  } catch (e) {
    console.error("Erro ao buscar inspirações:", e);
    return null;
  }
};

// ── Histórico ("Insights antigos") ───────────────────────────
// Cada geração salva uma cópia em inspirations/week_AAAA-MM-DD, então
// nada se perde. Para listar as semanas sem baixar todos esses documentos
// (~40 KB cada), o servidor mantém inspirations/index com um resumo por
// semana. Se o índice ainda não existir (semanas geradas antes dele),
// caímos no plano B: varrer a coleção uma vez e montar os resumos aqui.
export const listInspirationWeeks = async (): Promise<InspirationWeekSummary[]> => {
  try {
    const idx = await getDoc(doc(db, "inspirations", "index"));
    if (idx.exists()) {
      const data = idx.data() as InspirationsIndex;
      return (data.weeks || []).slice().sort((a, b) => b.generatedAt - a.generatedAt);
    }
  } catch (e) {
    console.warn("Índice de inspirações indisponível, usando fallback:", e);
  }

  try {
    const snap = await getDocs(query(collection(db, "inspirations"), orderBy("generatedAt", "desc")));
    return snap.docs
      .filter(d => d.id.startsWith("week_"))
      .map(d => {
        const w = d.data() as WeeklyInspirations;
        return {
          weekId: w.weekId,
          generatedAt: w.generatedAt,
          total: (w.categories || []).reduce((n, c) => n + (c.proposals || []).length, 0),
          groundingUsed: !!w.groundingUsed,
          headlines: w.headlines || [],
        };
      });
  } catch (e) {
    console.error("Erro ao listar semanas de inspirações:", e);
    return [];
  }
};

export const getInspirationsByWeek = async (weekId: string): Promise<WeeklyInspirations | null> => {
  try {
    const snap = await getDoc(doc(db, "inspirations", `week_${weekId}`));
    if (!snap.exists()) return null;
    return snap.data() as WeeklyInspirations;
  } catch (e) {
    console.error("Erro ao buscar semana de inspirações:", e);
    return null;
  }
};

// ── Regeneração manual (admin) ───────────────────────────────
// Dispara a background function e espera o job terminar (polling
// no Firestore, igual à geração de aulas). Pode levar 1-3 minutos.
export const regenerateInspirations = async (
  onProgress?: (msg: string) => void
): Promise<{ weekId: string; total: number; groundingUsed: boolean }> => {
  return startInspirationsGeneration(onProgress);
};

// ── Próxima renovação ────────────────────────────────────────
// Domingo às 18:00 de Brasília = 21:00 UTC (sem horário de verão no
// Brasil desde 2019, então a conta é fixa). Calculado no cliente
// para mostrar "renova em X dias" mesmo sem documento carregado.
export const getNextRefreshDate = (from: Date = new Date()): Date => {
  const candidate = new Date(Date.UTC(
    from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 21, 0, 0
  ));
  const daysUntilSunday = (7 - candidate.getUTCDay()) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysUntilSunday);
  if (candidate.getTime() <= from.getTime()) candidate.setUTCDate(candidate.getUTCDate() + 7);
  return candidate;
};

export const formatRefreshCountdown = (from: Date = new Date()): string => {
  const next = getNextRefreshDate(from);
  const diffMs = next.getTime() - from.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `renova em ${days} ${days === 1 ? "dia" : "dias"}`;
  if (hours >= 1) return `renova em ${hours}h`;
  return "renova hoje às 18h";
};

// ── Ponte para o Quick Lesson ────────────────────────────────
// Transforma uma proposta no objeto que o QuickLessonGenerator lê de
// location.state.inspiration. O "extraInfo" vira o campo Extra Context
// do formulário, então o Fred recebe o gancho, as perguntas e o motivo.
export const proposalToPrefill = (p: InspirationProposal, categoryLabel: string): InspirationPrefill => {
  const lines = [
    `LESSON IDEA (from Freedom Inspirations · ${categoryLabel}): ${p.title}`,
    p.hook,
    p.conversationQuestions.length
      ? `Use these as a starting point for conversation: ${p.conversationQuestions.join(" | ")}`
      : "",
    p.vocabulary.length ? `Make sure the reading text uses: ${p.vocabulary.join(", ")}.` : "",
    p.isTrending ? `This is a current topic this week — keep references up to date.` : "",
  ].filter(Boolean);

  return {
    title: p.title,
    level: p.level,
    vocabularyFocus: p.title,
    extraInfo: lines.join("\n"),
    grammarIdea: p.grammarIdea,
  };
};

// Sorteio estável por dia: a Home mostra 3 propostas em destaque e elas
// mudam a cada dia (não a cada recarregamento), para não parecer bagunça.
export const pickDailyHighlights = (data: WeeklyInspirations, count = 3): { proposal: InspirationProposal; categoryLabel: string; emoji: string }[] => {
  const all = data.categories.flatMap(c =>
    c.proposals.map(p => ({ proposal: p, categoryLabel: c.label, emoji: c.emoji }))
  );
  if (all.length === 0) return [];
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const start = daySeed % all.length;
  const step = 7; // primo em relação a 50 → percorre todas ao longo dos dias
  const picked: typeof all = [];
  for (let i = 0; i < count && i < all.length; i++) {
    picked.push(all[(start + i * step) % all.length]);
  }
  return picked;
};
