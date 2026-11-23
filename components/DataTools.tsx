"use client";

import { useRef, useState } from "react";
import { addDays, dateKey, tasksOn, type RecurringTask, type Task } from "@/lib/agenda";

const KEYS = [
  "ajustes",
  "tareas-v3",
  "tareas-recurrentes",
  "recurrentes-hechas",
  "entreno-horas",
  "comidas-v2",
  "comidas-frecuentes",
  "agua",
  "peso",
  "rodilla",
  "nutri-planes",
  "resumen-semanal",
];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** CSV con punto y coma (lo que espera Excel en español) y BOM para las tildes. */
function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

/** Comparte el archivo (menú del iPhone: guardar en Archivos, enviar…) o, si no se puede, lo descarga. */
async function deliver(name: string, content: string, type: string) {
  const file = new File([content], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function DataTools() {
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const stamp = dateKey(new Date());

  const exports: { label: string; file: string; build: () => string }[] = [
    {
      label: "Comidas",
      file: `comidas-${stamp}.csv`,
      build: () => {
        const meals = read<Record<string, { name: string; type: string; time: string; kcal: number; p: number; c: number; g: number }[]>>("comidas-v2", {});
        const rows = Object.keys(meals)
          .sort()
          .flatMap((d) => meals[d].map((m) => [d, m.type, m.time, m.name, m.kcal, m.p, m.c, m.g]));
        return toCsv(["Fecha", "Tipo", "Hora", "Comida", "Kcal", "Proteína (g)", "Carbohidratos (g)", "Grasa (g)"], rows);
      },
    },
    {
      label: "Peso",
      file: `peso-${stamp}.csv`,
      build: () => {
        const w = read<Record<string, number>>("peso", {});
        return toCsv(["Fecha", "Peso (kg)"], Object.keys(w).sort().map((d) => [d, w[d]]));
      },
    },
    {
      label: "Tareas",
      file: `tareas-${stamp}.csv`,
      build: () => {
        const single = read<Record<string, Task[]>>("tareas-v3", {});
        const rec = read<RecurringTask[]>("tareas-recurrentes", []);
        const done = read<Record<string, string[]>>("recurrentes-hechas", {});
        const days = new Set([...Object.keys(single), ...Object.keys(done)]);
        // Incluye los últimos 90 días para que salgan también las tareas que se repiten.
        for (let i = 0; i < 90; i++) days.add(addDays(stamp, -i));
        const rows = [...days]
          .sort()
          .flatMap((d) => tasksOn(d, single, rec, done).map((t) => [d, t.time, t.end ?? "", t.title, t.stars, t.done ? "Sí" : "No", t.repeat ?? ""]));
        return toCsv(["Fecha", "Inicio", "Fin", "Tarea", "Estrellas", "Hecha", "Se repite"], rows);
      },
    },
    {
      label: "Agua",
      file: `agua-${stamp}.csv`,
      build: () => {
        const w = read<Record<string, number>>("agua", {});
        return toCsv(["Fecha", "Vasos", "Litros"], Object.keys(w).sort().map((d) => [d, w[d], w[d] * 0.25]));
      },
    },
  ];

  async function backup() {
    const data = Object.fromEntries(KEYS.map((k) => [k, read(k, null)]).filter(([, v]) => v !== null));
    await deliver(`copia-panel-${stamp}.json`, JSON.stringify({ app: "panel-de-vida", version: 1, date: stamp, data }, null, 2), "application/json");
    setMsg("Copia creada. Guárdala en Archivos o en iCloud Drive.");
  }

  async function restore(file: File) {
    try {
      const j = JSON.parse(await file.text());
      if (j.app !== "panel-de-vida" || typeof j.data !== "object") throw new Error();
      if (!confirm(`¿Restaurar la copia del ${j.date}? Sustituye los datos actuales de este iPhone (y de la nube).`)) return;
      const t = Date.now();
      for (const k of KEYS) {
        if (j.data[k] === undefined) continue;
        localStorage.setItem(k, JSON.stringify(j.data[k]));
        localStorage.setItem(`${k}__t`, String(t));
        localStorage.setItem(`${k}__dirty`, "1");
      }
      setMsg("Copia restaurada. Recargando…");
      setTimeout(() => location.reload(), 600);
    } catch {
      setMsg("Ese archivo no es una copia válida del panel.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="section" aria-labelledby="h-datos">
      <h2 id="h-datos" className="section-title">Tus datos</h2>
      <div className="card" style={{ gap: 12 }}>
        <span className="small muted" style={{ lineHeight: 1.5 }}>Exporta a Excel (CSV), por ejemplo para llevárselo a tu nutricionista.</span>
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {exports.map((x) => (
            <button key={x.file} type="button" className="chip-btn" onClick={() => deliver(x.file, x.build(), "text/csv")}>
              {x.label}
            </button>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="small muted" style={{ lineHeight: 1.5 }}>Copia completa de todo (tareas, comidas, peso, ajustes…) para guardarla o pasarla a otro móvil.</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={backup}>Hacer copia</button>
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>Restaurar</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
            }}
          />
        </div>
        {msg && <span className="small" style={{ color: "var(--accent-text)" }}>{msg}</span>}
      </div>
    </section>
  );
}
