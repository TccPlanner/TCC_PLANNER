import * as webllm from "@mlc-ai/web-llm";

let engine = null;

// ✅ Modelos menores para rodar em mais máquinas
// Ele tenta um por um até funcionar
const MODEL_CANDIDATES = [
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Llama-3.1-8B-Instruct-q4f16_1-MLC",
];

function hasWebGPU() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

export async function initFlashcardAI(onProgress) {
  if (engine) return engine;

  if (!hasWebGPU()) {
    throw new Error(
      "Seu navegador não suporta WebGPU (necessário para IA grátis no navegador). Use Chrome/Edge atualizado e ative WebGPU."
    );
  }

  engine = new webllm.MLCEngine();

  let lastError = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      await engine.reload(model, {
        initProgressCallback: (report) => {
          if (onProgress && report?.text) onProgress(report.text);
        },
      });
      return engine;
    } catch (err) {
      lastError = err;
      console.warn("Falhou carregar modelo:", model, err);
    }
  }

  throw new Error(
    `Falha ao carregar modelos IA.\nDetalhe: ${lastError?.message || "erro desconhecido"}`
  );
}

export async function generateFlashcardsFromText({ text, qtd = 20, onProgress }) {
  const ai = await initFlashcardAI(onProgress);

  const prompt = `
Crie ${qtd} flashcards a partir do texto abaixo.
VARIE tipos:
- Alguns "normal" com pergunta/resposta
- Alguns "cloze" com cloze_text e cloze_answer
Tags: 3 a 6 tags curtas por card.

Responda SOMENTE com JSON válido no formato:
[
  {
    "tipo": "normal" | "cloze",
    "pergunta": "...",
    "resposta": "...",
    "cloze_text": "Frase com {{c1::parte escondida}}",
    "cloze_answer": "parte escondida",
    "tags": ["tag1","tag2"]
  }
]

Texto:
${text}
`;

  const completion = await ai.chat.completions.create({
    messages: [
      { role: "system", content: "Responda apenas JSON válido. Sem texto extra." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices?.[0]?.message?.content || "[]";

  // ✅ Extrair só o JSON com segurança
  const jsonStart = raw.indexOf("[");
  const jsonEnd = raw.lastIndexOf("]");

  const jsonText =
    jsonStart >= 0 && jsonEnd >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : "[]";

  let parsed = [];
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error("IA retornou inválido:", raw);
    throw new Error("A IA não retornou JSON válido. Tente novamente.");
  }

  return (parsed || [])
    .filter((x) => x && (x.tipo === "normal" || x.tipo === "cloze"))
    .slice(0, qtd);
}

export async function generateHelpExplanation({ card, onProgress }) {
  const ai = await initFlashcardAI(onProgress);

  const base =
    card.tipo === "cloze"
      ? `CLOZE: ${card.cloze_text}\nRESPOSTA: ${card.cloze_answer}`
      : `PERGUNTA: ${card.pergunta}\nRESPOSTA: ${card.resposta}`;

  const prompt = `
O usuário errou este card 3 vezes seguidas.
Explique de forma BEM simples, com analogia e um exemplo prático.
Depois dê um macete curto.

Card:
${base}
`;

  const completion = await ai.chat.completions.create({
    messages: [
      { role: "system", content: "Seja didático e direto. Use português do Brasil." },
      { role: "user", content: prompt },
    ],
    temperature: 0.35,
  });

  return completion.choices?.[0]?.message?.content || "Não consegui gerar explicação agora.";
}
