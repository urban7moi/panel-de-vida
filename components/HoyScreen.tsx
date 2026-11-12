"use client";

import { useEffect, useMemo, useState } from "react";
import { CameraIcon, CheckIcon, SunIcon, CalendarIcon } from "./icons";
import { events, mails, tasks, type Source } from "@/lib/mock";
import { useStored } from "@/lib/useStored";

const sourceColor: Record<Source, string> = {
  google: "var(--google)",
  apple: "var(--apple)",
  note: "var(--text)",
};

const DOW = ["L", "M", "X", "J", "V", "S", "D"];

function todayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function HoyScreen() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const week = useMemo(() => {
    if (!now) return [];
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return DOW.map((dow, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { dow, date: d, key: todayKey(d) };
    });
  }, [now]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const activeDay = selectedDay ?? (now ? todayKey(now) : null);

  const [done, setDone] = useStored<Record<string, boolean>>(
    `tareas-${now ? todayKey(now) : "hoy"}`,
    {},
  );
  const doneCount = tasks.filter((t) => done[t.id]).length;

  const [mailTab, setMailTab] = useState<"imp" | "all">("imp");
  const visibleMails = mailTab === "imp" ? mails.filter((m) => m.important) : mails;

  const greeting = !now
    ? "Hola"
    : now.getHours() < 13
      ? "Buenos días"
      : now.getHours() < 21
        ? "Buenas tardes"
        : "Buenas noches";

  const dateLabel = now
    ? now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <main className="screen">
      <header className="header">
        <div className="header-titles">
          <span className="eyebrow">{dateLabel}&nbsp;</span>
          <h1 className="title">{greeting}</h1>
        </div>
      </header>

      {/* Resumen de la mañana */}
      <section className="card" aria-labelledby="h-resumen">
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)" }}>
          <SunIcon size={18} />
          <h2 id="h-resumen" className="label-caps">Resumen de la mañana</h2>
        </div>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5 }}>
          Tienes <strong>{events.length} eventos</strong> hoy, el primero a las {events[0].start}. Hay{" "}
          <strong>{tasks.length} tareas</strong> de tu nota escrita y{" "}
          <strong>{mails.filter((m) => m.important).length} emails</strong> que necesitan respuesta. Hoy toca
          entrenar pierna a las 19:00.
        </p>
        <div className="tiles">
          <div className="tile">
            <span className="tile-value">{events.length}</span>
            <span className="tile-label">Eventos</span>
          </div>
          <div className="tile">
            <span className="tile-value">{tasks.length - doneCount}</span>
            <span className="tile-label">Tareas pend.</span>
          </div>
          <div className="tile">
            <span className="tile-value">{mails.filter((m) => m.important).length}</span>
            <span className="tile-label">Por responder</span>
          </div>
        </div>
      </section>

      {/* Calendario */}
      <section className="section" aria-labelledby="h-cal">
        <div className="section-head">
          <h2 id="h-cal" className="section-title">Calendario</h2>
          <a href="#" className="section-link">Ver semana</a>
        </div>
        <div className="week">
          {week.map((d) => (
            <button
              key={d.key}
              className="day"
              aria-pressed={d.key === activeDay}
              aria-label={d.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}
              onClick={() => setSelectedDay(d.key)}
            >
              <span className="day-dow">{d.dow}</span>
              <span className="day-num">{d.date.getDate()}</span>
            </button>
          ))}
        </div>
        <div className="list">
          {events.map((e) => (
            <div className="row" key={e.start + e.title}>
              <div className="time-col">
                <span style={{ fontSize: 15, fontWeight: 600 }}>{e.start}</span>
                <span className="tiny muted">{e.end}</span>
              </div>
              <div className="source-bar" style={{ background: sourceColor[e.source] }} />
              <div className="grow">
                <span style={{ fontSize: 16, fontWeight: 500 }}>{e.title}</span>
                <span className="small muted">{e.meta}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="legend">
          <span><i className="dot" style={{ background: "var(--google)" }} />Google Calendar</span>
          <span><i className="dot" style={{ background: "var(--apple)" }} />Apple Calendar</span>
          <span><i className="dot" style={{ background: "var(--text)" }} />Desde tu nota</span>
        </div>
      </section>

      {/* Tareas */}
      <section className="section" aria-labelledby="h-tareas">
        <div className="section-head">
          <h2 id="h-tareas" className="section-title">Tareas de hoy</h2>
          <span className="section-meta">{doneCount} de {tasks.length}</span>
        </div>
        <button className="scan" type="button">
          <span className="scan-icon"><CameraIcon size={20} strokeWidth={2} /></span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Escanear nota escrita</span>
            <span className="small muted">Las tareas con hora pasan al calendario</span>
          </span>
        </button>
        <div className="list">
          {tasks.map((t) => (
            <label className="task" key={t.id}>
              <input
                type="checkbox"
                checked={!!done[t.id]}
                onChange={() => setDone({ ...done, [t.id]: !done[t.id] })}
              />
              <span className="check" aria-hidden="true">
                {done[t.id] && <CheckIcon size={14} />}
              </span>
              <span className="grow">
                <span className="task-title">{t.title}</span>
                {t.time && (
                  <span className="tiny muted" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <CalendarIcon size={12} strokeWidth={2} />
                    En calendario · {t.time}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Emails */}
      <section className="section" aria-labelledby="h-mail">
        <div className="section-head">
          <h2 id="h-mail" className="section-title">Emails</h2>
          <a href="#" className="section-link">Ver todos</a>
        </div>
        <div className="segmented" role="tablist" aria-label="Filtrar emails">
          <button role="tab" aria-selected={mailTab === "imp"} onClick={() => setMailTab("imp")}>Importantes</button>
          <button role="tab" aria-selected={mailTab === "all"} onClick={() => setMailTab("all")}>Todos</button>
        </div>
        <div className="list">
          {visibleMails.map((m) => (
            <div className="row mail" key={m.id}>
              <span className="avatar" aria-hidden="true">{m.initials}</span>
              <div className="grow" style={{ gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span className="ellipsis" style={{ fontSize: 15, fontWeight: 600 }}>{m.from}</span>
                  <span className="tiny muted" style={{ flexShrink: 0 }}>{m.time}</span>
                </div>
                <span className="ellipsis" style={{ fontSize: 14, fontWeight: 500 }}>{m.subject}</span>
                <span className="ellipsis small muted">{m.preview}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
