import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { isLoggedIn } from "@/lib/api-auth";

export const maxDuration = 60;

const Plan = z.object({
  summary: z.string(),
  ideas: z.array(
    z.object({
      type: z.enum(["desayuno", "comida", "merienda", "cena", "snack"]),
      name: z.string(),
      portion: z.string(),
      kcal: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      why: z.string(),
    }),
  ),
});

const SYSTEM = `Eres el nutricionista personal de un hombre de 78 kg que hace recomposición en mantenimiento: quiere ganar músculo y perder grasa sin bajar de peso. Entrena lunes y jueves Push, martes y viernes Pull, y el miércoles hace rehabilitación de rodilla (recién operado).

Tu tarea: proponerle 3 comidas concretas para lo que le queda del día, pensadas sobre todo para llegar a su objetivo de proteína sin pasarse de las calorías que le quedan.
- Usa comida normal de España, fácil de comprar en un supermercado (Mercadona, Lidl…) y rápida de preparar. Nada de suplementos raros; un batido de proteína está bien si encaja.
- Ten en cuenta lo que ya ha comido para no repetir y para que el día quede equilibrado, y la hora: si es tarde, propón cena o snack.
- Reparte la proteína que le falta entre las 3 ideas de forma realista (25–50 g por comida principal, 15–30 g por snack). Las 3 juntas no deben superar las calorías que le quedan.
- Si ya ha llegado a la proteína, propón comidas ligeras y equilibradas para cerrar el día.
- Si es día de entreno, prioriza carbohidratos alrededor del entreno (12:00); si es descanso, algo menos de carbohidratos.
- Cantidades en gramos o unidades caseras ("150 g de pechuga", "2 huevos", "1 yogur proteico").
- "name": nombre corto del plato. "portion": los ingredientes con cantidades, en una línea. "why": una frase corta de por qué se la recomiendas.
- "summary": una frase directa sobre cómo va su día (p. ej. "Te faltan 85 g de proteína y 1.100 kcal: prioriza proteína magra en la cena").
- Números redondeados y coherentes: kcal ≈ 4·proteína + 4·carbohidratos + 9·grasa.
- Español de España, sin emojis.`;

const Body = z.object({
  hour: z.string().max(5),
  gymDay: z.boolean(),
  remaining: z.object({ kcal: z.number(), p: z.number(), c: z.number(), g: z.number() }),
  goals: z.object({ kcal: z.number(), p: z.number(), c: z.number(), g: z.number() }),
  eaten: z.array(z.object({ name: z.string().max(120), type: z.string().max(20), kcal: z.number(), p: z.number() })).max(30),
  favorites: z.array(z.string().max(120)).max(12),
});

export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Falta configurar OPENAI_API_KEY en Vercel." }, { status: 503 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  const d = parsed.data;

  const input = [
    `Hora actual: ${d.hour}. ${d.gymDay ? "Hoy es día de entreno." : "Hoy es día de descanso."}`,
    `Objetivo del día: ${d.goals.kcal} kcal · ${d.goals.p} g proteína · ${d.goals.c} g carbohidratos · ${d.goals.g} g grasa.`,
    `Le queda: ${Math.max(0, d.remaining.kcal)} kcal · ${Math.max(0, d.remaining.p)} g proteína · ${Math.max(0, d.remaining.c)} g carbohidratos · ${Math.max(0, d.remaining.g)} g grasa.`,
    d.eaten.length
      ? `Ya ha comido hoy:\n${d.eaten.map((m) => `- ${m.type}: ${m.name} (${m.kcal} kcal, ${m.p} g prot.)`).join("\n")}`
      : "Todavía no ha comido nada hoy.",
    d.favorites.length ? `Comidas que suele tomar: ${d.favorites.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const client = new OpenAI();
  try {
    const res = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: SYSTEM,
      input,
      text: { format: zodTextFormat(Plan, "plan_nutricionista") },
    });
    const plan = res.output_parsed;
    if (!plan || plan.ideas.length === 0) {
      return NextResponse.json({ error: "No he podido preparar recomendaciones. Prueba de nuevo." }, { status: 422 });
    }
    const r = (n: number) => Math.max(0, Math.round(n));
    return NextResponse.json({
      summary: plan.summary,
      ideas: plan.ideas.slice(0, 3).map((i) => ({
        type: i.type,
        name: i.name,
        portion: i.portion,
        kcal: Math.round(Math.max(0, i.kcal) / 10) * 10,
        p: r(i.protein_g),
        c: r(i.carbs_g),
        g: r(i.fat_g),
        why: i.why,
      })),
    });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "Demasiadas peticiones o sin saldo en OpenAI." }, { status: 429 });
    }
    if (err instanceof OpenAI.APIError) {
      console.error("Nutri", err.status, err.message);
      return NextResponse.json({ error: "Error al preparar las recomendaciones." }, { status: 502 });
    }
    throw err;
  }
}
