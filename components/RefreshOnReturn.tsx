"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * En el iPhone, al volver a la app no se recarga la pantalla. Si has estado fuera
 * más de 20 segundos (por ejemplo, terminando el entreno en Hevy), trae los datos nuevos.
 */
export default function RefreshOnReturn() {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > 20_000) {
        hiddenAt.current = null;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);
  return null;
}
