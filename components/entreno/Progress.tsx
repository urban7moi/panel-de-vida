"use client";

import { useState } from "react";
import type { CategoryProgress, TrainingData } from "@/lib/training";
import StreakPill from "../StreakPill";
import { PullIcon, PushIcon, DumbbellIcon } from "../icons";

const COLORS: Record<CategoryProgress["key"], string> = { push: "var(--accent)", pull: "var(--google)", legs: "var(--good)" };
const ICONS = { push: PushIcon, pull: PullIcon, legs: DumbbellIcon };
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;

/** Gráfica de fuerza por sesión: 100 = tu primera sesión de este tipo. */
function StrengthChart({ cat, sel, onSel }: { cat: CategoryProgress; sel: number; onSel: (i: number) => void }) {
  const W = 320;
  const H = 150;
  const PX = 14;
  const PY = 16;
  const vals = cat.sessions.map((s) => s.index);
  const lo = Math.min(97, ...vals) - 1;
  const hi = Math.max(103, ...vals) + 1;
  const n = cat.sessions.length;
  const x = (i: number) => (n === 1 ? W / 2 : PX + (i / (n - 1)) * (W - 2 * PX));
  const y = (v: number) => PY + (1 - (v - lo) / (hi - lo)) * (H - 2 * PY);
  const color = COLORS[cat.key];
  const area = n > 1 ? `M${x(0)},${H - PY} ` + cat.sessions.map((s, i) => `L${x(i)},${y(s.index)}`).join(" ") + ` L${x(n - 1)},${H - PY} Z` : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Fuerza en ${cat.label} sesión a sesión: ${pct(cat.change)} desde la primera`}>
      <defs>
        <linearGradient id={`fill-${cat.key}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Línea de referencia: tu primera sesión */}
      <line x1={PX} x2={W - PX} y1={y(100)} y2={y(100)} stroke="var(--muted)" strokeDasharray="4 4" strokeWidth="1" opacity="0.6" />
      <text x={W - PX} y={y(100) - 5} textAnchor="end" fontSize="10" fill="var(--muted)">inicio</text>
      {area && <path d={area} fill={`url(#fill-${cat.key})`} />}
      {n > 1 && (
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={cat.sessions.map((s, i) => `${x(i)},${y(s.index)}`).join(" ")}
        />
      )}
      {cat.sessions.map((s, i) => (
        <g key={s.date + i} onClick={() => onSel(i)} style={{ cursor: "pointer" }}>
          <circle cx={x(i)} cy={y(s.index)} r="14" fill="transparent" />
          <circle
            cx={x(i)}
            cy={y(s.index)}
            r={i === sel ? 6 : s.thisWeek ? 5 : 3.5}
            fill={s.thisWeek || i === sel ? color : "var(--card)"}
            stroke={color}
            strokeWidth="2"
          />
        </g>
      ))}
    </svg>
  );
}

export default function Progress({ data }: { data: TrainingData }) {
  const cats = data.categories;
  // Empieza en el tipo de sesión del último entreno.
  const lastKey = [...cats].sort((a, b) => (b.sessions.at(-1)?.date ?? "").localeCompare(a.sessions.at(-1)?.date ?? ""))[0]?.key;
  const [active, setActive] = useState(lastKey ?? "push");
  const cat = cats.find((c) => c.key === active) ?? cats[0];
  const [sel, setSel] = useState<number | null>(null);
  const selIdx = cat ? (sel !== null && sel < cat.sessions.length ? sel : cat.sessions.length - 1) : 0;
  const shown = cat?.sessions[selIdx];
  const thisWeek = cat?.sessions.filter((s) => s.thisWeek) ?? [];

  return (
    <section className="section" aria-labelledby="h-prog">
      <div className="section-head">
        <h2 id="h-prog" className="section-title">Progreso</h2>
        {data.lastWorkout && <span className="small muted">Último: {data.lastWorkout.date}</span>}
      </div>
      <StreakPill
        n={data.stats.weekStreak}
        unit={["semana", "semanas"]}
        label="seguidas sin saltarte un entreno"
        empty="Completa todos los entrenos de la semana para empezar una racha."
      />
      <div className="tiles">
        <div className="tile outlined">
          <span style={{ fontSize: 20, fontWeight: 700 }}>{data.stats.weekDone}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/{data.stats.weekPlanned}</span></span>
          <span className="tile-label">Esta semana</span>
        </div>
        <div className="tile outlined"><span style={{ fontSize: 20, fontWeight: 700 }}>{data.stats.workoutsMonth}</span><span className="tile-label">Entrenos mes</span></div>
        <div className="tile outlined"><span style={{ fontSize: 20, fontWeight: 700 }}>{data.stats.prsMonth}</span><span className="tile-label">Récords mes</span></div>
      </div>

      {cat && (
        <div className="card" style={{ padding: "16px 16px 14px", gap: 14 }}>
          {/* Push · Pull · Pierna */}
          <div className="segmented" role="tablist" aria-label="Tipo de sesión">
            {cats.map((c) => (
              <button
                key={c.key}
                role="tab"
                aria-selected={c.key === cat.key}
                onClick={() => {
                  setActive(c.key);
                  setSel(null);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="small muted">Fuerza en {cat.label}</span>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: cat.change > 0 ? COLORS[cat.key] : cat.change < 0 ? "var(--warn)" : undefined }}>
                {pct(cat.change)}
              </span>
              <span className="tiny muted">desde tu primera sesión ({cat.sessions[0].label}) · {cat.sessions.length} sesiones</span>
            </div>
            {(() => {
              const Icon = ICONS[cat.key];
              return <span className="tip-icon" style={{ color: COLORS[cat.key], width: 44, height: 44 }}><Icon size={22} /></span>;
            })()}
          </div>

          <StrengthChart cat={cat} sel={selIdx} onSel={setSel} />

          {shown && (
            <div className="session-pill" style={{ borderColor: COLORS[cat.key] }}>
              <span style={{ fontWeight: 600 }}>{shown.label}{shown.thisWeek ? " · esta semana" : ""}</span>
              <span className="tiny muted">{pct(Math.round((shown.index - 100) * 10) / 10)} respecto al inicio{shown.best ? ` · ${shown.best}` : ""}</span>
            </div>
          )}

          {thisWeek.length > 0 && (
            <span className="tiny muted">
              Esta semana: {thisWeek.length} {thisWeek.length === 1 ? "sesión" : "sesiones"} de {cat.label} (puntos rellenos).
            </span>
          )}

          {cat.movers.length > 0 && (
            <div className="movers">
              <span className="label-caps">Lo que más ha cambiado</span>
              {cat.movers.map((m) => {
                const up = m.to > m.from;
                return (
                  <div className="mover" key={m.name}>
                    <span className="ellipsis" style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</span>
                    <span className="mover-bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, (Math.min(m.from, m.to) / Math.max(m.from, m.to)) * 100)}%`, background: "var(--line-2)" }} />
                      <span style={{ width: `${100 - Math.min(100, (Math.min(m.from, m.to) / Math.max(m.from, m.to)) * 100)}%`, background: up ? COLORS[cat.key] : "var(--warn)" }} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: up ? "var(--good)" : "var(--warn)", flexShrink: 0 }}>
                      {m.from} → {m.to} kg
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <span className="tiny muted">Cada punto es una sesión: la fuerza de sus ejercicios (1RM estimado) frente a tu primera sesión. Toca un punto para verla.</span>
        </div>
      )}

      {data.lifts.length > 0 && (
        <>
          <div className="list">
            {data.lifts.map((l) => (
              <div className="row" key={l.name} style={{ padding: "12px 0" }}>
                <div className="grow" style={{ gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{l.name}</span>
                  <span className="small muted">{l.best}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{l.e1rm}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: l.up === null ? "var(--muted)" : l.up ? "var(--good)" : "var(--warn)" }}>{l.trend}</span>
                </div>
              </div>
            ))}
          </div>
          <span className="footnote">1RM estimado a partir de tus series en Hevy</span>
        </>
      )}
    </section>
  );
}
