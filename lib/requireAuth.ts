import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, tokenFor } from "./auth";

/** Comprueba en el servidor que has entrado con la contraseña. Si no, manda al login. */
export async function requireAuth() {
  const password = process.env.APP_PASSWORD?.trim();
  if (!password) {
    // En local (npm run dev) la app queda abierta; publicada, nunca.
    if (process.env.NODE_ENV !== "production") return;
    redirect("/login?error=config");
  }
  const jar = await cookies();
  const cookie = jar.get(AUTH_COOKIE)?.value;
  if (!cookie || cookie !== (await tokenFor(password))) redirect("/login");
}
