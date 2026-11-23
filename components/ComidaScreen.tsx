"use client";

import SettingsLink from "./SettingsLink";
import WeightSection from "./WeightSection";
import { useEffect, useMemo, useRef, useState } from "react";
import { CameraIcon, InfoIcon } from "./icons";
import { useStored } from "@/lib/useStored";
import { shrinkImage } from "@/lib/image";
import { addDays, dateFromKey, dateKey, TZ } from "@/lib/agenda";
import { useSettings } from "@/lib/useSettings";
import { goalsFor as goalsOf, isGymPlan, planForWeekday } from "@/lib/settings";

type MealType = "desayuno" | "comida" | "merienda" | "cena" | "snack";
type Meal = { id: string; name: string; kcal: number; p: number; c: number; g: number; type: MealType; time: string };
type Fav = { name: string; kcal: number; p: number; c: number; g: number };
type Estimate = { name: string; kcal: number; p: number; c: number; g: number; confidence: string; notes: string };
type Idea = { type: MealType; name: string; portion: string; kcal: number; p: number; c: number; g: number; why: string };
type NutriPlan = { summary: string; ideas: Idea[]; basedOn: string; added: number[] };

const TYPES: { key: MealType; label: string }[] = [
  { key: "desayuno", label: "Desayuno" },
  { key: "comida", label: "Comida" },
  { key: "merienda", label: "Merienda" },
  { key: "cena", label: "Cena" },
  { key: "snack", label: "Snack" },
];
const steps = ["Identificando los alimentos…", "Calculando la ración…", "Estimando calorías y macros…"];

const kcalOf = (p: number, c: number, g: number) => p * 4 + c * 4 + g * 9;
const fmt = (n: number) => n.toLocaleString("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions);
const toNum = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : Math.round(n);
};
const emptyForm = { name: "", kcal: "", p: "", c: "", g: "" };
const nowHHMM = () =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
/** Tipo de comida que toca según la hora. */
function typeByHour(): MealType {
  const h = Number(nowHHMM().slice(0, 2));
  if (h < 11) return "desayuno";
  if (h < 16) return "comida";
  if (h < 19) return "merienda";
  if (h < 23) return "cena";
  return "snack";
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ComidaScreen() {
  const [settings] = useSettings();
  /** Días de pesas según tus ajustes. */
  const isGymDay = (key: string) => isGymPlan(planForWeekday(settings, dateFromKey(key).getDay()));
  const goalsFor = (key: string) => goalsOf(settings, isGymDay(key));
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(dateKey(new Date())), []);
  const [day, setDay] = useState<string | null>(null);
  const active = day ?? today;

  const [allMeals, setAllMeals] = useStored<Record<string, Meal[]>>("comidas-v2", {});
  const [favs, setFavs] = useStored<Fav[]>("comidas-frecuentes", []);
  const [water, setWater] = useStored<Record<string, number>>("agua", {});

  // Pasa las comidas guardadas con la versión anterior (solo las de hoy).
  useEffect(() => {
    if (!today) return;
    try {
      const d = new Date();
      const oldKey = `comidas-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const raw = localStorage.getItem(oldKey);
      if (!raw) return;
      const old = JSON.parse(raw) as { name: string; p: number; c: number; g: number; kcal?: number }[];
      if (old.length) {
        setAllMeals((all) => ({
          ...all,
          [today]: [
            ...(all[today] ?? []),
            ...old.map((m) => ({ id: crypto.randomUUID(), name: m.name, p: m.p, c: m.c, g: m.g, kcal: m.kcal ?? kcalOf(m.p, m.c, m.g), type: "comida" as MealType, time: "" })),
          ],
        }));
      }
      localStorage.removeItem(oldKey);
    } catch {
      /* nada que migrar */
    }
  }, [today, setAllMeals]);

  const meals = (active && allMeals[active]) || [];
  const goals = goalsFor(active ?? "2000-01-03");
  const kGoal = goals.kcal;
  const eaten = meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, g: a.g + m.g }), { kcal: 0, p: 0, c: 0, g: 0 });
  const kPct = Math.min(100, Math.round((eaten.kcal / kGoal) * 100));
  const over = eaten.kcal > kGoal;

  // --- Añadir comida ---
  const [mode, setMode] = useState<"foto" | "texto">("foto");
  const [type, setType] = useState<MealType>("comida");
  useEffect(() => setType(typeByHour()), []);
  const [description, setDescription] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saveFav, setSaveFav] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!analyzing) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 2200);
    return () => clearInterval(t);
  }, [analyzing]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function estimateMeal(file: File | null) {
    setAnalyzing(true);
    setError("");
    setEstimate(null);
    if (file) {
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
    }
    try {
      const body = new FormData();
      if (file) body.append("image", await shrinkImage(file), "comida.jpg");
      if (description.trim()) body.append("note", description.trim());
      const res = await fetch("/api/meal", { method: "POST", body });
      const json = await res.json().catch(() => ({ error: "Respuesta no válida del servidor." }));
      if (!res.ok) throw new Error(json.error ?? "No se pudo estimar la comida.");
      const est = json as Estimate;
      setEstimate(est);
      setForm({ name: est.name, kcal: String(est.kcal), p: String(est.p), c: String(est.c), g: String(est.g) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo estimar la comida.");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const formKcal = form.kcal.trim() ? toNum(form.kcal) : kcalOf(toNum(form.p), toNum(form.c), toNum(form.g));

  function pushMeal(m: Omit<Meal, "id" | "time" | "type">, mealType: MealType = type) {
    if (!active) return;
    const meal: Meal = { ...m, id: crypto.randomUUID(), type: mealType, time: active === today ? nowHHMM() : "" };
    setAllMeals((all) => ({ ...all, [active]: [...(all[active] ?? []), meal] }));
  }

  function addMeal(e: React.FormEvent) {
    e.preventDefault();
    if (formKcal === 0) return;
    const m = { name: form.name.trim() || TYPES.find((t) => t.key === type)!.label, kcal: formKcal, p: toNum(form.p), c: toNum(form.c), g: toNum(form.g) };
    pushMeal(m);
    if (saveFav) addFav(m);
    setForm(emptyForm);
    setDescription("");
    setEstimate(null);
    setSaveFav(false);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setToast(`${m.name} añadido · ${m.kcal} kcal`);
  }

  function addFav(m: Fav) {
    setFavs((fs) => [m, ...fs.filter((f) => f.name.toLowerCase() !== m.name.toLowerCase())].slice(0, 12));
  }
  const removeMeal = (id: string) => active && setAllMeals((all) => ({ ...all, [active]: (all[active] ?? []).filter((m) => m.id !== id) }));
  const isFav = (name: string) => favs.some((f) => f.name.toLowerCase() === name.toLowerCase());

  // --- Tu nutricionista ---
  const [plans, setPlans] = useStored<Record<string, NutriPlan>>("nutri-planes", {});
  const plan = active ? plans[active] : undefined;
  const signature = `${meals.length}-${eaten.kcal}`;
  const [nutriLoading, setNutriLoading] = useState(false);
  const [nutriError, setNutriError] = useState("");
  async function askNutri() {
    if (!active) return;
    setNutriLoading(true);
    setNutriError("");
    try {
      const res = await fetch("/api/nutri", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hour: active === today ? nowHHMM() : "09:00",
          gymDay: isGymDay(active),
          remaining: { kcal: kGoal - eaten.kcal, p: goals.p - eaten.p, c: goals.c - eaten.c, g: goals.g - eaten.g },
          goals: { kcal: kGoal, p: goals.p, c: goals.c, g: goals.g },
          eaten: meals.map((m) => ({ name: m.name, type: m.type, kcal: m.kcal, p: m.p })),
          favorites: favs.map((f) => f.name),
        }),
      });
      const json = await res.json().catch(() => ({ error: "Respuesta no válida del servidor." }));
      if (!res.ok) throw new Error(json.error ?? "No se pudieron preparar las recomendaciones.");
      const day = active;
      setPlans((all) => {
        // Solo se guardan los últimos 7 días.
        const keep = Object.fromEntries(Object.entries(all).filter(([k]) => k >= addDays(day, -7)));
        return { ...keep, [day]: { summary: json.summary, ideas: json.ideas, basedOn: signature, added: [] } };
      });
    } catch (err) {
      setNutriError(err instanceof Error ? err.message : "No se pudieron preparar las recomendaciones.");
    } finally {
      setNutriLoading(false);
    }
  }
  function addIdea(i: number) {
    if (!active || !plan) return;
    const idea = plan.ideas[i];
    pushMeal({ name: idea.name, kcal: idea.kcal, p: idea.p, c: idea.c, g: idea.g }, idea.type);
    setPlans((all) => ({ ...all, [active]: { ...plan, added: [...plan.added, i], basedOn: `${meals.length + 1}-${eaten.kcal + idea.kcal}` } }));
    setToast(`${idea.name} añadido · ${idea.kcal} kcal`);
  }
  const planStale = !!plan && plan.basedOn !== signature;

  // --- Agua ---
  const WATER_GOAL = settings.waterGlasses;
  const glasses = (active && water[active]) || 0;
  const setGlasses = (n: number) => active && setWater((w) => ({ ...w, [active]: Math.max(0, Math.min(20, n)) }));

  // --- Semana (7 días hasta el elegido) ---
  const week = useMemo(() => {
    if (!active) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(active, i - 6);
      const list = allMeals[key] ?? [];
      const g = goalsFor(key);
      return {
        key,
        label: dateFromKey(key).toLocaleDateString("es-ES", { weekday: "narrow" }).toUpperCase(),
        kcal: list.reduce((a, m) => a + m.kcal, 0),
        p: list.reduce((a, m) => a + m.p, 0),
        goal: g.kcal,
        logged: list.length > 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, allMeals, settings]);
  const logged = week.filter((d) => d.logged);
  const avgKcal = logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : 0;
  const avgP = logged.length ? Math.round(logged.reduce((a, d) => a + d.p, 0) / logged.length) : 0;
  const weekMax = Math.max(...week.map((d) => Math.max(d.kcal, d.goal)), 1);

  const dayLabel = !active ? "" : active === today ? "Hoy" : active === (today && addDays(today, -1)) ? "Ayer" : cap(dateFromKey(active).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" }));

  return (
    <main className="screen">
      <header className="header">
        <div className="header-titles">
          <span className="eyebrow">{active ? (isGymDay(active) ? "Día de entreno" : "Día de descanso") : " "}</span>
          <h1 className="title">Alimentación</h1>
        </div>
        <SettingsLink />
      </header>

      {/* Navegación de días */}
      <div className="day-nav">
        <button type="button" className="round-btn" aria-label="Día anterior" onClick={() => active && setDay(addDays(active, -1))}>‹</button>
        <button type="button" className="day-nav-label" onClick={() => setDay(null)} disabled={active === today}>
          {dayLabel}
          {active !== today && <span className="tiny" style={{ color: "var(--accent-text)" }}>Volver a hoy</span>}
        </button>
        <button type="button" className="round-btn" aria-label="Día siguiente" onClick={() => active && setDay(addDays(active, 1))} disabled={active === today}>›</button>
      </div>

      {/* Resumen del día */}
      <section className="card" aria-label="Resumen del día">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="small muted">{over ? "Te has pasado" : "Te quedan"}</span>
            <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", color: over ? "var(--accent-text)" : undefined }}>
              {fmt(Math.abs(kGoal - eaten.kcal))} <span style={{ fontSize: 17, fontWeight: 500, color: "var(--muted)" }}>kcal</span>
            </span>
          </div>
          <span className="small muted" style={{ paddingBottom: 6 }}>{fmt(eaten.kcal)} de {fmt(kGoal)}</span>
        </div>
        <div className="bar-track" role="img" aria-label={`Has comido el ${kPct}% de las calorías del día`}>
          <div className="bar-fill" style={{ width: `${kPct}%` }} />
        </div>
        <div className="tiles">
          {[
            { name: "Proteína", eaten: eaten.p, goal: goals.p },
            { name: "Carbohidratos", eaten: eaten.c, goal: goals.c },
            { name: "Grasa", eaten: eaten.g, goal: goals.g },
          ].map((m) => (
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
      </section>

      {/* Tu nutricionista */}
      <section className="section" aria-labelledby="h-nutri">
        <div className="section-head">
          <h2 id="h-nutri" className="section-title">Tu nutricionista</h2>
          <span className="small muted">{Math.max(0, goals.p - eaten.p)} g de proteína por cubrir</span>
        </div>
        {nutriLoading ? (
          <div className="card nutri-loading" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span style={{ fontSize: 16, fontWeight: 600 }}>Preparando tus recomendaciones</span>
            <span className="small muted">Mirando lo que llevas hoy y lo que te falta…</span>
          </div>
        ) : !plan ? (
          <div className="card" style={{ gap: 12 }}>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Te propongo 3 comidas para llegar a tu proteína sin pasarte de calorías, según lo que ya has comido hoy.
            </p>
            <button type="button" className="btn-primary" onClick={askNutri}>Recomiéndame qué comer</button>
          </div>
        ) : (
          <>
            <div className="card nutri-summary">
              <span style={{ fontSize: 15, lineHeight: 1.45 }}>{plan.summary}</span>
              {planStale && <span className="tiny" style={{ color: "var(--accent-text)" }}>Has apuntado comidas desde estas ideas: actualízalas para que cuadren.</span>}
            </div>
            {plan.ideas.map((idea, i) => {
              const added = plan.added.includes(i);
              return (
                <article className="coach-card" key={i}>
                  <span className="chip" style={{ alignSelf: "flex-start" }}>{TYPES.find((t) => t.key === idea.type)?.label ?? idea.type}</span>
                  <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{idea.name}</span>
                  <span className="small" style={{ lineHeight: 1.45 }}>{idea.portion}</span>
                  <div className="idea-macros">
                    <span><strong>{idea.p} g</strong> prot.</span>
                    <span>{idea.kcal} kcal</span>
                    <span>{idea.c} C · {idea.g} G</span>
                  </div>
                  <span className="tip-body">{idea.why}</span>
                  <button type="button" className={added ? "btn-secondary" : "btn-primary"} style={{ minHeight: 44, fontSize: 15 }} disabled={added} onClick={() => addIdea(i)}>
                    {added ? "Añadida ✓" : `Añadir a ${(TYPES.find((t) => t.key === idea.type)?.label ?? "comida").toLowerCase()}`}
                  </button>
                </article>
              );
            })}
            <button type="button" className="add-btn" onClick={askNutri}>{planStale ? "Actualizar recomendaciones" : "Otras ideas"}</button>
          </>
        )}
        {nutriError && <p className="error" role="alert" style={{ margin: 0, fontSize: 13 }}>{nutriError}</p>}
      </section>

      {/* Añadir comida */}
      <section className="section" aria-labelledby="h-add">
        <div className="section-head">
          <h2 id="h-add" className="section-title">Añadir comida</h2>
        </div>
        <div className="card" style={{ gap: 14 }}>
          <div className="chips" role="radiogroup" aria-label="Tipo de comida">
            {TYPES.map((t) => (
              <button key={t.key} type="button" role="radio" aria-checked={type === t.key} className="chip-btn" onClick={() => setType(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="segmented" role="tablist" aria-label="Cómo añadir">
            <button role="tab" aria-selected={mode === "foto"} onClick={() => setMode("foto")}>Foto</button>
            <button role="tab" aria-selected={mode === "texto"} onClick={() => setMode("texto")}>Descripción</button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) estimateMeal(f);
            }}
          />

          {analyzing ? (
            <div className="analyzing" role="status" aria-live="polite">
              {preview && mode === "foto" && <img src={preview} alt="" className="analyzing-photo" />}
              <div className="analyzing-overlay">
                <span className="spinner" aria-hidden="true" />
                <span style={{ fontSize: 17, fontWeight: 600 }}>Analizando tu comida</span>
                <span className="small" style={{ color: "#e8e6df" }}>{steps[step]}</span>
              </div>
            </div>
          ) : mode === "foto" ? (
            <button type="button" className="scan" onClick={() => fileRef.current?.click()} style={{ minHeight: 64 }}>
              <span className="scan-icon"><CameraIcon size={20} strokeWidth={2} /></span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{estimate ? "Hacer otra foto" : "Hacer o elegir una foto"}</span>
                <span className="tiny muted">La IA estima las calorías y los macros</span>
              </span>
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className="field">¿Qué has comido?
                <textarea
                  className="input textarea"
                  rows={3}
                  placeholder="Ej. 2 huevos revueltos, una tostada integral con aguacate y un café con leche"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <button type="button" className="btn-primary" disabled={!description.trim()} onClick={() => estimateMeal(null)}>
                Calcular calorías
              </button>
            </div>
          )}

          {error && <p className="error" role="alert" style={{ fontSize: 13, margin: 0 }}>{error}</p>}
          {estimate && !analyzing && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              {preview && mode === "foto" && <img src={preview} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span className="chip">Estimación · confianza {estimate.confidence}</span>
                <span className="small muted" style={{ lineHeight: 1.45 }}>{estimate.notes}</span>
              </div>
            </div>
          )}

          <form onSubmit={addMeal} style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--card-2)", borderRadius: 14, padding: 14 }}>
            <label className="field">Nombre
              <input className="input" placeholder="Ej. Pollo con arroz" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
            <label className="toggle-row" style={{ minHeight: 36 }}>
              <input type="checkbox" checked={saveFav} onChange={(e) => setSaveFav(e.target.checked)} />
              Guardar en comidas frecuentes
            </label>
            <button className="btn-primary" type="submit" disabled={formKcal === 0} style={{ minHeight: 44, fontSize: 15 }}>
              Añadir a {TYPES.find((t) => t.key === type)!.label.toLowerCase()} · {formKcal} kcal
            </button>
          </form>
        </div>
      </section>

      {/* Frecuentes */}
      {favs.length > 0 && (
        <section className="section" aria-labelledby="h-fav">
          <div className="section-head">
            <h2 id="h-fav" className="section-title">Frecuentes</h2>
            <span className="small muted">Un toque para añadir</span>
          </div>
          <div className="fav-list">
            {favs.map((f) => (
              <div className="fav" key={f.name}>
                <button type="button" className="fav-main" onClick={() => {
                  pushMeal({ name: f.name, kcal: f.kcal, p: f.p, c: f.c, g: f.g });
                  setToast(`${f.name} añadido · ${f.kcal} kcal`);
                }}>
                  <span className="fav-name">{f.name}</span>
                  <span className="tiny muted">{f.kcal} kcal · {f.p} g prot.</span>
                </button>
                <button type="button" className="fav-x" aria-label={`Quitar ${f.name} de frecuentes`} onClick={() => setFavs((fs) => fs.filter((x) => x.name !== f.name))}>×</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comidas del día */}
      <section className="section" aria-labelledby="h-meals">
        <div className="section-head">
          <h2 id="h-meals" className="section-title">{active === today ? "Comidas de hoy" : `Comidas · ${dayLabel}`}</h2>
          <span className="section-meta">{fmt(eaten.kcal)} kcal</span>
        </div>
        {meals.length === 0 ? (
          <div className="card"><span className="small muted">Aún no has apuntado ninguna comida.</span></div>
        ) : (
          TYPES.map((t) => {
            const list = meals.filter((m) => m.type === t.key);
            if (!list.length) return null;
            return (
              <div key={t.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px" }}>
                  <span className="label-caps">{t.label}</span>
                  <span className="tiny muted">{fmt(list.reduce((a, m) => a + m.kcal, 0))} kcal</span>
                </div>
                <div className="list">
                  {list.map((m) => (
                    <div className="row" key={m.id} style={{ padding: "12px 0" }}>
                      <div className="grow" style={{ gap: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 500 }}>{m.name}</span>
                        <span className="tiny muted">{m.time && `${m.time} · `}{m.p} P · {m.c} C · {m.g} G</span>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 600, flexShrink: 0 }}>{m.kcal} kcal</span>
                      <button
                        type="button"
                        className={isFav(m.name) ? "icon-btn fav-on" : "icon-btn"}
                        aria-label={isFav(m.name) ? `${m.name} ya está en frecuentes` : `Guardar ${m.name} en frecuentes`}
                        onClick={() => {
                          if (isFav(m.name)) return;
                          addFav({ name: m.name, kcal: m.kcal, p: m.p, c: m.c, g: m.g });
                          setToast(`${m.name} guardado en frecuentes`);
                        }}
                      >
                        ★
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Borrar ${m.name}`} onClick={() => removeMeal(m.id)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Agua */}
      <section className="section" aria-labelledby="h-agua">
        <div className="section-head">
          <h2 id="h-agua" className="section-title">Agua</h2>
          <span className="section-meta">{(glasses * 0.25).toLocaleString("es-ES")} de {(WATER_GOAL * 0.25).toLocaleString("es-ES")} L</span>
        </div>
        <div className="card" style={{ gap: 12 }}>
          <div className="water" role="group" aria-label={`${glasses} vasos de ${WATER_GOAL}`}>
            {Array.from({ length: WATER_GOAL }, (_, i) => (
              <button
                key={i}
                type="button"
                className={i < glasses ? "glass on" : "glass"}
                aria-label={`${i + 1} ${i === 0 ? "vaso" : "vasos"}`}
                onClick={() => setGlasses(i + 1 === glasses ? i : i + 1)}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={() => setGlasses(glasses - 1)} disabled={glasses === 0}>− Vaso</button>
            <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => setGlasses(glasses + 1)}>+ Vaso (250 ml)</button>
          </div>
        </div>
      </section>

      {today && <WeightSection today={today} />}

      {/* Semana */}
      <section className="section" aria-labelledby="h-semana">
        <div className="section-head">
          <h2 id="h-semana" className="section-title">Últimos 7 días</h2>
          {logged.length > 0 && <span className="small muted">Media {fmt(avgKcal)} kcal · {avgP} g prot.</span>}
        </div>
        <div className="card" style={{ padding: "18px 16px 14px", gap: 10 }}>
          <div className="kcal-chart">
            {week.map((d) => (
              <div key={d.key} className="kcal-col" title={`${d.kcal} kcal`}>
                <span className="kcal-goal" style={{ bottom: `${(d.goal / weekMax) * 100}%` }} aria-hidden="true" />
                <span
                  className={d.key === active ? "kcal-bar active" : "kcal-bar"}
                  style={{ height: `${d.logged ? Math.max(3, (d.kcal / weekMax) * 100) : 0}%` }}
                  aria-label={`${d.label}: ${d.kcal} kcal de ${d.goal}`}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", textAlign: "center", fontSize: 11, color: "var(--muted)" }}>
            {week.map((d) => <span key={d.key}>{d.label}</span>)}
          </div>
          <span className="tiny muted">La línea marca tu objetivo de cada día.</span>
        </div>
      </section>

      {active && isGymDay(active) && (
        <div className="card" style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", color: "var(--muted)" }}>
          <InfoIcon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span className="small" style={{ lineHeight: 1.45 }}>Día de entreno: antes de entrenar, 60–80 g de carbohidratos; después, unos 40 g de proteína.</span>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
