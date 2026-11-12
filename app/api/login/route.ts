import { NextResponse } from "next/server";
import { AUTH_COOKIE, tokenFor } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const given = String(form.get("password") ?? "").trim();
  const password = process.env.APP_PASSWORD?.trim();
  const base = new URL(req.url);

  if (!password) {
    return NextResponse.redirect(new URL("/login?error=config", base), 303);
  }
  if (given !== password) {
    return NextResponse.redirect(new URL("/login?error=1", base), 303);
  }

  const res = NextResponse.redirect(new URL("/", base), 303);
  res.cookies.set(AUTH_COOKIE, await tokenFor(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
