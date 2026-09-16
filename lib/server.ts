import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isStaff, type Profile } from "./types";
export function configured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
export async function serverClient() {
  if (!configured())
    throw new Error("The connected workspace is not configured yet.");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server Components rely on proxy to refresh cookies. */
          }
        },
      },
    },
  );
}
export function adminClient() {
  if (!process.env.SUPABASE_SECRET_KEY)
    throw new Error("This integration needs server configuration.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function getSessionUser() {
  if (!configured()) return null;
  const supabase = await serverClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } =
    await supabase.rpc("my_profile");
  if (profileError || !profile)
    return { supabase, user, profile: null, mfaRequired: false };
  const p = profile as Profile;
  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired =
    isStaff(p.role) &&
    (process.env.REQUIRE_STAFF_MFA === "true" ||
      Boolean((profile as { mfa_required?: boolean }).mfa_required)) &&
    assurance?.currentLevel !== "aal2";
  return { supabase, user, profile: p, mfaRequired };
}
export async function requireUser() {
  const auth = await getSessionUser();
  if (!auth)
    throw new HttpError(401, "Your session expired. Please sign in again.");
  if (!auth.profile?.active)
    throw new HttpError(
      403,
      "Your access is inactive or an invitation needs to be accepted.",
    );
  if (auth.mfaRequired)
    throw new HttpError(403, "Verify two-step authentication to continue.");
  return { ...auth, profile: auth.profile };
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function errorResponse(e: unknown) {
  if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status });
  return Response.json(
    {
      error:
        e instanceof Error
          ? e.message
          : "The operation failed. Please try again.",
    },
    { status: 400 },
  );
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : new URL(request.url).origin;
  if (!origin || origin !== expected)
    throw new HttpError(
      403,
      "This request did not originate from your workspace.",
    );
}
