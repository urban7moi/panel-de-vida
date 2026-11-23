"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Estado que se guarda en el iPhone (localStorage) y, si la nube está configurada,
 * también en la base de datos: así no se pierde y se ve igual en todos tus dispositivos.
 * Si dos cambios chocan, gana el más reciente.
 */

const SYNC_KEYS = new Set([
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
]);

type Entry = { v: unknown; t: number };
type Listener = (v: unknown) => void;

const listeners = new Map<string, Set<Listener>>();
let cloudOff = false; // la nube no está configurada: no se vuelve a preguntar

function readLocal(key: string): Entry | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return { v: JSON.parse(raw), t: Number(localStorage.getItem(`${key}__t`)) || 0 };
  } catch {
    return null;
  }
}
function writeLocal(key: string, v: unknown, t: number, dirty: boolean) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    localStorage.setItem(`${key}__t`, String(t));
    if (dirty) localStorage.setItem(`${key}__dirty`, "1");
    else localStorage.removeItem(`${key}__dirty`);
  } catch {
    /* sin espacio o sin almacenamiento */
  }
}
const isDirty = (key: string) => {
  try {
    return localStorage.getItem(`${key}__dirty`) === "1";
  } catch {
    return false;
  }
};
function emit(key: string, v: unknown, except?: Listener) {
  listeners.get(key)?.forEach((l) => l !== except && l(v));
}

// --- Subir cambios (con un pequeño retardo para agrupar) ---
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
function schedulePush(key: string) {
  if (cloudOff) return;
  clearTimeout(pushTimers.get(key));
  pushTimers.set(key, setTimeout(() => push(key), 700));
}
async function push(key: string, keepalive = false) {
  clearTimeout(pushTimers.get(key));
  pushTimers.delete(key);
  const local = readLocal(key);
  if (!local) return;
  try {
    const body = JSON.stringify({ key, v: local.v, t: local.t || Date.now() });
    const res = await fetch("/api/store", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body,
      // Al salir de la app, el envío sigue aunque la pantalla se cierre (si cabe en 64 KB).
      keepalive: keepalive && body.length < 60_000,
    });
    const j = await res.json();
    if (j.configured === false) {
      cloudOff = true;
      return;
    }
    if (!res.ok) return; // se reintentará la próxima vez
    const saved = j.saved as Entry;
    if (saved.t > local.t) {
      writeLocal(key, saved.v, saved.t, false);
      emit(key, saved.v);
    } else {
      writeLocal(key, local.v, local.t || saved.t, false);
    }
  } catch {
    /* sin conexión: queda pendiente */
  }
}

// --- Bajar cambios (agrupando todas las claves en una sola petición) ---
const pending = new Set<string>();
let pullTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePull(key: string) {
  if (cloudOff) return;
  pending.add(key);
  clearTimeout(pullTimer);
  pullTimer = setTimeout(pull, 30);
}
async function pull() {
  const keys = [...pending];
  pending.clear();
  if (!keys.length) return;
  try {
    const res = await fetch(`/api/store?keys=${keys.join(",")}`, { cache: "no-store" });
    const j = await res.json();
    if (j.configured === false) {
      cloudOff = true;
      return;
    }
    if (!res.ok) return;
    for (const key of keys) {
      const remote = (j.data?.[key] ?? null) as Entry | null;
      const local = readLocal(key);
      if (remote && (!local || remote.t > local.t) && !(local && isDirty(key) && local.t >= remote.t)) {
        writeLocal(key, remote.v, remote.t, false);
        emit(key, remote.v);
      } else if (local && (!remote || local.t > remote.t || isDirty(key))) {
        if (!local.t) writeLocal(key, local.v, Date.now(), true);
        push(key);
      }
    }
  } catch {
    /* sin conexión */
  }
}

/** Envía ya los cambios que estaban esperando (al salir de la app). */
function flush() {
  [...pushTimers.keys()].forEach((key) => push(key, true));
}

// Al salir de la app se envía lo pendiente; al volver, se trae lo último de la nube.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
    else listeners.forEach((set, key) => set.size && SYNC_KEYS.has(key) && schedulePull(key));
  });
  window.addEventListener("pagehide", flush);
  // Al abrir la app, sube lo que se quedó sin enviar la última vez (en cualquier pantalla).
  setTimeout(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.endsWith("__dirty"))
        .map((k) => k.slice(0, -"__dirty".length))
        .filter((k) => SYNC_KEYS.has(k))
        .forEach((k) => push(k));
    } catch {
      /* sin almacenamiento */
    }
  }, 1500);
}

export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const current = useRef<T>(initial);
  const sync = SYNC_KEYS.has(key);

  useEffect(() => {
    const local = readLocal(key);
    current.current = (local ? local.v : initial) as T;
    setValue(current.current);
    const onRemote: Listener = (v) => {
      current.current = v as T;
      setValue(v as T);
    };
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(onRemote);
    if (sync) schedulePull(key);
    return () => {
      set!.delete(onRemote);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStored = useCallback(
    (next: T | ((prev: T) => T)) => {
      const v = typeof next === "function" ? (next as (prev: T) => T)(current.current) : next;
      current.current = v;
      setValue(v);
      writeLocal(key, v, Date.now(), sync);
      emit(key, v);
      if (sync) schedulePush(key);
    },
    [key, sync],
  );

  return [value, setStored] as const;
}
