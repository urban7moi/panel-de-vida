"use client";

import { useEffect, useState } from "react";
import { useStored } from "@/lib/useStored";
import { useSettings } from "@/lib/useSettings";
import { dateFromKey, dateKey } from "@/lib/agenda";
import { planForWeekday } from "@/lib/settings";
import { CheckIcon } from "../icons";

type Exercise = { id: string; name: string; detail: string };
type Session = { done: string[]; pain: number | null; flex: number | null; notes: string };
type Rehab = { exercises: Exercise[]; sessions: Record<string, Session> };

const EMPTY: Rehab = { exercises: [], sessions: {} };
const emptySession: Session = { done: [], pain: null, flex: null, notes: "" };
const short = (key: string) => dateFromKey(key).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");

/** Color del dolor: verde (poco) → ámbar → naranja (mucho). */
const painColor = (p: number) => (p <= 3 ? "var(--good)" : p <= 6 ? "var(--warn)" : "var(--accent)");

export default function RehabSection() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(dateKey(new Date())), []);
  const [settings] = useSettings();
  const [data, setData] = useStored<Rehab>("rodilla", EMPTY);
  const rehab = { ...EMPTY, ...data };
  const [day, setDay] = useState<string | null>(null);
  const active = day ?? today;
  const session = (active && rehab.sessions[active]) || emptySession;
  const isRehabDay = active ? planForWeekday(settings, dateFromKey(active).getDay()) === "rehab" : false;
  const [editing, setEditing] = useState(false);
  const [newEx, setNewEx] = useState({ name: "", detail: "" });

  const setSession = (patch: Partial<Session>) =>
    active && setData((d) => {
      const cur = { ...EMPTY, ...d };
      return { ...cur, sessions: { ...cur.sessions, [active]: { ...emptySession, ...cur.sessions[active], ...patch } } };
    });
  const toggle = (id: string) => setSession({ done: session.done.includes(id) ? session.done.filter((x) => x !== id) : [...session.done, id] });

  function addExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!newEx.name.trim()) return;
    setData((d) => ({ ...EMPTY, ...d, exercises: [...(d.exercises ?? []), { id: crypto.randomUUID(), name: newEx.name.trim(), detail: newEx.detail.trim() }] }));
    setNewEx({ name: "", detail: "" });
  }
  const removeExercise = (id: string) => setData((d) => ({ ...EMPTY, ...d, exercises: (d.exercises ?? []).filter((x) => x.id !== id) }));

  // Historial: sesiones con algo apuntado, de la más reciente a la más antigua
  const history = Object.entries(rehab.sessions)
    .filter(([, s]) => s.done.length || s.pain !== null || s.flex !== null || s.notes)
    .sort((a, b) => b[0].localeCompare(a[0]));
  const chart = history.filter(([, s]) => s.pain !== null).slice(0, 10).reverse();
  const flexes = history.filter(([, s]) => s.flex !== null);

  if (!today || !active) return null;
  const logged = !!rehab.sessions[active];

  return (
    <section className="section" aria-labelledby="h-rodilla">
      <div className="section-head">
        <h2 id="h-rodilla" className="section-title">Rodilla</h2>
        <button type="button" className="link-btn" onClick={() => setEditing(!editing)}>{editing ? "Listo" : "Mis ejercicios"}</button>
      </div>

      {editing ? (
        <div className="card" style={{ gap: 12 }}>
          <span className="small muted">Los ejercicios que te ha pautado el fisio. Saldrán para marcarlos en cada sesión.</span>
          {rehab.exercises.length > 0 && (
            <div className="list" style={{ background: "var(--card-2)" }}>
              {rehab.exercises.map((x) => (
                <div className="row" key={x.id} style={{ padding: "10px 0" }}>
                  <div className="grow" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 500 }}>{x.name}</span>
                    {x.detail && <span className="tiny muted">{x.detail}</span>}
                  </div>
                  <button type="button" className="icon-btn" aria-label={`Quitar ${x.name}`} onClick={() => removeExercise(x.id)}>×</button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={addExercise} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input className="input" placeholder="Ej. Extensión de rodilla en camilla" value={newEx.name} onChange={(e) => setNewEx({ ...newEx, name: e.target.value })} aria-label="Nombre del ejercicio" />
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="Ej. 3 × 15" value={newEx.detail} onChange={(e) => setNewEx({ ...newEx, detail: e.target.value })} aria-label="Series y repeticiones" />
              <button type="submit" className="btn-primary" style={{ width: "auto", padding: "0 18px" }} disabled={!newEx.name.trim()}>Añadir</button>
            </div>
          </form>
        </div>
      ) : (
        <div className={isRehabDay && active === today ? "card rehab-today" : "card"} style={{ gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="label-caps">{active === today ? "Sesión de hoy" : short(active)}</span>
              <span className="tiny muted">{isRehabDay ? "Día de rehabilitación" : logged ? "Sesión apuntada" : "Puedes apuntar una sesión extra"}</span>
            </div>
            {active !== today && <button type="button" className="link-btn" onClick={() => setDay(null)}>Hoy</button>}
          </div>

          {rehab.exercises.length === 0 ? (
            <button type="button" className="add-btn" onClick={() => setEditing(true)}>
              <span className="add-plus" aria-hidden="true">+</span>
              Añadir los ejercicios del fisio
            </button>
          ) : (
            <div className="list" style={{ background: "var(--card-2)" }}>
              {rehab.exercises.map((x) => {
                const done = session.done.includes(x.id);
                return (
                  <label className="task" key={x.id}>
                    <input type="checkbox" checked={done} onChange={() => toggle(x.id)} />
                    <span className="check" aria-hidden="true">{done && <CheckIcon size={14} />}</span>
                    <span className="grow" style={{ gap: 2 }}>
                      <span className={done ? "task-title done" : "task-title"}>{x.name}</span>
                      {x.detail && <span className="tiny muted">{x.detail}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="small">Dolor durante la sesión <span className="muted">(0 = nada, 10 = mucho)</span></span>
            <div className="pain-scale" role="radiogroup" aria-label="Dolor de 0 a 10">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={session.pain === i}
                  className="pain-btn"
                  style={session.pain === i ? { background: painColor(i), borderColor: painColor(i), color: "var(--on-accent)" } : undefined}
                  onClick={() => setSession({ pain: session.pain === i ? null : i })}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <label className="field" style={{ width: 130, flexShrink: 0 }}>Flexión (grados)
              <input
                className="input"
                inputMode="numeric"
                placeholder="Opcional"
                value={session.flex ?? ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setSession({ flex: isNaN(n) ? null : Math.min(180, Math.max(0, n)) });
                }}
              />
            </label>
            <label className="field" style={{ flex: 1 }}>Notas
              <input className="input" placeholder="Ej. Molestia al bajar escaleras" value={session.notes} onChange={(e) => setSession({ notes: e.target.value })} />
            </label>
          </div>
          <span className="tiny muted">Se guarda solo. Si algo te preocupa, coméntalo con tu fisio.</span>
        </div>
      )}

      {/* Evolución */}
      {chart.length >= 2 && (
        <div className="card" style={{ padding: "16px 16px 12px", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="small muted">Dolor en las últimas sesiones</span>
            {flexes.length > 0 && <span className="tiny muted">Flexión: {flexes[flexes.length - 1][1].flex}° → {flexes[0][1].flex}°</span>}
          </div>
          <div className="pain-chart">
            {chart.map(([d, s]) => (
              <button key={d} type="button" className="pain-col" onClick={() => setDay(d)} aria-label={`${short(d)}: dolor ${s.pain} de 10`}>
                <span className="tiny" style={{ fontWeight: 600 }}>{s.pain}</span>
                <span className="pain-bar" style={{ height: `${Math.max(4, (s.pain! / 10) * 100)}%`, background: painColor(s.pain!) }} />
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${chart.length}, minmax(0, 1fr))`, textAlign: "center", fontSize: 10, color: "var(--muted)" }}>
            {chart.map(([d]) => <span key={d}>{dateFromKey(d).getDate()}/{dateFromKey(d).getMonth() + 1}</span>)}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="list">
          {history.slice(0, 5).map(([d, s]) => (
            <button type="button" className="row row-btn" key={d} onClick={() => setDay(d)} style={{ padding: "12px 0" }}>
              <div className="grow" style={{ gap: 2 }}>
                <span style={{ fontWeight: 500 }}>{short(d)}</span>
                <span className="tiny muted">
                  {rehab.exercises.length ? `${s.done.filter((id) => rehab.exercises.some((x) => x.id === id)).length}/${rehab.exercises.length} ejercicios` : ""}
                  {s.flex !== null ? ` · ${s.flex}°` : ""}
                  {s.notes ? ` · ${s.notes}` : ""}
                </span>
              </div>
              {s.pain !== null && <span style={{ fontWeight: 700, color: painColor(s.pain) }}>{s.pain}/10</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
