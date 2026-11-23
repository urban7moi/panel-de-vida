"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/useSettings";

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

type State = "cargando" | "sin-nube" | "no-soportado" | "instalar" | "denegado" | "apagado" | "activo";

/** Ajustes de notificaciones: activar en este iPhone, elegir avisos y probar. */
export default function NotifySettings() {
  const [settings, update] = useSettings();
  const [state, setState] = useState<State>("cargando");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const key = await fetch("/api/push/key").then((r) => r.json()).catch(() => ({ configured: false }));
      if (!key.configured) return setState("sin-nube");
      if (!supported) return setState(standalone ? "no-soportado" : "instalar");
      if (Notification.permission === "denied") return setState("denegado");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "activo" : "apagado");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denegado");
        return;
      }
      const { publicKey } = await fetch("/api/push/key").then((r) => r.json());
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setState("activo");
      setMsg("Listo: recibirás los avisos en este iPhone.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudieron activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setState("apagado");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const j = await fetch("/api/push/test", { method: "POST" }).then((r) => r.json()).catch(() => ({ sent: 0 }));
    setMsg(j.sent ? "Notificación enviada: debería llegarte en unos segundos." : j.error ?? "No se pudo enviar.");
    setBusy(false);
  }

  const toggle = (slot: "morning" | "evening") => update((s) => ({ notify: { ...s.notify, [slot]: !s.notify[slot] } }));

  return (
    <section className="section" aria-labelledby="h-notif">
      <h2 id="h-notif" className="section-title">Notificaciones</h2>
      <div className="card" style={{ gap: 12 }}>
        {state === "cargando" && <span className="small muted">Comprobando…</span>}
        {state === "sin-nube" && <span className="small muted" style={{ lineHeight: 1.5 }}>Necesitan la copia en la nube activada (ver arriba).</span>}
        {state === "instalar" && (
          <span className="small muted" style={{ lineHeight: 1.5 }}>
            En el iPhone, las notificaciones solo funcionan con la app instalada: ábrela desde el icono de tu pantalla de inicio.
          </span>
        )}
        {state === "no-soportado" && <span className="small muted">Este dispositivo no admite notificaciones (necesitas iOS 16.4 o posterior).</span>}
        {state === "denegado" && (
          <span className="small muted" style={{ lineHeight: 1.5 }}>
            Las tienes bloqueadas. Actívalas en Ajustes del iPhone → Notificaciones → Panel.
          </span>
        )}
        {(state === "apagado" || state === "activo") && (
          <>
            <div className="set-row" style={{ minHeight: 44, padding: 0 }}>
              <span className="set-label">
                <span style={{ fontWeight: 500 }}>En este iPhone</span>
                <span className="tiny muted">{state === "activo" ? "Activadas" : "Desactivadas"}</span>
              </span>
              {state === "activo" ? (
                <button type="button" className="btn-secondary" style={{ flex: "0 0 auto", padding: "0 14px", minHeight: 40 }} onClick={disable} disabled={busy}>Desactivar</button>
              ) : (
                <button type="button" className="btn-primary" style={{ width: "auto", padding: "0 16px", minHeight: 40, fontSize: 15 }} onClick={enable} disabled={busy}>Activar</button>
              )}
            </div>
            <label className="toggle-row">
              <input type="checkbox" checked={settings.notify.morning} onChange={() => toggle("morning")} />
              <span><strong style={{ fontWeight: 600 }}>Mañana (~7:30)</strong> <span className="muted">· entreno, tareas y proteína del día</span></span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={settings.notify.evening} onChange={() => toggle("evening")} />
              <span><strong style={{ fontWeight: 600 }}>Tarde (~19:30)</strong> <span className="muted">· proteína y agua que te faltan, tareas pendientes</span></span>
            </label>
            {state === "activo" && (
              <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={test} disabled={busy}>Enviar una notificación de prueba</button>
            )}
          </>
        )}
        {msg && <span className="small" style={{ color: "var(--accent-text)" }}>{msg}</span>}
      </div>
    </section>
  );
}
