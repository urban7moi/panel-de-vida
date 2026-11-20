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
  "machine plates": "Máquina de discos",
  "plate loaded": "Máquina de discos",
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
  "seated cable row - v grip": "Remo sentado en polea agarre en V",
  "seated cable row - bar grip": "Remo sentado en polea con barra",
  "lat pulldown - wide grip": "Jalón al pecho agarre abierto",
  "reverse grip lat pulldown": "Jalón al pecho agarre supino",
  "single arm lat pulldown": "Jalón a una mano",
  "single arm cable row": "Remo a una mano en polea",
  "iso-lateral chest press": "Press de pecho unilateral",
  "iso-lateral high row": "Remo alto unilateral",
  "iso-lateral low row": "Remo bajo unilateral",
  "seated shoulder press": "Press de hombros sentado",
  "ez bar biceps curl": "Curl de bíceps con barra Z",
  "seated incline curl": "Curl inclinado sentado",
  "incline dumbbell press": "Press inclinado con mancuernas",
  "dumbbell fly": "Aperturas con mancuernas",
  "low cable fly crossovers": "Cruces en polea baja",
  "high cable fly crossovers": "Cruces en polea alta",
  "rope cable curl": "Curl con cuerda en polea",
  "cable curl": "Curl en polea",
  "rope face pull": "Face pull con cuerda",
  "triceps rope extension": "Extensión de tríceps con cuerda",
  "single arm triceps pushdown": "Extensión de tríceps a una mano",
  "jm press": "Press JM",
  "landmine press": "Press landmine",
  "inverted row": "Remo invertido",
  "meadows rows": "Remo Meadows",
  "rack pull": "Rack pull",
  "good morning": "Buenos días",
  "farmers walk": "Paseo del granjero",
  "wall sit": "Sentadilla isométrica en pared",
  "step up": "Subida al cajón",
  "terminal knee extension": "Extensión terminal de rodilla",
  "straight leg raise": "Elevación de pierna recta",
  "side plank": "Plancha lateral",
  "dead bug": "Dead bug",
  "bird dog": "Bird dog",
};

const norm = (t: string) => t.toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim();

/** Traducción por diccionario; si el ejercicio o el material no están, devuelve null (lo traduce la IA). */
function fromDictionary(title: string): string | null {
  const m = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const es = BASE[norm(m ? m[1] : title)];
  if (!es) return null;
  if (!m) return es;
  const eqEs = EQUIPMENT[norm(m[2])];
  return eqEs ? `${es} (${eqEs})` : null;
}

const Translations = z.object({ items: z.array(z.object({ n: z.number(), es: z.string() })) });

/** Traduce con la IA. Va numerado para no depender de que repita el nombre exacto. */
async function translateWithAI(names: string[]): Promise<Record<string, string>> {
  const client = new OpenAI();
  const res = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    instructions:
      'Traduce al castellano de España nombres de ejercicios de gimnasio, con el nombre que se usa en los gimnasios de España. Traduce también el material entre paréntesis (Barbell = Barra, Dumbbell = Mancuernas, Cable = Polea, Machine = Máquina, Smith Machine = Multipower, Bodyweight = Peso corporal, Weighted = Con lastre). Si un nombre ya está en castellano, déjalo igual. Devuelve un elemento por línea con su número en "n" y la traducción en "es".',
    input: names.map((n, i) => `${i + 1}. ${n}`).join("\n"),
    text: { format: zodTextFormat(Translations, "traducciones") },
  });
  const out: Record<string, string> = {};
  for (const item of res.output_parsed?.items ?? []) {
    const original = names[item.n - 1];
    if (original && item.es.trim()) out[original] = item.es.trim();
  }
  return out;
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
      const ai = await unstable_cache(() => translateWithAI(sorted), ["exercise-names-v2", ...sorted], {
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
