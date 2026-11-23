// Consejos del entrenador generados con la API de OpenAI a partir de tus entrenos de Hevy.
// Se generan una sola vez por cada entreno nuevo (caché por id del último entreno).
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { unstable_cache } from "next/cache";
import type { HevyWorkout } from "./hevy";
import { e1rm } from "./training";
import { TZ } from "./time";
import { DEFAULT_SETTINGS, PLAN_INFO, planForWeekday, type Settings } from "./settings";

const Tip = z.object({ title: z.string(), action: z.string(), body: z.string() });
const Coach = z.object({ push: Tip.nullable(), pull: Tip.nullable(), general: Tip.nullable() });
export type CoachTip = z.infer<typeof Tip>;
export type CoachReport = z.infer<typeof Coach>;

const SYSTEM = `Eres el entrenador personal de un hombre que busca recomposición en mantenimiento: no quiere bajar de peso, sino perder grasa y ganar músculo, subiendo poco a poco de peso en músculo, y mantenerse fuerte y atlético.
Está recién operado de rodilla: NO le propongas ejercicios ni cargas de pierna; para la rodilla limítate a recordarle que siga las pautas de su fisioterapeuta.

Analiza sus últimos entrenos y devuelve SOLO la recomendación más importante de cada grupo:
- "push": la más importante de sus sesiones de empuje (pecho, hombro, tríceps).
- "pull": la más importante de sus sesiones de tirón (espalda, bíceps).
- "general": la más importante en general (equilibrio empuje/tirón, volumen, descanso).
Si un grupo no tiene datos, devuélvelo como null.

Cada recomendación, muy corta y fácil de leer de un vistazo:
- title: ejercicio + acción, máximo 5 palabras (p. ej. "Press banca: cambia de variante").
- action: la instrucción concreta con números, máximo 8 palabras (p. ej. "4 × 8 a 62,5 kg · 2 semanas").
- body: máximo 2 frases cortas (25 palabras en total): qué ves en sus datos y para qué sirve el cambio. Lenguaje sencillo, sin tecnicismos.
- Kilos exactos, nunca porcentajes: si propones bajar peso, di el peso nuevo redondeado a 2,5 kg en barra o al par de mancuernas más cercano.
- Nada de elogios ni frases genéricas.
- Español de España, tono directo y motivador. Sin emojis.`;

function summarize(workouts: HevyWorkout[]) {
  return workouts
    .slice(0, 16)
    .map((w) => {
      const date = new Date(w.start_time).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
      const lines = w.exercises.map((e) => {
        const work = e.sets.filter((s) => s.type !== "warmup");
        const sets = work.map((s) => (s.weight_kg ? `${s.weight_kg}x${s.reps ?? 0}` : `${s.reps ?? 0}r`)).join(", ");
        const best = Math.round(Math.max(0, ...work.map(e1rm)));
        return `  - ${e.title}: ${sets}${best ? ` (1RM≈${best})` : ""}`;
      });
      return `${date} · ${w.title}\n${lines.join("\n")}`;
    })
    .join("\n");
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function weekText(s: Settings) {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => `${DAY_NAMES[d]} ${PLAN_INFO[planForWeekday(s, d)].label}`).join(", ");
}

async function generate(workouts: HevyWorkout[], settings: Settings): Promise<CoachReport> {
  const client = new OpenAI();
  const res = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    instructions: SYSTEM,
    input: `Su semana: ${weekText(settings)}. Pesa ${settings.weight} kg.\n\nEntrenos recientes (del más nuevo al más antiguo):\n${summarize(workouts)}`,
    text: { format: zodTextFormat(Coach, "informe_entrenador") },
  });
  const r = res.output_parsed;
  if (!r) throw new Error("Respuesta vacía del entrenador");
  return r;
}

/** Informe del entrenador para el estado actual. Devuelve null si no hay clave de OpenAI o falla. */
export async function coachTips(workouts: HevyWorkout[], settings: Settings = DEFAULT_SETTINGS): Promise<CoachReport | null> {
  if (!process.env.OPENAI_API_KEY || workouts.length === 0) return null;
  const key = workouts[0].id;
  try {
    return await unstable_cache(() => generate(workouts, settings), ["coach-report-v5", key, weekText(settings)], { revalidate: 60 * 60 * 24 * 7 })();
  } catch (err) {
    console.error("Coach", err);
    return null;
  }
}
