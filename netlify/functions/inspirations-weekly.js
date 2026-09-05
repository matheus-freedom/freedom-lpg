// ============================================================
// FREEDOMLPG — Scheduled Function: inspirations-weekly
// ------------------------------------------------------------
// Roda sozinha, toda semana, no horário definido em netlify.toml:
//   schedule = "0 21 * * 0"  →  domingo 21:00 UTC = 18:00 Brasília
//
// POR QUE ELA NÃO GERA AS INSPIRAÇÕES AQUI DENTRO:
// Funções agendadas da Netlify têm limite de 30 segundos. Pesquisar
// no Google e redigir 40 propostas leva mais que isso. Então esta
// função só "aperta o botão": dispara a background function
// (gemini-background, limite de 15 minutos) e encerra.
// É o mesmo padrão que gemini.js usa para gerar aulas.
//
// Ela NÃO pode ser chamada por URL em produção (a Netlify bloqueia).
// Para testar sem esperar o domingo: botão "Run now" na aba
// Functions do painel da Netlify, ou o botão "Gerar agora" do
// admin dentro da aba Inspirações do app.
// ============================================================

exports.handler = async () => {
  const jobId = `sched_inspirations_${Date.now()}`;

  const siteUrl =
    process.env.URL ||
    process.env.DEPLOY_URL ||
    "http://localhost:8888";

  const backgroundUrl = `${siteUrl}/.netlify/functions/gemini-background`;
  console.log("[inspirations-weekly] Disparando background em:", backgroundUrl, "jobId:", jobId);

  try {
    // Aguardar o fetch é obrigatório: se a função retornar antes,
    // o ambiente é congelado e o pedido nunca sai.
    const response = await fetch(backgroundUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, action: "generateInspirations" }),
    });
    console.log("[inspirations-weekly] Background respondeu status:", response.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, jobId }) };
  } catch (err) {
    console.error("[inspirations-weekly] Falha ao disparar background:", err);
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
