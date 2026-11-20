// Consejos del entrenador generados con la API de OpenAI a partir de tus entrenos de Hevy.
// Se generan una sola vez por cada entreno nuevo (caché por id del último entreno).
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { unstable_cache } from "next/cache";
import type { HevyWorkout } from "./hevy";
import { e1rm } from "./training";
import { TZ } from "./time";

export type CoachTip = { kind: "up" | "flat" | "balance" | "ok" | "warn"; title: string; body: string };

const Tips = z.object({
  tips: z.array(
    z.object({
      kind: z.enum(["up", "flat", "balance", "ok", "warn"]),
      title: z.string(),
      body: z.string(),
    }),
  ),
});

const SYSTEM = `Eres el entrenador personal de un hombre de 78 kg que busca recomposición corporal (ganar músculo y perder grasa) y mantenerse fuerte y atlético.
Su semana: lunes Push, martes Pull, miércoles rehabilitación de rodilla, jueves Push, viernes Pull.
Está recién operado de rodilla: NO le propongas ejercicios ni cargas de pierna; para la rodilla limítate a recordarle que siga las pautas de su fisioterapeuta.

Analiza sus últimos entrenos y devuelve exactamente 3 consejos breves y concretos, basados solo en los datos:
- Señala progresos reales (kind "up"), ejercicios estancados 2+ sesiones (kind "flat") con una propuesta concreta (variante, rango de reps, descarga), desequilibrios empuje/tirón por series (kind "balance"), o algo que va bien (kind "ok"). Usa "warn" para un aviso (p. ej. caída de rendimiento o mucho volumen).
- title: máximo 6 palabras. body: 1-2 frases con números de sus datos (kg, reps, series).
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

async function generate(workouts: HevyWorkout[]): Promise<CoachTip[]> {
  const client = new OpenAI();
  const res = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    instructions: SYSTEM,
    input: `Entrenos recientes (del más nuevo al más antiguo):\n${summarize(workouts)}`,
    text: { format: zodTextFormat(Tips, "consejos_entrenador") },
  });
  return (res.output_parsed?.tips ?? []).slice(0, 3);
}

/** Consejos para el estado actual. Devuelve null si no hay clave de OpenAI o falla. */
export async function coachTips(workouts: HevyWorkout[]): Promise<CoachTip[] | null> {
  if (!process.env.OPENAI_API_KEY || workouts.length === 0) return null;
  const key = workouts[0].id;
  try {
    return await unstable_cache(() => generate(workouts), ["coach-tips", key], { revalidate: 60 * 60 * 24 * 7 })();
  } catch (err) {
    console.error("Coach", err);
    return null;
  }
}
