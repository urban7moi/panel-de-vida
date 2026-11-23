"use client";

import { useMemo } from "react";
import { useStored } from "./useStored";
import { withDefaults, type Settings } from "./settings";

/** Ajustes del usuario (guardados en el móvil y en la nube). */
export function useSettings() {
  const [raw, setRaw] = useStored<Partial<Settings>>("ajustes", {});
  const settings = useMemo(() => withDefaults(raw), [raw]);
  const update = (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) =>
    setRaw((prev) => {
      const base = withDefaults(prev);
      return { ...base, ...(typeof patch === "function" ? patch(base) : patch) };
    });
  return [settings, update] as const;
}
