"use client";

import { useState } from "react";
import type { TrainingData } from "@/lib/training";
import StreakPill from "../StreakPill";

export default function Progress({ data }: { data: TrainingData }) {
  const vols = data?.weeklyVolume ?? [{ label: "", tonnes: 0 }];
  const [sel, setSel] = useState(vols.length - 1);
  const max = Math.max(0.1, ...vols.map((v) => v.tonnes)) * 1.05;
  // Compara la última semana completa con la primera semana con datos (la actual aún no ha terminado).
  const firstNonZero = vols.slice(0, -1).find((v) => v.tonnes > 0)?.tonnes ?? 0;
  const lastFull = vols.length > 1 ? vols[vols.length - 2].tonnes : 0;
  const volTrend =
    firstNonZero > 0 && lastFull > 0 ? `${lastFull >= firstNonZero ? "+" : ""}${Math.round(((lastFull - firstNonZero) / firstNonZero) * 100)}% en 7 sem` : "";

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
            <div className="tile outlined"><span style={{ fontSize: 20, fontWeight: 700 }}>{data.stats.workoutsMonth}</span><span className="tile-label">Entrenos mes</span></div>
            <div className="tile outlined"><span style={{ fontSize: 20, fontWeight: 700 }}>{data.stats.volumeWeek}</span><span className="tile-label">Volumen semana</span></div>
            <div className="tile outlined"><span style={{ fontSize: 20, fontWeight: 700 }}>{data.stats.prsMonth}</span><span className="tile-label">Récords mes</span></div>
          </div>
          <div className="card" style={{ padding: "18px 16px 14px", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="small muted">
                  Volumen semanal · {sel === vols.length - 1 ? "esta semana" : `semana del ${vols[sel].label}`}
                </span>
                <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {vols[sel].tonnes.toLocaleString("es-ES")} t
                </span>
              </div>
              {volTrend && <span className="tiny muted">{volTrend}</span>}
            </div>
            <div className="chart">
              {vols.map((v, i) => (
                <button
                  key={v.label}
                  aria-pressed={i === sel}
                  aria-label={`Semana del ${v.label}: ${v.tonnes.toLocaleString("es-ES")} toneladas`}
                  onClick={() => setSel(i)}
                >
                  <span style={{ height: `${Math.max(2, (v.tonnes / max) * 100)}%` }} />
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
              <span>{vols[0].label}</span><span>Esta semana</span>
            </div>
          </div>
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
