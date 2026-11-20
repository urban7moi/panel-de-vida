// Consejos del entrenador generados con la API de OpenAI a partir de tus entrenos de Hevy.
// Se generan una sola vez por cada entreno nuevo (caché por id del último entreno).
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { unstable_cache } from "next/cache";
import type { HevyWorkout } from "./hevy";
import { e1rm } from "./training";
import { TZ } from "./time";

const Tip = z.object({ title: z.string(), body: z.string() });
const Coach = z.object({ push: z.array(Tip), pull: z.array(Tip), general: z.array(Tip) });
export type CoachTip = z.infer<typeof Tip>;
export type CoachReport = z.infer<typeof Coach>;

const SYSTEM = `Eres el entrenador personal de un hombre de 78 kg que busca recomposición corporal (ganar músculo y perder grasa) y mantenerse fuerte y atlético.
Su semana: lunes Push, martes Pull, miércoles rehabilitación de rodilla, jueves Push, viernes Pull.
Está recién operado de rodilla: NO le propongas ejercicios ni cargas de pierna; para la rodilla limítate a recordarle que siga las pautas de su fisioterapeuta.

Analiza sus últimos entrenos y devuelve recomendaciones concretas y accionables, agrupadas así:
- "push": 1-3 recomendaciones sobre sus sesiones de empuje (pecho, hombro, tríceps).
- "pull": 1-3 recomendaciones sobre sus sesiones de tirón (espalda, bíceps).
- "general": 1-3 recomendaciones generales (equilibrio empuje/tirón por series, volumen, descansos, recuperación).
Pon solo las que estén justificadas por los datos; si un grupo no tiene datos, devuélvelo vacío.

Cada recomendación:
- title: el ejercicio o tema y la acción, máximo 7 palabras (p. ej. "Press banca: cambia de variante").
- body: 2-3 frases. Primero lo que ves en sus datos con números (kg × reps, series, semanas). Después qué hacer exactamente: ejercicio, series × repeticiones, kilos concretos y durante cuánto tiempo, y cuándo volver a probar la marca.
- Da siempre los kilos exactos, nunca porcentajes: si propones bajar peso, calcula y di el peso nuevo redondeado a 2,5 kg en barra o al par de mancuernas más cercano (p. ej. "baja de 70 kg a 62,5 kg").
- Nada de elogios ni frases genéricas ("mantienes una buena base de fuerza", "sigue así"): si algo va bien, di qué hacer para seguir progresando.
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

async function generate(workouts: HevyWorkout[]): Promise<CoachReport> {
  const client = new OpenAI();
  const res = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    instructions: SYSTEM,
    input: `Entrenos recientes (del más nuevo al más antiguo):\n${summarize(workouts)}`,
    text: { format: zodTextFormat(Coach, "informe_entrenador") },
  });
  const r = res.output_parsed;
  if (!r) throw new Error("Respuesta vacía del entrenador");
  return { push: r.push.slice(0, 3), pull: r.pull.slice(0, 3), general: r.general.slice(0, 3) };
}

/** Informe del entrenador para el estado actual. Devuelve null si no hay clave de OpenAI o falla. */
export async function coachTips(workouts: HevyWorkout[]): Promise<CoachReport | null> {
  if (!process.env.OPENAI_API_KEY || workouts.length === 0) return null;
  const key = workouts[0].id;
  try {
    return await unstable_cache(() => generate(workouts), ["coach-report-v2", key], { revalidate: 60 * 60 * 24 * 7 })();
  } catch (err) {
    console.error("Coach", err);
    return null;
  }
}
