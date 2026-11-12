"use client";

import { useState } from "react";
import { BalanceIcon, CheckIcon, FlatIcon, InfoIcon, PlayIcon } from "./icons";
import { coachTips, firstWeek, lifts, macroGoals, weeklyVolume, workout } from "@/lib/mock";
import { useStored } from "@/lib/useStored";

type Meal = { name: string; p: number; c: number; g: number };

const kcalOf = (p: number, c: number, g: number) => p * 4 + c * 4 + g * 9;
const fmt = (n: number) => n.toLocaleString("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions);
const toNum = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : Math.round(n);
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function EntrenoScreen() {
  const goals = macroGoals.training;
  const [meals, setMeals] = useStored<Meal[]>(`comidas-${todayKey()}`, []);
  const [form, setForm] = useState({ name: "", p: "", c: "", g: "" });

  const eaten = meals.reduce(
    (a, m) => ({ p: a.p + m.p, c: a.c + m.c, g: a.g + m.g }),
    { p: 0, c: 0, g: 0 },
  );
  const kGoal = kcalOf(goals.p, goals.c, goals.g);
  const kEaten = kcalOf(eaten.p, eaten.c, eaten.g);
  const kPct = Math.min(100, Math.round((kEaten / kGoal) * 100));
  const formKcal = kcalOf(toNum(form.p), toNum(form.c), toNum(form.g));

  const macroRows = [
    { name: "Proteína", eaten: eaten.p, goal: goals.p },
    { name: "Carbohidratos", eaten: eaten.c, goal: goals.c },
    { name: "Grasa", eaten: eaten.g, goal: goals.g },
  ];

  function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const p = toNum(form.p), c = toNum(form.c), g = toNum(form.g);
    if (p + c + g === 0) return;
    const name = form.name.trim() || `Comida ${meals.length + 1}`;
    setMeals([...meals, { name, p, c, g }]);
    setForm({ name: "", p: "", c: "", g: "" });
  }

  const [sel, setSel] = useState(weeklyVolume.length - 1);
  const max = Math.max(...weeklyVolume) * 1.05;

  return (
    <main className="screen">
      <header className="header">
        <div className="header-titles">
          <span className="eyebrow">Recomposición · 78 kg</span>
          <h1 className="title">Entreno</h1>
        </div>
        <span className="sync"><i className="dot" style={{ background: "var(--good)" }} />Hevy · ejemplo</span>
      </header>

      {/* Entreno de hoy */}
      <section className="card" aria-labelledby="h-hoy">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="header-titles">
            <span className="label-caps">Hoy toca · {workout.time}</span>
            <h2 id="h-hoy" style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{workout.name}</h2>
          </div>
          <span className="small muted" style={{ paddingTop: 4 }}>{workout.duration}</span>
        </div>
        <div>
          {workout.exercises.map((x) => (
            <div className="row" key={x.name} style={{ padding: "12px 0" }}>
              <div className="grow" style={{ gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{x.name}</span>
                <span className="small muted">{x.last}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{x.target}</span>
                <span className="tiny muted">{x.note}</span>
              </div>
            </div>
          ))}
        </div>
        <a href="hevy://" className="btn-primary"><PlayIcon size={18} />Empezar en Hevy</a>
      </section>

      {/* Macros */}
      <section className="section" aria-labelledby="h-macros">
        <div className="section-head">
          <h2 id="h-macros" className="section-title">Macros de hoy</h2>
          <span className="small muted">Día de entreno</span>
        </div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="small muted">Te quedan</span>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em" }}>
                {fmt(Math.max(0, kGoal - kEaten))}{" "}
                <span style={{ fontSize: 17, fontWeight: 500, color: "var(--muted)" }}>kcal</span>
              </span>
            </div>
            <span className="small muted" style={{ paddingBottom: 6 }}>{fmt(kEaten)} de {fmt(kGoal)}</span>
          </div>
          <div className="bar-track" role="img" aria-label={`Has consumido el ${kPct}% de las calorías del día`}>
            <div className="bar-fill" style={{ width: `${kPct}%` }} />
          </div>
          <div className="tiles">
            {macroRows.map((m) => (
              <div className="tile" key={m.name} style={{ gap: 6 }}>
                <span className="tile-label">{m.name}</span>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{Math.max(0, m.goal - m.eaten)} g</span>
                <div className="bar-track" style={{ height: 4, background: "#4a4945" }}>
                  <div className="bar-fill" style={{ width: `${Math.min(100, Math.round((m.eaten / m.goal) * 100))}%` }} />
                </div>
                <span className="muted" style={{ fontSize: 11 }}>{m.eaten} / {m.goal} g</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <span className="label-caps">Comidas de hoy</span>
            {meals.length === 0 && <span className="small muted">Aún no has apuntado ninguna comida.</span>}
            {meals.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 36 }}>
                <span className="ellipsis" style={{ fontSize: 15, fontWeight: 500 }}>{m.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span className="small muted">{m.p}P · {m.c}C · {m.g}G · {kcalOf(m.p, m.c, m.g)} kcal</span>
                  <button
                    type="button"
                    aria-label={`Borrar ${m.name}`}
                    onClick={() => setMeals(meals.filter((_, j) => j !== i))}
                    style={{ width: 32, height: 32, border: "none", borderRadius: 8, background: "var(--card-2)", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={addMeal} style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--card-2)", borderRadius: 14, padding: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Añadir comida</span>
            <label className="field">Nombre
              <input className="input" placeholder="Ej. Merienda" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <div className="tiles">
              {([["p", "Proteína (g)"], ["c", "Carbos (g)"], ["g", "Grasa (g)"]] as const).map(([k, label]) => (
                <label className="field" key={k}>{label}
                  <input className="input" type="number" inputMode="decimal" min="0" placeholder="0" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </label>
              ))}
            </div>
            <button className="btn-primary" type="submit" disabled={formKcal === 0} style={{ minHeight: 44, fontSize: 15 }}>
              Añadir · {formKcal} kcal
            </button>
          </form>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", borderTop: "1px solid var(--line)", paddingTop: 14, color: "var(--muted)" }}>
            <InfoIcon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span className="small" style={{ lineHeight: 1.45 }}>Antes de entrenar: 60–80 g de carbohidratos. Después: unos 40 g de proteína.</span>
          </div>
        </div>
      </section>

      {/* Progreso */}
      <section className="section" aria-labelledby="h-prog">
        <div className="section-head">
          <h2 id="h-prog" className="section-title">Progreso</h2>
          <a href="#" className="section-link">Historial</a>
        </div>
        <div className="tiles">
          <div className="tile outlined"><span style={{ fontSize: 20, fontWeight: 700 }}>11</span><span className="tile-label">Entrenos mes</span></div>
          <div className="tile outlined"><span style={{ fontSize: 20, fontWeight: 700 }}>78,2 kg</span><span className="tile-label">−0,3 / semana</span></div>
          <div className="tile outlined"><span style={{ fontSize: 20, fontWeight: 700 }}>3</span><span className="tile-label">Récords mes</span></div>
        </div>
        <div className="card" style={{ padding: "18px 16px 14px", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="small muted">
                Volumen semanal · {sel === weeklyVolume.length - 1 ? "esta semana" : `semana ${firstWeek + sel}`}
              </span>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {weeklyVolume[sel].toLocaleString("es-ES")} t
              </span>
            </div>
            <span className="tiny muted">+14% en 8 semanas</span>
          </div>
          <div className="chart">
            {weeklyVolume.map((v, i) => (
              <button
                key={i}
                aria-pressed={i === sel}
                aria-label={`Semana ${firstWeek + i}: ${v.toLocaleString("es-ES")} toneladas`}
                onClick={() => setSel(i)}
              >
                <span style={{ height: `${(v / max) * 100}%` }} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
            <span>S{firstWeek}</span><span>S{firstWeek + weeklyVolume.length - 1}</span>
          </div>
        </div>
        <div className="list">
          {lifts.map((l) => (
            <div className="row" key={l.name} style={{ padding: "12px 0" }}>
              <div className="grow" style={{ gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{l.name}</span>
                <span className="small muted">{l.best}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{l.e1rm}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: l.up ? "var(--good)" : "var(--warn)" }}>{l.trend}</span>
              </div>
            </div>
          ))}
        </div>
        <span className="footnote">1RM estimado a partir de tus series en Hevy</span>
      </section>

      {/* Entrenador */}
      <section className="section" aria-labelledby="h-coach">
        <h2 id="h-coach" className="section-title">Tu entrenador</h2>
        {coachTips.map((t) => (
          <div className="tip" key={t.title}>
            <span className="tip-icon">
              {t.kind === "flat" && <FlatIcon size={18} style={{ color: "var(--warn)" }} />}
              {t.kind === "balance" && <BalanceIcon size={18} style={{ color: "var(--google)" }} />}
              {t.kind === "ok" && <CheckIcon size={18} strokeWidth={2} style={{ color: "var(--good)" }} />}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{t.title}</span>
              <span className="tip-body">{t.body}</span>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
