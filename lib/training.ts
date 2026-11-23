// Calcula todo lo que muestra la pantalla Entreno a partir de los datos reales de Hevy.
import type { HevyRoutine, HevySet, HevyWorkout } from "./hevy";
import { TZ } from "./time";

// --- Calendario semanal ----------------------------------------------------

export type SessionKind = "push" | "pull" | "legs" | "rehab" | "rest";

import { DEFAULT_SETTINGS, isGymPlan, planForWeekday, type Settings } from "./settings";
import { dateFromKey } from "./agenda";
import { weekStreak } from "./streaks";
const KIND_LABEL: Record<SessionKind, string> = { push: "Push", pull: "Pull", legs: "Pierna", rehab: "Rehabilitación de rodilla", rest: "Descanso" };
const DAY_NAME = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const KEYWORDS: Record<"push" | "pull" | "legs" | "rehab", RegExp> = {
  push: /\b(push|empuje)\b/i,
  pull: /\b(pull|tir[oó]n)\b/i,
  legs: /\b(pierna|piernas|legs?|lower|tren inferior)\b/i,
  rehab: /(rodilla|rehab)/i,
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
export type CategoryKey = "push" | "pull" | "legs";
export type CategoryProgress = {
  key: CategoryKey;
  label: string;
  /** Una por sesión: fuerza media respecto a la primera sesión (100 = igual). */
  sessions: { date: string; label: string; index: number; thisWeek: boolean; best: string }[];
  change: number; // % de la última sesión frente a la primera
  movers: { name: string; from: number; to: number }[]; // ejercicios que más han cambiado (1RM, kg)
};
export type TrainingData = {
  session: TodaySession;
  stats: { workoutsMonth: number; weekDone: number; weekPlanned: number; prsMonth: number; weekStreak: number };
  categories: CategoryProgress[];
  lifts: Lift[];
  lastWorkout: { id: string; title: string; date: string } | null;
};

// --- Sesión de hoy -------------------------------------------------------------

function findRoutine(routines: HevyRoutine[], kind: "push" | "pull" | "legs" | "rehab", workouts: HevyWorkout[]) {
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

  const trainedDays = new Set(workouts.map((w) => madridDateKey(new Date(w.start_time))));
  // Esta semana: entrenos hechos frente a los programados (de lunes a domingo).
  const todayKey = madridDateKey(now);
  const mon = new Date(mondayKey(now) + "T12:00:00Z");
  let weekPlanned = 0;
  let weekDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setUTCDate(mon.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    if (isGymPlan(planForWeekday(settings, d.getUTCDay()))) weekPlanned++;
    if (trainedDays.has(key) && key <= todayKey) weekDone++;
  }
  const last = workouts[0];
  return {
    session: todaySession(routines, workouts, settings),
    stats: {
      workoutsMonth,
      weekDone,
      weekPlanned,
      prsMonth,
      weekStreak: weekStreak(
        madridDateKey(now),
        (day) => isGymPlan(planForWeekday(settings, dateFromKey(day).getDay())),
        (day) => trainedDays.has(day),
      ),
    },
    categories: categoryProgress(workouts, routines, madridDateKey(now)),
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


// --- Progreso por tipo de sesión (Push, Pull, Pierna) ---

const CATEGORY_LABEL: Record<CategoryKey, string> = { push: "Push", pull: "Pull", legs: "Pierna" };

function categoryOf(w: HevyWorkout, routines: HevyRoutine[]): CategoryKey | null {
  const title = (w.routine_id && routines.find((r) => r.id === w.routine_id)?.title) || w.title;
  for (const k of ["push", "pull", "legs"] as const) if (KEYWORDS[k].test(title)) return k;
  return null;
}

export function categoryProgress(workouts: HevyWorkout[], routines: HevyRoutine[], today: string): CategoryProgress[] {
  const monday = (() => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const byCat = new Map<CategoryKey, HevyWorkout[]>();
  for (const w of [...workouts].sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    const k = categoryOf(w, routines);
    if (k) byCat.set(k, [...(byCat.get(k) ?? []), w]);
  }

  const out: CategoryProgress[] = [];
  for (const k of ["push", "pull", "legs"] as const) {
    const list = (byCat.get(k) ?? []).slice(-12);
    if (list.length < 1) continue;
    const baseline: Record<string, number> = {};
    const first: Record<string, { name: string; v: number }> = {};
    const last: Record<string, { name: string; v: number }> = {};
    const sessions = list.map((w) => {
      let sumNow = 0;
      let sumBase = 0;
      let bestEx = { name: "", v: 0 };
      for (const e of w.exercises) {
        const top = Math.max(0, ...e.sets.filter(isWorking).map(e1rm));
        if (!top) continue;
        const id = e.exercise_template_id;
        baseline[id] ??= top;
        first[id] ??= { name: e.title, v: top };
        last[id] = { name: e.title, v: top };
        // Cada ejercicio cuenta según los kilos que mueve: los pequeños no inflan el resultado.
        sumNow += top;
        sumBase += baseline[id];
        if (top > bestEx.v) bestEx = { name: e.title, v: top };
      }
      const date = madridDateKey(new Date(w.start_time));
      return {
        date,
        label: new Date(date + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(/\./g, ""),
        index: sumBase ? Math.round((sumNow / sumBase) * 1000) / 10 : 100,
        thisWeek: date >= monday,
        best: bestEx.v ? `${bestEx.name}: 1RM ${Math.round(bestEx.v)} kg` : "",
      };
    });
    const movers = Object.keys(last)
      .filter((id) => first[id].v !== last[id].v)
      .map((id) => ({ name: last[id].name, from: Math.round(first[id].v), to: Math.round(last[id].v) }))
      .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
      .slice(0, 3);
    out.push({
      key: k,
      label: CATEGORY_LABEL[k],
      sessions,
      change: Math.round((sessions[sessions.length - 1].index - 100) * 10) / 10,
      movers,
    });
  }
  return out;
}
