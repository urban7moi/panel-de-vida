"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, InfoIcon } from "../icons";
import { macroGoals } from "@/lib/mock";
import { useStored } from "@/lib/useStored";
import { shrinkImage } from "@/lib/image";

type Meal = { name: string; p: number; c: number; g: number; kcal?: number };
type Estimate = { name: string; kcal: number; p: number; c: number; g: number; confidence: string; notes: string };

const kcalOf = (p: number, c: number, g: number) => p * 4 + c * 4 + g * 9;
const mealKcal = (m: Meal) => m.kcal ?? kcalOf(m.p, m.c, m.g);
const emptyForm = { name: "", kcal: "", p: "", c: "", g: "" };
const fmt = (n: number) => n.toLocaleString("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions);
const toNum = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : Math.round(n);
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Lunes, martes, jueves y viernes son días de pesas. */
function isGymDay() {
  const d = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" }).format(new Date());
  return ["Mon", "Tue", "Thu", "Fri"].includes(d);
}

const steps = ["Identificando los alimentos…", "Calculando la ración…", "Estimando calorías y macros…"];

export default function Macros() {
  const gymDay = isGymDay();
  const goals = gymDay ? macroGoals.training : macroGoals.rest;
  const [meals, setMeals] = useStored<Meal[]>(`comidas-${todayKey()}`, []);
  const [form, setForm] = useState(emptyForm);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!analyzing) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 2200);
    return () => clearInterval(t);
  }, [analyzing]);

  const eaten = meals.reduce(
    (a, m) => ({ p: a.p + m.p, c: a.c + m.c, g: a.g + m.g }),
    { p: 0, c: 0, g: 0 },
  );
  const kGoal = kcalOf(goals.p, goals.c, goals.g);
  const kEaten = meals.reduce((a, m) => a + mealKcal(m), 0);
  const kPct = Math.min(100, Math.round((kEaten / kGoal) * 100));
  const formKcal = form.kcal.trim() ? toNum(form.kcal) : kcalOf(toNum(form.p), toNum(form.c), toNum(form.g));

  async function analyzePhoto(file: File) {
    setAnalyzing(true);
    setPhotoError("");
    setEstimate(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    try {
      const body = new FormData();
      body.append("image", await shrinkImage(file), "comida.jpg");
      const res = await fetch("/api/meal", { method: "POST", body });
      const json = await res.json().catch(() => ({ error: "Respuesta no válida del servidor." }));
      if (!res.ok) throw new Error(json.error ?? "No se pudo analizar la foto.");
      const est = json as Estimate;
      setEstimate(est);
      setForm({ name: est.name, kcal: String(est.kcal), p: String(est.p), c: String(est.c), g: String(est.g) });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "No se pudo analizar la foto.");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const macroRows = [
    { name: "Proteína", eaten: eaten.p, goal: goals.p },
    { name: "Carbohidratos", eaten: eaten.c, goal: goals.c },
    { name: "Grasa", eaten: eaten.g, goal: goals.g },
  ];

  function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const p = toNum(form.p), c = toNum(form.c), g = toNum(form.g);
    if (formKcal === 0) return;
    const name = form.name.trim() || `Comida ${meals.length + 1}`;
    setMeals([...meals, { name, p, c, g, kcal: formKcal }]);
    setForm(emptyForm);
    setEstimate(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  return (
      <section className="section" aria-labelledby="h-macros">
        <div className="section-head">
          <h2 id="h-macros" className="section-title">Macros de hoy</h2>
          <span className="small muted">{gymDay ? "Día de entreno" : "Día de descanso"}</span>
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
                  <span className="small muted">{mealKcal(m)} kcal · {m.p}P · {m.c}C · {m.g}G</span>
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

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) analyzePhoto(f);
              }}
            />
            {analyzing ? (
              <div className="analyzing" role="status" aria-live="polite">
                {preview && <img src={preview} alt="" className="analyzing-photo" />}
                <div className="analyzing-overlay">
                  <span className="spinner" aria-hidden="true" />
                  <span style={{ fontSize: 17, fontWeight: 600 }}>Analizando tu comida</span>
                  <span className="small" style={{ color: "#e8e6df" }}>{steps[step]}</span>
                </div>
              </div>
            ) : (
              <button type="button" className="scan" onClick={() => fileRef.current?.click()} style={{ minHeight: 56, padding: "8px 12px" }}>
                <span className="scan-icon" style={{ width: 36, height: 36 }}><CameraIcon size={18} strokeWidth={2} /></span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{estimate ? "Hacer otra foto" : "Foto de la comida"}</span>
                  <span className="tiny muted">La IA estima las calorías y los macros</span>
                </span>
              </button>
            )}
            {photoError && <p className="error" role="alert" style={{ fontSize: 13 }}>{photoError}</p>}
            {estimate && !analyzing && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {preview && <img src={preview} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span className="chip">Estimación · confianza {estimate.confidence}</span>
                  <span className="small muted" style={{ lineHeight: 1.45 }}>{estimate.notes}</span>
                </div>
              </div>
            )}

            <label className="field">Nombre
              <input className="input" placeholder="Ej. Merienda" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">Calorías (kcal)
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder={String(kcalOf(toNum(form.p), toNum(form.c), toNum(form.g)) || "0")}
                value={form.kcal}
                onChange={(e) => setForm({ ...form, kcal: e.target.value })}
              />
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
  );
}
