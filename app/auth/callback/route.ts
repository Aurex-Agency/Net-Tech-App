import { serverClient } from "@/lib/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const code = url.searchParams.get("code"),
    hash = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  const requested = url.searchParams.get("next") ?? "/workspace";
  const next =
    requested === "/recover" ||
    (/^\/workspace(?:\/|$)/.test(requested) && !requested.includes("\\"))
      ? requested
      : "/workspace";
  try {
    const s = await serverClient();
    let error;
    if (code) ({ error } = await s.auth.exchangeCodeForSession(code));
    else if (hash && ["invite", "magiclink", "recovery"].includes(type ?? ""))
      ({ error } = await s.auth.verifyOtp({
        token_hash: hash,
        type: type as EmailOtpType,
      }));
    else throw new Error("Missing token");
    if (error) throw error;
    const invite = url.searchParams.get("invite");
    return NextResponse.redirect(
      new URL(
        invite
          ? "/invite?token=" + encodeURIComponent(invite)
          : type === "recovery"
            ? "/recover"
            : next,
        origin,
      ),
    );
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=link", origin));
  }
}
