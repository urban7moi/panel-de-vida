// Notificaciones push (Web Push). Las claves se crean solas la primera vez y se guardan en la nube.
import { generateVAPIDKeys, sendNotification, setVapidDetails, type PushSubscription } from "web-push";
import { getInternal, setInternal } from "./store-server";

type Vapid = { publicKey: string; privateKey: string };

export async function vapidKeys(): Promise<Vapid> {
  let keys = await getInternal<Vapid>("vapid");
  if (!keys) {
    keys = generateVAPIDKeys();
    await setInternal("vapid", keys);
  }
  return keys;
}

export async function getSubscriptions(): Promise<PushSubscription[]> {
  return (await getInternal<PushSubscription[]>("push-subs")) ?? [];
}

export async function addSubscription(sub: PushSubscription) {
  const subs = (await getSubscriptions()).filter((s) => s.endpoint !== sub.endpoint);
  await setInternal("push-subs", [...subs, sub].slice(-5));
}

export async function removeSubscription(endpoint: string) {
  await setInternal("push-subs", (await getSubscriptions()).filter((s) => s.endpoint !== endpoint));
}

/** Envía a todos tus dispositivos. Quita los que ya no existen. Devuelve cuántos la recibieron. */
export async function sendToAll(payload: { title: string; body: string; url?: string }) {
  const keys = await vapidKeys();
  setVapidDetails("mailto:panel@example.com", keys.publicKey, keys.privateKey);
  const subs = await getSubscriptions();
  let ok = 0;
  for (const sub of subs) {
    try {
      await sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 6 });
      ok++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await removeSubscription(sub.endpoint);
      else console.error("Push", code, err);
    }
  }
  return ok;
}
