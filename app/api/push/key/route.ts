import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/api-auth";
import { cloudConfigured } from "@/lib/store-server";
import { getSubscriptions, vapidKeys } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  if (!cloudConfigured()) return NextResponse.json({ configured: false });
  const [keys, subs] = await Promise.all([vapidKeys(), getSubscriptions()]);
  return NextResponse.json({ configured: true, publicKey: keys.publicKey, devices: subs.length });
}
