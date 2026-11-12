import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, tokenFor } from "./auth";

/** Comprueba en el servidor que has entrado con la contraseña. Si no, manda al login. */
export async function requireAuth() {
  const password = process.env.APP_PASSWORD;
  // Sin contraseña configurada (desarrollo local), la app queda abierta.
  if (!password) return;
  const jar = await cookies();
  const cookie = jar.get(AUTH_COOKIE)?.value;
  if (!cookie || cookie !== (await tokenFor(password))) redirect("/login");
}
