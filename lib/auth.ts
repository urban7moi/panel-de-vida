// Acceso con contraseña única (solo tú). La contraseña va en la variable APP_PASSWORD.
export const AUTH_COOKIE = "panel_auth";

export async function tokenFor(password: string) {
  const data = new TextEncoder().encode(`panel-de-vida:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
