// Traduce al castellano los nombres de ejercicio de Hevy (la API los da en inglés,
// con el formato "Bench Press (Barbell)"). Primero usa un diccionario; lo que no
// conoce lo traduce la IA una sola vez y queda guardado en caché.
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { unstable_cache } from "next/cache";
import type { HevyRoutine, HevyWorkout } from "./hevy";

const EQUIPMENT: Record<string, string> = {
  barbell: "Barra",
  dumbbell: "Mancuernas",
  cable: "Polea",
  machine: "Máquina",
  "smith machine": "Multipower",
  bodyweight: "Peso corporal",
  weighted: "Con lastre",
  band: "Banda",
  "resistance band": "Banda elástica",
  kettlebell: "Kettlebell",
  "ez bar": "Barra Z",
  assisted: "Asistida",
  plate: "Disco",
  "trap bar": "Barra hexagonal",
  "suspension": "TRX",
};

const BASE: Record<string, string> = {
  "bench press": "Press de banca",
  "incline bench press": "Press inclinado",
  "decline bench press": "Press declinado",
  "close grip bench press": "Press de banca agarre cerrado",
  "floor press": "Press en el suelo",
  "chest press": "Press de pecho",
  "incline chest press": "Press de pecho inclinado",
  "chest fly": "Aperturas",
  "incline chest fly": "Aperturas inclinadas",
  "butterfly (pec deck)": "Contractora (pec deck)",
  "pec deck": "Contractora",
  "cable fly crossovers": "Cruces en polea",
  "cable crossover": "Cruces en polea",
  "chest dip": "Fondos de pecho",
  "triceps dip": "Fondos de tríceps",
  "bench dip": "Fondos en banco",
  "dip": "Fondos",
  "push up": "Flexiones",
  "overhead press": "Press militar",
  "shoulder press": "Press de hombros",
  "seated overhead press": "Press militar sentado",
  "arnold press": "Press Arnold",
  "lateral raise": "Elevaciones laterales",
  "front raise": "Elevaciones frontales",
  "rear delt reverse fly": "Pájaros (deltoide posterior)",
  "reverse fly": "Pájaros",
  "face pull": "Face pull",
  "upright row": "Remo al mentón",
  "shrug": "Encogimientos",
  "triceps pushdown": "Extensión de tríceps en polea",
  "triceps rope pushdown": "Extensión de tríceps con cuerda",
  "triceps extension": "Extensión de tríceps",
  "overhead triceps extension": "Extensión de tríceps sobre la cabeza",
  "triceps kickback": "Patada de tríceps",
  "skullcrusher": "Press francés",
  "skull crusher": "Press francés",
  "lat pulldown": "Jalón al pecho",
  "lat pulldown - close grip": "Jalón al pecho agarre cerrado",
  "pull up": "Dominadas",
  "chin up": "Dominadas supinas",
  "bent over row": "Remo inclinado",
  "pendlay row": "Remo Pendlay",
  "seated cable row": "Remo sentado en polea",
  "seated row": "Remo sentado",
  "single arm row": "Remo a una mano",
  "dumbbell row": "Remo con mancuerna",
  "t bar row": "Remo en T",
  "chest supported incline row": "Remo con apoyo en banco inclinado",
  "iso-lateral row": "Remo unilateral",
  "straight arm lat pulldown": "Pullover en polea",
  "pullover": "Pullover",
  "bicep curl": "Curl de bíceps",
  "biceps curl": "Curl de bíceps",
  "hammer curl": "Curl martillo",
  "preacher curl": "Curl predicador",
  "concentration curl": "Curl concentrado",
  "incline curl": "Curl inclinado",
  "spider curl": "Curl araña",
  "reverse curl": "Curl invertido",
  "wrist curl": "Curl de muñeca",
  "deadlift": "Peso muerto",
  "romanian deadlift": "Peso muerto rumano",
  "back extension": "Hiperextensiones",
  "hip thrust": "Hip thrust",
  "glute bridge": "Puente de glúteos",
  "squat": "Sentadilla",
  "front squat": "Sentadilla frontal",
  "goblet squat": "Sentadilla goblet",
  "bulgarian split squat": "Sentadilla búlgara",
  "lunge": "Zancadas",
  "leg press": "Prensa",
  "leg extension": "Extensión de cuádriceps",
  "lying leg curl": "Curl femoral tumbado",
  "seated leg curl": "Curl femoral sentado",
  "leg curl": "Curl femoral",
  "calf raise": "Elevación de gemelos",
  "standing calf raise": "Elevación de gemelos de pie",
  "seated calf raise": "Elevación de gemelos sentado",
  "hip abduction": "Abductores",
  "hip adduction": "Aductores",
  "plank": "Plancha",
  "crunch": "Abdominales (crunch)",
  "cable crunch": "Crunch en polea",
  "hanging leg raise": "Elevación de piernas colgado",
  "leg raise": "Elevación de piernas",
  "russian twist": "Giros rusos",
  "ab wheel": "Rueda abdominal",
};

function fromDictionary(title: string): string | null {
  const m = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const base = (m ? m[1] : title).trim().toLowerCase();
  const eq = m ? m[2].trim().toLowerCase() : null;
  const es = BASE[base];
  if (!es) return null;
  if (!eq) return es;
  const eqEs = EQUIPMENT[eq];
  return eqEs ? `${es} (${eqEs})` : null;
}

const Translations = z.object({ items: z.array(z.object({ en: z.string(), es: z.string() })) });

async function translateWithAI(names: string[]): Promise<Record<string, string>> {
  const client = new OpenAI();
  const res = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    instructions:
      'Traduce al castellano de España nombres de ejercicios de gimnasio, con el nombre que se usa en los gimnasios de España. Mantén el material entre paréntesis traducido (Barbell = Barra, Dumbbell = Mancuernas, Cable = Polea, Machine = Máquina, Smith Machine = Multipower). Devuelve cada nombre original en "en" y su traducción en "es".',
    input: names.join("\n"),
    text: { format: zodTextFormat(Translations, "traducciones") },
  });
  return Object.fromEntries((res.output_parsed?.items ?? []).map((i) => [i.en, i.es]));
}

/** Devuelve un diccionario inglés → castellano para los nombres dados. */
export async function spanishNames(names: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(names)];
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const n of unique) {
    const es = fromDictionary(n);
    if (es) out[n] = es;
    else missing.push(n);
  }
  if (missing.length && process.env.OPENAI_API_KEY) {
    try {
      const sorted = [...missing].sort();
      const ai = await unstable_cache(() => translateWithAI(sorted), ["exercise-names-v1", ...sorted], {
        revalidate: 60 * 60 * 24 * 30,
      })();
      Object.assign(out, ai);
    } catch (err) {
      console.error("Traducción de ejercicios", err);
    }
  }
  return out;
}

/** Cambia en el sitio los nombres de ejercicio de rutinas y entrenos al castellano. */
export async function translateTraining(routines: HevyRoutine[], workouts: HevyWorkout[]) {
  const names = [...routines.flatMap((r) => r.exercises.map((e) => e.title)), ...workouts.flatMap((w) => w.exercises.map((e) => e.title))];
  const map = await spanishNames(names);
  for (const r of routines) for (const e of r.exercises) e.title = map[e.title] ?? e.title;
  for (const w of workouts) for (const e of w.exercises) e.title = map[e.title] ?? e.title;
}
