// Cliente mínimo de la API oficial de Hevy (https://developers.hevy.com). Requiere Hevy Pro.
// La clave va en la variable de entorno HEVY_API_KEY y se envía en la cabecera `api-key`.

const BASE = process.env.HEVY_API_BASE || "https://api.hevyapp.com";

export type HevySet = {
  index: number;
  type: string; // normal | warmup | dropset | failure
  weight_kg: number | null;
  reps: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
};

export type HevyExercise = {
  index: number;
  title: string;
  exercise_template_id: string;
  notes?: string | null;
  sets: HevySet[];
};

export type HevyWorkout = {
  id: string;
  title: string;
  routine_id: string | null;
  start_time: string;
  end_time: string;
  exercises: HevyExercise[];
};

export type HevyRoutineSet = HevySet & { rep_range?: { start: number | null; end: number | null } | null };

export type HevyRoutine = {
  id: string;
  title: string;
  folder_id: number | null;
  exercises: (Omit<HevyExercise, "sets"> & { rest_seconds?: number | null; sets: HevyRoutineSet[] })[];
};

export class HevyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function hevyConfigured() {
  return !!process.env.HEVY_API_KEY?.trim();
}

async function hevyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "api-key": process.env.HEVY_API_KEY!.trim(), accept: "application/json" },
    // Cache de 2 minutos: la pantalla carga rápido y no gastamos el límite de peticiones.
    next: { revalidate: 120 },
  });
  if (!res.ok) throw new HevyError(`Hevy ${res.status} en ${path}`, res.status);
  return (await res.json()) as T;
}

/** Todas las rutinas (la API devuelve como máximo 10 por página). */
export async function getRoutines(): Promise<HevyRoutine[]> {
  const out: HevyRoutine[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await hevyGet<{ page_count: number; routines: HevyRoutine[] }>(`/v1/routines?page=${page}&pageSize=10`);
    out.push(...r.routines);
    if (page >= r.page_count) break;
  }
  return out;
}

/** Entrenos de los últimos `days` días, del más reciente al más antiguo. */
export async function getRecentWorkouts(days = 90): Promise<HevyWorkout[]> {
  const since = Date.now() - days * 24 * 3600_000;
  type Page = { page_count: number; workouts: HevyWorkout[] };
  const get = (page: number) => hevyGet<Page>(`/v1/workouts?page=${page}&pageSize=10`);
  const old = (p: Page) => {
    const last = p.workouts.at(-1);
    return !last || new Date(last.start_time).getTime() < since;
  };

  // La primera página dice cuántas hay; las siguientes se piden de 4 en 4 en paralelo.
  const first = await get(1);
  const out = [...first.workouts];
  const total = Math.min(first.page_count, 15);
  let reachedOld = old(first);
  for (let page = 2; page <= total && !reachedOld; page += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, total - page + 1) }, (_, i) => get(page + i)),
    );
    for (const p of batch) {
      out.push(...p.workouts);
      if (old(p)) reachedOld = true;
    }
  }
  return out
    .filter((w) => new Date(w.start_time).getTime() >= since)
    .sort((a, b) => b.start_time.localeCompare(a.start_time));
}
