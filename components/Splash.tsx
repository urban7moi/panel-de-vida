"use client";

import { useEffect, useState } from "react";
import { Montserrat } from "next/font/google";

// Misma tipografía que el logo (Montserrat Black), solo para la pantalla de inicio.
const brand = Montserrat({ weight: "900", subsets: ["latin"], display: "block" });

/**
 * Pantalla de inicio: aparece la "m." del logo y de ella salen la "o" y la "i"
 * hasta formar "moi.". Solo se ve al abrir la app (no al cambiar de pestaña).
 */
export default function Splash() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 3000);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  return (
    <div className="splash" aria-hidden="true">
      <span className={`splash-word ${brand.className}`}>
        <span>m</span>
        <span className="splash-letter">o</span>
        <span className="splash-letter splash-letter-2">i</span>
        <span>.</span>
      </span>
    </div>
  );
}
