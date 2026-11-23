"use client";

import { useEffect, useState } from "react";
import { useStored } from "@/lib/useStored";
import { addDays, dateFromKey, mondayOf, type Task } from "@/lib/agenda";
import { goalsFor, isGymPlan, planForWeekday, type Settings } from "@/lib/settings";
import { mergeWeights, weeklyTrend, type WeightPoint } from "@/lib/weight";
import type { WorkoutDay } from "@/lib/training";
import { CheckIcon, SparkIcon } from "./icons";

type Meal = { kcal: number; p: number };
type Report = { headline: string; wins: string[]; improve: string[]; goals: string[]; at: string };
type RehabSession = { done: string[]; pain: number | null; flex: number | null };

/** Resumen de los últimos 7 días con la IA: logros, a mejorar y 3 objetivos. */
export default function WeeklySummary({
  today,
  settings,
  getTasks,
  doneWorkouts,
}: {
  today: string;
  settings: Settings;
  getTasks: (key: string) => Task[];
  doneWorkouts: Record<string, WorkoutDay>;
}) {
  const [meals] = useStored<Record<string, Meal[]>>("comidas-v2", {});
  const [water] = useStored<Record<string, number>>("agua", {});
  const [manualWeights] = useStored<Record<string, number>>("peso", {});
  const [rehab] = useStored<{ sessions?: Record<string, RehabSession> }>("rodilla", {});
  const [reports, setReports] = useStored<Record<string, Report>>("resumen-semanal", {});
  const [hevyWeights, setHevyWeights] = useState<WeightPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const week = mondayOf(today);
  const report = reports[week];
  const isSunday = dateFromKey(today).getDay() === 0;

  useEffect(() => {
    fetch("/api/weight")
      .then((r) => r.json())
      .then((j) => setHevyWeights(j.weights ?? []))
      .catch(() => {});
  }, []);

  /** Datos de los últimos 7 días en texto, para la IA. */
  function buildData() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const lines: string[] = [];
    let tasksTotal = 0;
    let tasksDone = 0;
    let planned = 0;
    let trained = 0;
    let tonnes = 0;
    let prs = 0;
    let proteinOk = 0;
    const kcal: number[] = [];
    const prot: number[] = [];
    for (const d of days) {
      const ts = getTasks(d);
      tasksTotal += ts.length;
      tasksDone += ts.filter((t) => t.done).length;
      const gym = isGymPlan(planForWeekday(settings, dateFromKey(d).getDay()));
      if (gym) planned++;
      const w = doneWorkouts[d];
      if (w) {
        trained++;
        tonnes += w.tonnes;
        prs += w.prs;
      }
      const list = meals[d] ?? [];
      if (list.length) {
        const k = list.reduce((a, m) => a + m.kcal, 0);
        const p = list.reduce((a, m) => a + m.p, 0);
        kcal.push(k);
        prot.push(p);
        if (p >= goalsFor(settings, gym).p * 0.9) proteinOk++;
      }
    }
    const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
    const g = goalsFor(settings, true);
    lines.push(`Semana del ${days[0]} al ${days[6]}.`);
    lines.push(`Entrenos: ${trained} hechos de ${planned} programados; volumen total ${tonnes.toFixed(1)} t; ${prs} récords.`);
    lines.push(`Tareas: ${tasksDone} de ${tasksTotal} completadas.`);
    lines.push(
      kcal.length
        ? `Comida apuntada ${kcal.length} de 7 días: media ${avg(kcal)} kcal (objetivo ~${g.kcal}) y ${avg(prot)} g de proteína (objetivo ${g.p} g); llegó a la proteína ${proteinOk} días.`
        : "No apuntó comidas esta semana.",
    );
    const waterDays = days.map((d) => water[d] ?? 0).filter((n) => n > 0);
    if (waterDays.length) lines.push(`Agua: media de ${(avg(waterDays) * 0.25).toFixed(1)} L los días que la apuntó (objetivo ${(settings.waterGlasses * 0.25).toFixed(1)} L).`);
    const weights = mergeWeights(hevyWeights, manualWeights);
    const trend = weeklyTrend(weights, today);
    const wk = weights.filter((p) => p.date >= days[0]);
    if (wk.length) lines.push(`Peso: de ${wk[0].kg} kg a ${wk[wk.length - 1].kg} kg${trend !== null ? `; tendencia ${trend.toFixed(2)} kg/semana` : ""}.`);
    const rs = days.map((d) => rehab.sessions?.[d]).filter((s): s is RehabSession => !!s && (s.pain !== null || s.done.length > 0));
    if (rs.length) {
      const pains = rs.map((s) => s.pain).filter((p): p is number => p !== null);
      const flex = rs.map((s) => s.flex).filter((f): f is number => f !== null);
      lines.push(
        `Rodilla: ${rs.length} sesiones de rehabilitación${pains.length ? `; dolor de ${pains[0]} a ${pains[pains.length - 1]} sobre 10` : ""}${flex.length ? `; flexión ${flex[flex.length - 1]}°` : ""}.`,
      );
    }
    return lines.join("\n");
  }

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/weekly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: buildData() }),
      });
      const j = await res.json().catch(() => ({ error: "Respuesta no válida del servidor." }));
      if (!res.ok) throw new Error(j.error ?? "No se pudo hacer el resumen.");
      setReports((all) => {
        const keep = Object.fromEntries(Object.entries(all).filter(([k]) => k >= addDays(week, -56)));
        return { ...keep, [week]: { ...j, at: today } };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo hacer el resumen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section" aria-labelledby="h-semana-res">
      <div className="section-head">
        <h2 id="h-semana-res" className="section-title">Tu semana</h2>
        {report && !loading && <button type="button" className="link-btn" onClick={generate}>Actualizar</button>}
      </div>
      {loading ? (
        <div className="card nutri-loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span style={{ fontSize: 16, fontWeight: 600 }}>Repasando tu semana</span>
          <span className="small muted">Entrenos, comida, peso, tareas y rodilla…</span>
        </div>
      ) : report ? (
        <div className="card" style={{ gap: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>{report.headline}</span>
          <div className="week-block">
            <span className="label-caps" style={{ color: "var(--good)" }}>Logros</span>
            {report.wins.map((w, i) => <span key={i} className="week-line"><CheckIcon size={14} strokeWidth={2.5} style={{ color: "var(--good)", flexShrink: 0, marginTop: 3 }} />{w}</span>)}
          </div>
          {report.improve.length > 0 && (
            <div className="week-block">
              <span className="label-caps" style={{ color: "var(--warn)" }}>A mejorar</span>
              {report.improve.map((w, i) => <span key={i} className="week-line"><span style={{ color: "var(--warn)", flexShrink: 0 }}>•</span>{w}</span>)}
            </div>
          )}
          <div className="week-block">
            <span className="label-caps" style={{ color: "var(--accent-text)" }}>Objetivos de la semana</span>
            {report.goals.map((w, i) => (
              <span key={i} className="week-line"><span className="goal-num">{i + 1}</span>{w}</span>
            ))}
          </div>
          <span className="tiny muted">Hecho el {dateFromKey(report.at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
      ) : (
        <div className={isSunday ? "card leftovers" : "card"} style={{ gap: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span className="tip-icon" style={{ color: "var(--accent)" }}><SparkIcon size={18} /></span>
            <span className="small" style={{ lineHeight: 1.5 }}>
              {isSunday ? "Es domingo: buen momento para repasar la semana." : "Repasa tus últimos 7 días:"} entrenos, comida, peso, tareas y rodilla, con 3 objetivos para la semana siguiente.
            </span>
          </div>
          <button type="button" className="btn-primary" onClick={generate}>Hacer el resumen de la semana</button>
        </div>
      )}
      {error && <p className="error" role="alert" style={{ margin: 0, fontSize: 13 }}>{error}</p>}
    </section>
  );
}
