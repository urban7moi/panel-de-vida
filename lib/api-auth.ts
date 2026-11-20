import { cookies } from "next/headers";
import { AUTH_COOKIE, tokenFor } from "./auth";

/** Comprueba en las rutas /api que la petición viene de alguien que ha entrado con la contraseña. */
export async function isLoggedIn() {
  const password = process.env.APP_PASSWORD?.trim();
  if (!password) return process.env.NODE_ENV !== "production";
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === (await tokenFor(password));
}
