"use client";

import { useEffect, useState } from "react";
import type { WorkoutDay } from "./training";

const CACHE = "entrenos-hechos";

/** Entrenos hechos en Hevy por día. Enseña lo guardado al momento y lo actualiza por detrás. */
export function useWorkoutDays() {
  const [days, setDays] = useState<Record<string, WorkoutDay>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE);
      if (raw) setDays(JSON.parse(raw));
    } catch {
      /* sin caché */
    }
    const load = () =>
      fetch("/api/workouts", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (j.status !== "ok") return;
          const map = Object.fromEntries((j.days as WorkoutDay[]).map((d) => [d.date, d]));
          setDays(map);
          try {
            localStorage.setItem(CACHE, JSON.stringify(map));
          } catch {
            /* sin espacio */
          }
        })
        .catch(() => {});
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return days;
}
