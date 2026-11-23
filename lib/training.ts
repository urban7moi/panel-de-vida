// Calcula todo lo que muestra la pantalla Entreno a partir de los datos reales de Hevy.
import type { HevyRoutine, HevySet, HevyWorkout } from "./hevy";
import { TZ } from "./time";

// --- Calendario semanal ----------------------------------------------------

export type SessionKind = "push" | "pull" | "rehab" | "rest";

/** Lunes Push, martes Pull, miércoles rehabilitación de rodilla, jueves Push, viernes Pull. */
import { DEFAULT_SETTINGS, planForWeekday, type Settings } from "./settings";
const KIND_LABEL: Record<SessionKind, string> = { push: "Push", pull: "Pull", rehab: "Rehabilitación de rodilla", rest: "Descanso" };
const DAY_NAME = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const KEYWORDS: Record<"push" | "pull" | "rehab", RegExp> = {
  push: /\b(push|empuje)\b/i,
  pull: /\b(pull|tir[oó]n)\b/i,
  rehab: /(rodilla|rehab|pierna|leg)/i,
};

function madridWeekday(d = new Date()) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

function madridDateKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

// --- Cálculos sobre series ---------------------------------------------------

const isWorking = (s: HevySet) => s.type !== "warmup";
/** 1RM estimado (Epley). Solo con peso y entre 1 y 15 repeticiones. */
export function e1rm(s: HevySet) {
  if (!s.weight_kg || !s.reps || s.reps > 15 || s.reps < 1) return 0;
  return s.weight_kg * (1 + s.reps / 30);
}
const kg = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })} kg`;
const setLabel = (s: HevySet) => (s.weight_kg ? `${kg(s.weight_kg)} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`);

function bestSet(sets: HevySet[]) {
  return sets.filter(isWorking).reduce<HevySet | null>((best, s) => {
    if (!best) return s;
    const a = e1rm(s) || (s.reps ?? 0) / 100;
    const b = e1rm(best) || (best.reps ?? 0) / 100;
    return a > b ? s : best;
  }, null);
}

// --- Tipos que consume la interfaz ------------------------------------------

export type PlannedExercise = { name: string; last: string; target: string; note: string };
export type TodaySession = {
  kind: SessionKind;
  label: string;
  when: string; // "Hoy" o "El jueves"
  routineTitle: string | null;
  routineId: string | null;
  exercises: PlannedExercise[];
};
export type Lift = { name: string; best: string; e1rm: string; trend: string; up: boolean | null };
export type TrainingData = {
  session: TodaySession;
  stats: { workoutsMonth: number; volumeWeek: string; prsMonth: number };
  weeklyVolume: { label: string; tonnes: number }[];
  lifts: Lift[];
  lastWorkout: { id: string; title: string; date: string } | null;
};

// --- Sesión de hoy -------------------------------------------------------------

function findRoutine(routines: HevyRoutine[], kind: "push" | "pull" | "rehab", workouts: HevyWorkout[]) {
  const matches = routines.filter((r) => KEYWORDS[kind].test(r.title));
  if (matches.length <= 1) return matches[0] ?? null;
  // Si hay varias (Push A / Push B), toca la que hace más tiempo que no haces.
  const lastDone = (id: string) => workouts.find((w) => w.routine_id === id)?.start_time ?? "";
  return [...matches].sort((a, b) => lastDone(a.id).localeCompare(lastDone(b.id)))[0];
}

function plan(routine: HevyRoutine, workouts: HevyWorkout[]): PlannedExercise[] {
  return [...routine.exercises]
    .sort((a, b) => a.index - b.index)
    .map((ex) => {
      const work = ex.sets.filter(isWorking);
      const targetReps = Math.max(0, ...work.map((s) => s.rep_range?.end ?? s.reps ?? 0));
      const prev = workouts.find((w) => w.exercises.some((e) => e.exercise_template_id === ex.exercise_template_id));
      const prevSets = prev?.exercises.find((e) => e.exercise_template_id === ex.exercise_template_id)?.sets.filter(isWorking) ?? [];
      const top = bestSet(prevSets);

      if (!top) {
        const w = work[0]?.weight_kg;
        return {
          name: ex.title,
          last: "Sin registros aún",
          target: `${work.length} × ${targetReps || "?"}${w ? ` · ${kg(w)}` : ""}`,
          note: "Primera vez",
        };
      }
      const reps = targetReps || top.reps || 0;
      const allHit = reps > 0 && prevSets.every((s) => (s.reps ?? 0) >= reps);
      const step = (top.weight_kg ?? 0) >= 40 ? 2.5 : 1;
      const nextW = top.weight_kg ? (allHit ? top.weight_kg + step : top.weight_kg) : null;
      return {
        name: ex.title,
        last: `Última: ${prevSets.length} × ${setLabel(top)}`,
        target: nextW ? `${work.length || prevSets.length} × ${allHit ? reps : (top.reps ?? 0) + 1} · ${kg(nextW)}` : `${work.length} × ${(top.reps ?? 0) + 1}`,
        note: !top.weight_kg ? "+1 rep" : allHit ? `+${kg(step)}` : "+1 rep",
      };
    });
}

function todaySession(routines: HevyRoutine[], workouts: HevyWorkout[], settings: Settings): TodaySession {
  const WEEK = (d: number) => planForWeekday(settings, d);
  const today = madridWeekday();
  let offset = 0;
  let kind = WEEK(today);
  // En días de descanso enseñamos la próxima sesión.
  while (kind === "rest" && offset < 7) {
    offset++;
    kind = WEEK((today + offset) % 7);
  }
  const when = offset === 0 ? "Hoy" : offset === 1 ? "Mañana" : `El ${DAY_NAME[(today + offset) % 7]}`;
  const routine = kind === "rest" ? null : findRoutine(routines, kind, workouts);
  return {
    kind,
    label: KIND_LABEL[kind],
    when,
    routineTitle: routine?.title ?? null,
    routineId: routine?.id ?? null,
    exercises: routine && kind !== "rehab" ? plan(routine, workouts) : routine ? routine.exercises.map((e) => ({ name: e.title, last: "", target: `${e.sets.length} series`, note: "" })) : [],
  };
}

// --- Progreso --------------------------------------------------------------------

function mondayKey(d: Date) {
  const local = new Date(madridDateKey(d) + "T12:00:00Z");
  const dow = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - dow);
  return local.toISOString().slice(0, 10);
}

function volumeOf(w: HevyWorkout) {
  return w.exercises.reduce(
    (t, e) => t + e.sets.filter(isWorking).reduce((s, x) => s + (x.weight_kg ?? 0) * (x.reps ?? 0), 0),
    0,
  );
}

export function buildTraining(routines: HevyRoutine[], workouts: HevyWorkout[], settings: Settings = DEFAULT_SETTINGS): TrainingData {
  const now = new Date();

  // Volumen por semana (8 semanas, de la más antigua a la actual)
  const weeks: string[] = [];
  const thisMonday = new Date(mondayKey(now) + "T12:00:00Z");
  for (let i = 7; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  const vol: Record<string, number> = Object.fromEntries(weeks.map((w) => [w, 0]));
  for (const w of workouts) {
    const k = mondayKey(new Date(w.start_time));
    if (k in vol) vol[k] += volumeOf(w);
  }
  const weeklyVolume = weeks.map((k) => ({
    label: new Date(k + "T12:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }),
    tonnes: Math.round(vol[k] / 100) / 10,
  }));

  // Entrenos y récords del mes
  const monthKey = madridDateKey(now).slice(0, 7);
  const inMonth = (iso: string) => madridDateKey(new Date(iso)).slice(0, 7) === monthKey;
  const workoutsMonth = workouts.filter((w) => inMonth(w.start_time)).length;

  let prsMonth = 0;
  const best: Record<string, number> = {};
  for (const w of [...workouts].reverse()) {
    for (const e of w.exercises) {
      const top = Math.max(0, ...e.sets.filter(isWorking).map(e1rm));
      if (!top) continue;
      const prev = best[e.exercise_template_id];
      if (prev && top > prev + 0.01 && inMonth(w.start_time)) prsMonth++;
      if (!prev || top > prev) best[e.exercise_template_id] = top;
    }
  }

  // Ejercicios principales: los 4 con más series en las últimas 8 semanas
  const day = 24 * 3600_000;
  const recent = workouts.filter((w) => now.getTime() - new Date(w.start_time).getTime() < 56 * day);
  const count: Record<string, { name: string; n: number }> = {};
  for (const w of recent)
    for (const e of w.exercises) {
      const n = e.sets.filter((s) => isWorking(s) && s.weight_kg).length;
      if (!n) continue;
      count[e.exercise_template_id] ??= { name: e.title, n: 0 };
      count[e.exercise_template_id].n += n;
    }
  const top4 = Object.entries(count)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 4);

  const lifts: Lift[] = top4.map(([id, { name }]) => {
    const window = (from: number, to: number) =>
      workouts
        .filter((w) => {
          const age = now.getTime() - new Date(w.start_time).getTime();
          return age >= from * day && age < to * day;
        })
        .flatMap((w) => w.exercises.filter((e) => e.exercise_template_id === id).flatMap((e) => e.sets.filter(isWorking)));
    const cur = window(0, 28);
    const prev = window(28, 90);
    const curBest = bestSet(cur.length ? cur : prev);
    const a = Math.max(0, ...cur.map(e1rm));
    const b = Math.max(0, ...prev.map(e1rm));
    const diff = Math.round(a - b);
    return {
      name,
      best: curBest ? `Mejor: ${setLabel(curBest)}` : "",
      e1rm: a || b ? `1RM ${Math.round(a || b)} kg` : "",
      trend: !a
        ? "Sin hacerlo en 4 sem"
        : !b
          ? "Primeras semanas"
          : Math.abs(diff) < 1
            ? "Sin cambios vs. antes"
            : `${diff > 0 ? "+" : ""}${diff} kg vs. antes`,
      up: !a || !b ? null : Math.abs(diff) < 1 ? false : diff > 0,
    };
  });

  const last = workouts[0];
  return {
    session: todaySession(routines, workouts, settings),
    stats: {
      workoutsMonth,
      volumeWeek: `${weeklyVolume.at(-1)!.tonnes.toLocaleString("es-ES")} t`,
      prsMonth,
    },
    weeklyVolume,
    lifts,
    lastWorkout: last
      ? { id: last.id, title: last.title, date: new Date(last.start_time).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }) }
      : null,
  };
}

// --- Resumen de entrenos por día (para marcar como hecho en Hoy y en el calendario) ---

export type WorkoutDay = { date: string; title: string; minutes: number; tonnes: number; sets: number; prs: number };

export function workoutDays(workouts: HevyWorkout[]): WorkoutDay[] {
  const best: Record<string, number> = {};
  const byDay = new Map<string, WorkoutDay>();
  for (const w of [...workouts].sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    let prs = 0;
    let sets = 0;
    for (const e of w.exercises) {
      const work = e.sets.filter(isWorking);
      sets += work.length;
      const top = Math.max(0, ...work.map(e1rm));
      const prev = best[e.exercise_template_id];
      if (top && prev && top > prev + 0.01) prs++;
      if (top && (!prev || top > prev)) best[e.exercise_template_id] = top;
    }
    const date = madridDateKey(new Date(w.start_time));
    const minutes = Math.max(0, Math.round((new Date(w.end_time).getTime() - new Date(w.start_time).getTime()) / 60000));
    const prevDay = byDay.get(date);
    const tonnes = volumeOf(w) / 1000;
    byDay.set(
      date,
      prevDay
        ? { date, title: `${prevDay.title} + ${w.title}`, minutes: prevDay.minutes + minutes, tonnes: prevDay.tonnes + tonnes, sets: prevDay.sets + sets, prs: prevDay.prs + prs }
        : { date, title: w.title, minutes, tonnes, sets, prs },
    );
  }
  return [...byDay.values()].map((d) => ({ ...d, tonnes: Math.round(d.tonnes * 10) / 10 }));
}
