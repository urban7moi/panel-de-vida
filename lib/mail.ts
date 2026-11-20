// Lee tus emails recientes por IMAP con una contraseña de aplicación (solo lectura).
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { madridToISO, TZ } from "./time";

export type Mail = {
  id: string;
  from: string;
  initials: string;
  subject: string;
  preview: string;
  time: string; // "08:41"
  day: "hoy" | "ayer";
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

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

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

/**
 * Emails de hoy y de ayer de la bandeja "Principal" de Gmail (sin Promociones,
 * Social, Notificaciones ni Foros), del más nuevo al más antiguo.
 */
export async function recentMail(max = 40): Promise<{ mails: Mail[]; unreadTotal: number }> {
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

  // Desde las 00:00 de ayer (hora de Madrid).
  const yesterdayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() - 864e5));
  const from = new Date(madridToISO(`${yesterdayKey}T00:00:00`)).getTime();

  await client.connect();
  const out: (Mail & { ts: number })[] = [];
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const gmail = client.capabilities.has("X-GM-EXT-1");
      // SINCE va por fechas del servidor: pedimos un día de margen y filtramos por hora después.
      const since = new Date(from - 864e5);
      let found: number[] | false | undefined;
      try {
        found = await client.search(gmail ? { gmraw: "category:primary", since } : { since }, { uid: true });
      } catch {
        found = false;
      }
      // Si el servidor no admite el filtro de Gmail (devuelve false), toda la bandeja de entrada.
      if (found === false) found = await client.search({ since }, { uid: true });
      const uids = (found || []).slice(-max);
      if (uids.length > 0) {
        const msgs = await client.fetchAll(
          uids,
          { uid: true, envelope: true, flags: true, internalDate: true, source: { maxLength: 8_000 } },
          { uid: true },
        );
        for (const m of msgs) {
          const date = new Date(m.internalDate ?? m.envelope?.date ?? Date.now());
          if (date.getTime() < from) continue;
          const sender = m.envelope?.from?.[0];
          const name = sender?.name || sender?.address || "Desconocido";
          let preview = "";
          if (m.source) {
            try {
              const parsed = await simpleParser(m.source);
              preview = (parsed.text ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
            } catch {
              /* vista previa opcional */
            }
          }
          const flags = m.flags ? [...m.flags] : [];
          out.push({
            ts: date.getTime(),
            id: String(m.uid),
            from: name,
            initials: initialsOf(name),
            subject: m.envelope?.subject || "(Sin asunto)",
            preview,
            time: new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date),
            day: dayKey(date) === dayKey(new Date()) ? "hoy" : "ayer",
            important: false,
            unread: !flags.includes("\\Seen"),
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  const mails = out
    .sort((a, b) => b.ts - a.ts)
    .map((m) => ({ ...m, ts: undefined })) as Mail[];
  return { mails, unreadTotal: mails.filter((m) => m.unread).length };
}
