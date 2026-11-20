// Lee tus emails recientes por IMAP con una contraseña de aplicación (solo lectura).
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { TZ } from "./time";

export type Mail = {
  id: string;
  from: string;
  initials: string;
  subject: string;
  preview: string;
  time: string; // "08:41", "Ayer" o "18 nov"
  important: boolean;
  unread: boolean;
};

function credentials() {
  const user = (process.env.EMAIL_USER ?? "").trim();
  const pass = (process.env.EMAIL_APP_PASSWORD ?? process.env.EMAIL_PASSWORD ?? "").replace(/\s+/g, "");
  return user && pass ? { user, pass } : null;
}

export function mailConfigured() {
  return credentials() !== null;
}

/** Servidor IMAP según el dominio (se puede forzar con EMAIL_IMAP_HOST). */
function imapHost(user: string) {
  if (process.env.EMAIL_IMAP_HOST) return process.env.EMAIL_IMAP_HOST;
  const domain = user.split("@")[1]?.toLowerCase() ?? "";
  if (["icloud.com", "me.com", "mac.com"].includes(domain)) return "imap.mail.me.com";
  if (/^(outlook|hotmail|live|msn)\./.test(domain)) return "outlook.office365.com";
  if (domain.startsWith("yahoo.")) return "imap.mail.yahoo.com";
  return "imap.gmail.com";
}

function when(date: Date) {
  const key = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const today = key(new Date());
  const yesterday = key(new Date(Date.now() - 864e5));
  if (key(date) === today)
    return new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  if (key(date) === yesterday) return "Ayer";
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: TZ });
}

function initialsOf(name: string) {
  return (
    name
      .replace(/["<>]/g, "")
      .split(/\s+/)
      .filter((w) => /^[\p{L}\p{N}]/u.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}

/** Últimos emails de la bandeja de entrada (por defecto, 3 días y 15 como máximo). */
export async function recentMail(days = 3, max = 15): Promise<Mail[]> {
  const cred = credentials();
  if (!cred) throw new Error("sin-configurar");
  const client = new ImapFlow({
    host: imapHost(cred.user),
    port: Number(process.env.EMAIL_IMAP_PORT) || 993,
    secure: (Number(process.env.EMAIL_IMAP_PORT) || 993) === 993,
    auth: cred,
    logger: false,
    connectionTimeout: 10_000,
  });
  await client.connect();
  const out: (Mail & { ts: number })[] = [];
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const since = new Date(Date.now() - days * 864e5);
      const uids = ((await client.search({ since }, { uid: true })) || []).slice(-max);
      if (uids.length === 0) return [];
      const gmail = client.capabilities.has("X-GM-EXT-1");
      const msgs = await client.fetchAll(
        uids,
        { uid: true, envelope: true, flags: true, internalDate: true, labels: gmail, source: { maxLength: 16_000 } },
        { uid: true },
      );
      for (const m of msgs) {
        const from = m.envelope?.from?.[0];
        const name = from?.name || from?.address || "Desconocido";
        let preview = "";
        if (m.source) {
          try {
            const parsed = await simpleParser(m.source);
            preview = (parsed.text ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
          } catch {
            /* vista previa opcional */
          }
        }
        const labels = m.labels ? [...m.labels] : [];
        const flags = m.flags ? [...m.flags] : [];
        out.push({
          ts: new Date(m.internalDate ?? m.envelope?.date ?? Date.now()).getTime(),
          id: String(m.uid),
          from: name,
          initials: initialsOf(name),
          subject: m.envelope?.subject || "(Sin asunto)",
          preview,
          time: when(new Date(m.internalDate ?? m.envelope?.date ?? Date.now())),
          important: gmail ? labels.includes("\\Important") : flags.includes("\\Flagged") || !flags.includes("\\Seen"),
          unread: !flags.includes("\\Seen"),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  // Más recientes primero.
  return out.sort((a, b) => b.ts - a.ts).map((m) => ({ ...m, ts: undefined })) as Mail[];
}
