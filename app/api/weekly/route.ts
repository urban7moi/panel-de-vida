import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { isLoggedIn } from "@/lib/api-auth";

export const maxDuration = 60;

const Summary = z.object({
  headline: z.string(),
  wins: z.array(z.string()),
  improve: z.array(z.string()),
  goals: z.array(z.string()),
});

const SYSTEM = `Eres a la vez entrenador, nutricionista y coach de hábitos de un hombre que hace recomposición en mantenimiento (ganar músculo sin bajar de peso) y que se está recuperando de una operación de rodilla.
Con los datos de su semana (de lunes a domingo; puede que aún no haya terminado), escribe un resumen breve y muy visual:
- "headline": una frase de 12 palabras como mucho que resuma la semana.
- "wins": 2-3 logros concretos con números (entrenos, récords, proteína, tareas...).
- "improve": 1-2 cosas a mejorar, con el dato que lo justifica.
- "goals": exactamente 3 objetivos para la semana que empieza, concretos y medibles (p. ej. "Llegar a 170 g de proteína al menos 5 días").
Cada frase, 20 palabras como mucho. Solo con lo que digan los datos: si falta un dato, no lo inventes. Nada de consejos médicos sobre la rodilla más allá de seguir al fisio. Español de España, sin emojis.`;

export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Falta configurar OPENAI_API_KEY en Vercel." }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.data !== "string" || body.data.length > 6000) {
    return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  }
  const client = new OpenAI();
  try {
    const res = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: SYSTEM,
      input: body.data,
      text: { format: zodTextFormat(Summary, "resumen_semanal") },
    });
    const s = res.output_parsed;
    if (!s) return NextResponse.json({ error: "No he podido hacer el resumen. Prueba de nuevo." }, { status: 422 });
    return NextResponse.json({ headline: s.headline, wins: s.wins.slice(0, 3), improve: s.improve.slice(0, 2), goals: s.goals.slice(0, 3) });
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      console.error("Semana", err.status, err.message);
      return NextResponse.json({ error: "Error al preparar el resumen." }, { status: 502 });
    }
    throw err;
  }
}
