import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { isLoggedIn } from "@/lib/api-auth";

export const maxDuration = 60;

const Estimate = z.object({
  is_food: z.boolean(),
  name: z.string(),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  confidence: z.enum(["alta", "media", "baja"]),
  notes: z.string(),
});

const SYSTEM = `Eres un nutricionista que estima calorías y macros a partir de fotos de comida.
- Identifica los alimentos y estima la ración por el tamaño del plato, los cubiertos y el envase.
- Si la foto es una etiqueta nutricional, usa sus datos y asume una ración salvo que la nota diga otra cantidad.
- Ten en cuenta aceite, salsas y guarniciones visibles, que suelen subestimarse.
- Da números redondeados (kcal a la decena, macros al gramo) y coherentes: kcal ≈ 4·proteína + 4·carbohidratos + 9·grasa.
- "name": nombre corto en español (p. ej. "Pollo con arroz y ensalada").
- "notes": una frase breve con lo que has supuesto (ración, aceite...). En español.
- Si la imagen no muestra comida ni una etiqueta, is_food = false y el resto a 0.`;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Media = (typeof ALLOWED)[number];

export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Falta configurar OPENAI_API_KEY en Vercel para estimar comidas por foto." },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("image");
  const note = String(form.get("note") ?? "").slice(0, 300);
  if (!(file instanceof File)) return NextResponse.json({ error: "No llegó ninguna foto." }, { status: 400 });
  if (!ALLOWED.includes(file.type as Media)) {
    return NextResponse.json({ error: "Formato no admitido. Usa JPG o PNG." }, { status: 400 });
  }
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  const client = new OpenAI();
  try {
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: SYSTEM,
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_url: `data:${file.type};base64,${data}`, detail: "auto" },
            {
              type: "input_text",
              text: note ? `Estima las calorías y macros. Nota del usuario: ${note}` : "Estima las calorías y macros.",
            },
          ],
        },
      ],
      text: { format: zodTextFormat(Estimate, "estimacion_comida") },
    });

    const est = response.output_parsed;
    if (!est) {
      return NextResponse.json({ error: "No he podido analizar la foto. Prueba con otra." }, { status: 422 });
    }
    if (!est.is_food) {
      return NextResponse.json({ error: "No veo comida en la foto. Prueba con otra." }, { status: 422 });
    }
    const r = (n: number) => Math.max(0, Math.round(n));
    return NextResponse.json({
      name: est.name,
      kcal: Math.round(Math.max(0, est.kcal) / 10) * 10,
      p: r(est.protein_g),
      c: r(est.carbs_g),
      g: r(est.fat_g),
      confidence: est.confidence,
      notes: est.notes,
    });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "Demasiadas peticiones o sin saldo en OpenAI. Revisa tu cuenta." }, { status: 429 });
    }
    if (err instanceof OpenAI.AuthenticationError) {
      return NextResponse.json({ error: "La clave de OpenAI no es válida." }, { status: 502 });
    }
    if (err instanceof OpenAI.APIError) {
      console.error("OpenAI", err.status, err.message);
      return NextResponse.json({ error: "Error al analizar la foto. Prueba de nuevo." }, { status: 502 });
    }
    throw err;
  }
}
