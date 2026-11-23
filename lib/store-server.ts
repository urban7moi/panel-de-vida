// Almacén en la nube (Upstash Redis, gratis desde Vercel → Storage).
// Si no está configurado, la app funciona igual guardando solo en el móvil.
import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

export function redis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

export const cloudConfigured = () => redis() !== null;

/** Datos que se sincronizan entre el móvil y la nube. */
export const SYNC_KEYS = [
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
] as const;
export type SyncKey = (typeof SYNC_KEYS)[number];
export const isSyncKey = (k: string): k is SyncKey => (SYNC_KEYS as readonly string[]).includes(k);

export type Stored<T = unknown> = { v: T; t: number };

const K = (key: string) => `panel:${key}`;

export async function getStored<T = unknown>(key: string): Promise<Stored<T> | null> {
  const r = redis();
  if (!r) return null;
  return (await r.get<Stored<T>>(K(key))) ?? null;
}

export async function getMany(keys: string[]): Promise<Record<string, Stored | null>> {
  const r = redis();
  if (!r || keys.length === 0) return {};
  const values = await r.mget<(Stored | null)[]>(...keys.map(K));
  return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? null]));
}

/** Guarda solo si es más nuevo que lo que hay (gana el último cambio). */
export async function putStored(key: string, value: unknown, t: number): Promise<Stored> {
  const r = redis()!;
  const current = await r.get<Stored>(K(key));
  if (current && current.t >= t) return current;
  const next = { v: value, t };
  await r.set(K(key), next);
  return next;
}

/** Valores internos del servidor (claves de notificaciones, suscripciones…). */
export async function getInternal<T>(key: string): Promise<T | null> {
  const r = redis();
  return r ? ((await r.get<T>(`panel-internal:${key}`)) ?? null) : null;
}
export async function setInternal(key: string, value: unknown) {
  const r = redis();
  if (r) await r.set(`panel-internal:${key}`, value);
}
