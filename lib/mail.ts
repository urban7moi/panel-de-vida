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

/** Los últimos `count` emails de la bandeja de entrada y cuántos hay sin leer en total. */
export async function recentMail(count = 3): Promise<{ mails: Mail[]; unreadTotal: number }> {
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
  let unreadTotal = 0;
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const exists = client.mailbox ? client.mailbox.exists : 0;
      if (!exists) return { mails: [], unreadTotal: 0 };
      const unseen = (await client.search({ seen: false }, { uid: true })) || [];
      unreadTotal = unseen.length;
      // Los últimos mensajes por número de secuencia (los que entraron más tarde).
      const range = `${Math.max(1, exists - count + 1)}:*`;
      const gmail = client.capabilities.has("X-GM-EXT-1");
      const msgs = await client.fetchAll(range, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        labels: gmail,
        source: { maxLength: 16_000 },
      });
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
  const mails = out
    .sort((a, b) => b.ts - a.ts)
    .slice(0, count)
    .map((m) => ({ ...m, ts: undefined })) as Mail[];
  return { mails, unreadTotal };
}
