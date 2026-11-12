import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, tokenFor } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  // Sin contraseña configurada (desarrollo local), la app queda abierta.
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await tokenFor(password))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Todo menos el login, los archivos estáticos y lo necesario para instalar la app.
  matcher: ["/((?!login|api/login|_next/|sw\\.js|manifest\\.webmanifest|icon-|apple-touch-icon|favicon).*)"],
};
