"use client";

import { useEffect, useState } from "react";

/**
 * Estado que se guarda en este dispositivo (localStorage).
 * Provisional: en la fase de datos reales pasará a la base de datos.
 */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      /* sin almacenamiento disponible */
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [key, value, loaded]);

  return [value, setValue] as const;
}
