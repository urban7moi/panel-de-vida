"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/lib/useSettings";
import { DEFAULT_SETTINGS, goalsFor, PLAN_INFO, type DayPlan, type Settings } from "@/lib/settings";
import DataTools from "./DataTools";
import NotifySettings from "./NotifySettings";

const DAYS: [string, string][] = [
  ["1", "L"],
  ["2", "M"],
  ["3", "X"],
  ["4", "J"],
  ["5", "V"],
  ["6", "S"],
  ["0", "D"],
];
const PLANS: DayPlan[] = ["push", "pull", "legs", "rehab", "rest"];
const fmt = (n: number) => n.toLocaleString("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions);

function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  decimals = 0,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  step: number;
  min: number;
  max: number;
  decimals?: number;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(value.toLocaleString("es-ES", { maximumFractionDigits: decimals, useGrouping: false })), [value, decimals]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Number(n.toFixed(decimals))));
  return (
    <div className="stepper">
      <button type="button" aria-label={`Bajar ${label}`} onClick={() => onChange(clamp(value - step))}>−</button>
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parseFloat(text.replace(",", "."));
          if (!isNaN(n)) onChange(clamp(n));
          else setText(String(value));
        }}
      />
      <button type="button" aria-label={`Subir ${label}`} onClick={() => onChange(clamp(value + step))}>+</button>
    </div>
  );
}

export default function AjustesScreen() {
  const [s, update] = useSettings();
  const gym = goalsFor(s, true);
  const rest = goalsFor(s, false);
  const [cloud, setCloud] = useState<"cargando" | "on" | "off">("cargando");
  useEffect(() => {
    fetch("/api/store?keys=ajustes")
      .then((r) => r.json())
      .then((j) => setCloud(j.configured ? "on" : "off"))
      .catch(() => setCloud("off"));
  }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update({ [k]: v } as Partial<Settings>);

  return (
    <main className="screen">
      <header className="header">
        <div className="header-titles">
          <span className="eyebrow">Panel de Vida</span>
          <h1 className="title">Ajustes</h1>
        </div>
        <Link href="/" className="fullcal-done" style={{ display: "inline-flex", alignItems: "center" }}>Listo</Link>
      </header>

      {/* Tus datos en la nube */}
      <section className="card" aria-label="Copia en la nube">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Copia en la nube</span>
          <span className="status-pill" style={{ color: cloud === "on" ? "var(--good)" : "var(--warn)" }}>
            <i className="dot" style={{ background: cloud === "on" ? "var(--good)" : "var(--warn)" }} />
            {cloud === "cargando" ? "Comprobando…" : cloud === "on" ? "Activada" : "Solo en este iPhone"}
          </span>
        </div>
        <span className="small muted" style={{ lineHeight: 1.5 }}>
          {cloud === "on"
            ? "Tareas, comidas, agua, peso y ajustes se guardan en la nube y se sincronizan solos."
            : "Tus datos solo están en este iPhone. Conecta la base de datos gratuita en Vercel (Storage → Upstash Redis) para no perderlos."}
        </span>
      </section>

      {/* Objetivos */}
      <section className="section" aria-labelledby="h-obj">
        <h2 id="h-obj" className="section-title">Objetivos</h2>
        <div className="list">
          <div className="set-row">
            <span className="set-label"><span style={{ fontWeight: 500 }}>Peso</span><span className="tiny muted">kg</span></span>
            <Stepper label="peso" value={s.weight} step={0.5} min={40} max={200} decimals={1} onChange={(n) => set("weight", n)} />
          </div>
          <div className="set-row">
            <span className="set-label"><span style={{ fontWeight: 500 }}>Proteína</span><span className="tiny muted">g por kg · {gym.p} g al día</span></span>
            <Stepper label="proteína por kg" value={s.proteinPerKg} step={0.1} min={1} max={3.5} decimals={1} onChange={(n) => set("proteinPerKg", n)} />
          </div>
          <div className="set-row">
            <span className="set-label"><span style={{ fontWeight: 500 }}>Grasa</span><span className="tiny muted">g por kg · {gym.g} g al día</span></span>
            <Stepper label="grasa por kg" value={s.fatPerKg} step={0.05} min={0.5} max={2} decimals={2} onChange={(n) => set("fatPerKg", n)} />
          </div>
          <div className="set-row">
            <span className="set-label"><span style={{ fontWeight: 500 }}>Calorías días de pesas</span><span className="tiny muted">kcal</span></span>
            <Stepper label="calorías días de pesas" value={s.kcalTraining} step={50} min={1200} max={5000} onChange={(n) => set("kcalTraining", n)} />
          </div>
          <div className="set-row">
            <span className="set-label"><span style={{ fontWeight: 500 }}>Calorías otros días</span><span className="tiny muted">kcal</span></span>
            <Stepper label="calorías otros días" value={s.kcalRest} step={50} min={1200} max={5000} onChange={(n) => set("kcalRest", n)} />
          </div>
          {s.kcalAdjust !== 0 && (
            <div className="set-row">
              <span className="set-label">
                <span style={{ fontWeight: 500 }}>Ajuste por tu peso</span>
                <span className="tiny muted">{s.kcalAdjust > 0 ? "+" : ""}{s.kcalAdjust} kcal en todos los días</span>
              </span>
              <button type="button" className="link-btn" onClick={() => set("kcalAdjust", 0)}>Quitar</button>
            </div>
          )}
        </div>
        <div className="tiles">
          <div className="tile"><span className="tile-label">Días de pesas</span><span style={{ fontSize: 17, fontWeight: 700 }}>{fmt(gym.kcal)} kcal</span><span className="tiny muted">{gym.p} P · {gym.c} C · {gym.g} G</span></div>
          <div className="tile"><span className="tile-label">Otros días</span><span style={{ fontSize: 17, fontWeight: 700 }}>{fmt(rest.kcal)} kcal</span><span className="tiny muted">{rest.p} P · {rest.c} C · {rest.g} G</span></div>
          <div className="tile"><span className="tile-label">Agua</span><span style={{ fontSize: 17, fontWeight: 700 }}>{(s.waterGlasses * 0.25).toLocaleString("es-ES")} L</span><span className="tiny muted">{s.waterGlasses} vasos</span></div>
        </div>
      </section>

      {/* Semana */}
      <section className="section" aria-labelledby="h-sem">
        <h2 id="h-sem" className="section-title">Semana de entreno</h2>
        <div className="card" style={{ gap: 14 }}>
          <div className="week-plan">
            {DAYS.map(([d, label]) => (
              <div key={d} style={{ display: "contents" }}>
                <span style={{ fontWeight: 600, textAlign: "center" }}>{label}</span>
                <div className="chips" role="radiogroup" aria-label={`Plan del día ${label}`}>
                  {PLANS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={s.schedule[d] === p}
                      className="chip-btn plan-chip"
                      onClick={() => update((cur) => ({ schedule: { ...cur.schedule, [d]: p } }))}
                    >
                      {PLAN_INFO[p].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="set-row" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="set-label"><span style={{ fontWeight: 500 }}>Hora del entreno</span><span className="tiny muted">Se puede cambiar cada día en el calendario</span></span>
            <input className="input" type="time" style={{ width: 132 }} value={s.workoutTime} onChange={(e) => e.target.value && set("workoutTime", e.target.value)} />
          </div>
          <div className="set-row">
            <span className="set-label"><span style={{ fontWeight: 500 }}>Agua al día</span><span className="tiny muted">vasos de 250 ml</span></span>
            <Stepper label="vasos de agua" value={s.waterGlasses} step={1} min={4} max={20} onChange={(n) => set("waterGlasses", n)} />
          </div>
        </div>
      </section>

      <NotifySettings />

      <DataTools />

      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          if (confirm("¿Volver a los objetivos y la semana por defecto?")) update({ ...DEFAULT_SETTINGS, notify: s.notify });
        }}
      >
        Restablecer objetivos por defecto
      </button>
    </main>
  );
}
