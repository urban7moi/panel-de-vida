"use client";

import { useEffect, useMemo, useState } from "react";
import { useStored } from "@/lib/useStored";
import { useSettings } from "@/lib/useSettings";
import { addDays, dateFromKey } from "@/lib/agenda";
import { calorieAdvice, mergeWeights, weekAverage, weeklyTrend, type WeightPoint } from "@/lib/weight";
import { ScaleIcon } from "./icons";

const kg = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
const short = (key: string) => dateFromKey(key).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");

/** Peso: apuntarlo, ver la tendencia y ajustar calorías. */
export default function WeightSection({ today }: { today: string }) {
  const [settings, update] = useSettings();
  const [manual, setManual] = useStored<Record<string, number>>("peso", {});
  const [hevy, setHevy] = useState<WeightPoint[]>([]);
  useEffect(() => {
    fetch("/api/weight", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setHevy(j.weights ?? []))
      .catch(() => {});
  }, []);

  const points = useMemo(() => mergeWeights(hevy, manual), [hevy, manual]);
  const last30 = points.filter((p) => p.date > addDays(today, -30));
  const latest = points[points.length - 1];
  const avg = weekAverage(points, today);
  const trend = weeklyTrend(points, today);
  const advice = calorieAdvice(trend, settings.kcalAdjustDate, today);

  const [input, setInput] = useState("");
  useEffect(() => {
    if (!input && latest) setInput(latest.kg.toLocaleString("es-ES"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.kg]);
  const [sel, setSel] = useState<number | null>(null);

  function save() {
    const n = parseFloat(input.replace(",", "."));
    if (!n || n < 30 || n > 250) return;
    const v = Math.round(n * 10) / 10;
    setManual((m) => ({ ...m, [today]: v }));
    // El peso de los ajustes (para calcular proteína y grasa) sigue a tu media.
    update({ weight: Math.round(v * 2) / 2 });
  }

  // --- Gráfica (últimos 30 días) ---
  const W = 320;
  const H = 120;
  const PAD = 10;
  const ys = last30.map((p) => p.kg);
  const min = Math.min(...ys, (avg ?? ys[0] ?? 0) - 0.5);
  const max = Math.max(...ys, (avg ?? ys[0] ?? 0) + 0.5);
  const x = (d: string) => PAD + ((30 - (dateFromKey(today).getTime() - dateFromKey(d).getTime()) / 864e5) / 30) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - min) / (max - min || 1)) * (H - 2 * PAD);
  const shown = sel !== null ? last30[sel] : latest;

  return (
    <section className="section" aria-labelledby="h-peso">
      <div className="section-head">
        <h2 id="h-peso" className="section-title">Peso</h2>
        {trend !== null && (
          <span className="small muted">
            {trend >= 0 ? "+" : ""}
            {trend.toLocaleString("es-ES", { maximumFractionDigits: 2 })} kg/semana
          </span>
        )}
      </div>
      <div className="card" style={{ gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="small muted">{shown ? (shown === latest && sel === null ? "Último" : short(shown.date)) : "Sin datos"}</span>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>{shown ? kg(shown.kg) : "—"}</span>
          </div>
          {avg !== null && <span className="small muted" style={{ paddingBottom: 6 }}>Media 7 días · {kg(avg)}</span>}
        </div>

        {last30.length >= 2 ? (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Peso de los últimos 30 días, de ${kg(Math.min(...ys))} a ${kg(Math.max(...ys))}`}>
            {avg !== null && (
              <line x1={PAD} x2={W - PAD} y1={y(avg)} y2={y(avg)} stroke="var(--muted)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
            )}
            <polyline
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={last30.map((p) => `${x(p.date)},${y(p.kg)}`).join(" ")}
            />
            {last30.map((p, i) => (
              <g key={p.date} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: "pointer" }}>
                <circle cx={x(p.date)} cy={y(p.kg)} r="12" fill="transparent" />
                <circle cx={x(p.date)} cy={y(p.kg)} r={sel === i ? 5 : 3.5} fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
              </g>
            ))}
          </svg>
        ) : (
          <span className="small muted">Apunta tu peso 2–3 veces por semana, en ayunas, para ver la tendencia.</span>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="scan-icon" style={{ width: 40, height: 40 }}><ScaleIcon size={20} /></span>
          <input
            className="input"
            inputMode="decimal"
            aria-label="Peso de hoy en kg"
            placeholder="Peso de hoy (kg)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn-primary" style={{ width: "auto", padding: "0 18px", minHeight: 44 }} onClick={save}>
            {manual[today] ? "Cambiar" : "Guardar"}
          </button>
        </div>
        <span className="tiny muted">También se leen los pesos que apuntes en Hevy (Perfil → Medidas).</span>

        {/* Propuesta de calorías */}
        <div className="advice">
          {advice.kind === "pocos-datos" && <span className="small muted">Con 2 semanas de pesos te diré si ajustar las calorías.</span>}
          {advice.kind === "esperar" && <span className="small muted">Ajustaste las calorías hace poco: espera 2 semanas para ver el efecto.</span>}
          {advice.kind === "bien" && <span className="small" style={{ color: "var(--good)" }}>Vas bien: peso estable o subiendo despacio. Mantén las calorías.</span>}
          {(advice.kind === "subir" || advice.kind === "bajar") && (
            <>
              <span className="small" style={{ lineHeight: 1.45 }}>
                {advice.kind === "subir"
                  ? `Estás bajando de peso (${trend!.toLocaleString("es-ES", { maximumFractionDigits: 2 })} kg/semana). Para ganar músculo sin perder peso, sube ${advice.delta} kcal al día.`
                  : `Subes más rápido de lo ideal (+${trend!.toLocaleString("es-ES", { maximumFractionDigits: 2 })} kg/semana). Baja ${Math.abs(advice.delta)} kcal al día para no acumular grasa.`}
              </span>
              <button
                type="button"
                className="btn-primary"
                style={{ minHeight: 44, fontSize: 15 }}
                onClick={() => update((s) => ({ kcalAdjust: s.kcalAdjust + advice.delta, kcalAdjustDate: today }))}
              >
                Aplicar {advice.delta > 0 ? "+" : ""}{advice.delta} kcal
              </button>
            </>
          )}
          {settings.kcalAdjust !== 0 && (
            <span className="tiny muted">Ajuste actual: {settings.kcalAdjust > 0 ? "+" : ""}{settings.kcalAdjust} kcal (puedes quitarlo en Ajustes).</span>
          )}
        </div>
      </div>
    </section>
  );
}
