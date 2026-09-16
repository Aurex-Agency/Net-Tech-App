"use client";
import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Mail } from "lucide-react";
import { browserClient } from "@/lib/browser";
import { Alert } from "./ui";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <Image src="/net-tech-mark.png" width={36} height={40} alt="" />
      <span>
        NET<span className="brand-hyphen">-</span>TECH<small>CONNECT</small>
      </span>
    </Link>
  );
}
export function AuthForm({
  recovery = false,
  invite = false,
}: {
  recovery?: boolean;
  invite?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const requestedNext = params.get("next") ?? "/workspace";
  const destination =
    /^\/workspace(?:\/|$)/.test(requestedNext) && !requestedNext.includes("\\")
      ? requestedNext
      : "/workspace";
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [magic, setMagic] = useState(false),
    [forgot, setForgot] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const form = new FormData(e.currentTarget);
    try {
      const supabase = browserClient();
      if (invite) {
        const response = await fetch("/api/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: params.get("token") }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        const { error } = await supabase.auth.updateUser({
          password: String(form.get("password")),
        });
        if (error) throw error;
        router.replace(destination);
        router.refresh();
        return;
      }
      if (recovery) {
        const { error } = await supabase.auth.updateUser({
          password: String(form.get("password")),
        });
        if (error) throw error;
        router.replace(destination);
        router.refresh();
        return;
      }
      const email = String(form.get("email"));
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/auth/callback?next=/recover",
        });
        if (error) throw error;
        setSuccess(
          "If the account is eligible, a password reset link is on its way.",
        );
      } else if (magic) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo:
              location.origin +
              "/auth/callback?next=" +
              encodeURIComponent(destination),
          },
        });
        if (error) throw error;
        setSuccess(
          "If the account is eligible, check your email for a secure sign-in link.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: String(form.get("password")),
        });
        if (error)
          throw new Error(
            "We couldn’t sign you in. Check your email and password, then try again.",
          );
        router.replace(destination);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-brand-panel">
        <Brand />
        <div>
          <div className="eyebrow">TECHNOLOGY. HANDLED.</div>
          <h2 className="auth-story-heading">
            Your technology.
            <br />
            Your team.
            <br />
            One connection.
          </h2>
          <p>
            Practical support, clear conversations, and a little less to worry
            about.
          </p>
        </div>
        <small>Net-Tech · Serving North Mississippi</small>
      </aside>
      <div className="auth-form-side">
        <form className="auth-form" onSubmit={submit}>
          <Brand />
          <div>
            <h1>
              {invite
                ? "Welcome to your workspace."
                : recovery
                  ? "A fresh start."
                  : forgot
                    ? "Forgot your password?"
                    : "Welcome back."}
            </h1>
            <p style={{ marginTop: 12 }}>
              {invite
                ? "Accept your Net-Tech invitation and choose a password."
                : recovery
                  ? "Choose a new password for your account."
                  : forgot
                    ? "We’ll send you a secure reset link."
                    : "Sign in to your Net-Tech workspace."}
            </p>
          </div>
          {params.get("expired") && (
            <Alert>Your session expired. Sign in again to continue.</Alert>
          )}
          {params.get("error") && (
            <Alert>
              The sign-in link is expired or has already been used. Request a
              new link.
            </Alert>
          )}
          {!invite && !recovery && (
            <label>
              Email address
              <input
                name="email"
                autoComplete="email"
                type="email"
                placeholder="you@company.com"
                required
              />
            </label>
          )}
          {((!magic && !forgot) || recovery || invite) && (
            <label>
              {recovery || invite ? "Choose a password" : "Password"}
              <input
                name="password"
                autoComplete={
                  recovery || invite ? "new-password" : "current-password"
                }
                type="password"
                required
                minLength={recovery || invite ? 12 : 1}
                placeholder={
                  recovery || invite
                    ? "At least 12 characters"
                    : "Enter your password"
                }
              />
            </label>
          )}
          {error && <Alert>{error}</Alert>}
          {success && (
            <div className="success-message" role="status">
              <Mail size={18} />
              {success}
            </div>
          )}
          <button className="button" disabled={busy}>
            {busy
              ? "One moment…"
              : invite
                ? "Accept invitation"
                : recovery
                  ? "Update password"
                  : forgot
                    ? "Send reset link"
                    : magic
                      ? "Send sign-in link"
                      : "Sign in"}
            <ArrowRight size={16} />
          </button>
          {!recovery && !invite && (
            <>
              <div className="auth-footer-links">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setForgot(!forgot);
                    setMagic(false);
                    setError("");
                  }}
                >
                  {forgot ? "Back to sign in" : "Forgot password?"}
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setMagic(!magic);
                    setForgot(false);
                    setError("");
                  }}
                >
                  {magic ? "Use password" : "Use email link"}
                </button>
              </div>
              <div className="auth-divider">or explore</div>
              <Link href="/demo/client" className="button secondary">
                Try the interactive demo
                <ArrowRight size={15} />
              </Link>
              <p className="caption">
                Existing clients join by invitation.
                <br />
                Planning a project?{" "}
                <Link className="text-link" href="/estimate">
                  Request an estimate
                </Link>
              </p>
            </>
          )}
          <p className="caption">
            <ShieldCheck
              size={13}
              style={{ verticalAlign: "middle", marginRight: 5 }}
            />
            Secure access. Only your authorized work.
          </p>
        </form>
      </div>
    </div>
  );
}
export function MfaForm() {
  const params = useSearchParams();
  const router = useRouter();
  const requestedNext = params.get("next") ?? "/workspace";
  const destination =
    /^\/workspace(?:\/|$)/.test(requestedNext) && !requestedNext.includes("\\")
      ? requestedNext
      : "/workspace";
  const [qr, setQr] = useState(""),
    [factor, setFactor] = useState(""),
    [secret, setSecret] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function setup() {
    setBusy(true);
    setError("");
    try {
      const s = browserClient();
      const { data: list, error } = await s.auth.mfa.listFactors();
      if (error) throw error;
      const existing = list.totp.find((f) => f.status === "verified");
      if (existing) {
        setFactor(existing.id);
        return;
      }
      for (const f of list.all.filter((f) => f.status === "unverified"))
        await s.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: enrollError } = await s.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Net-Tech Connect",
      });
      if (enrollError) throw enrollError;
      setFactor(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to set up authentication.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="standalone">
      <Brand />
      <h1>Protect your workspace.</h1>
      <p>Staff use an authenticator app for an extra layer of security.</p>
      {error && <Alert>{error}</Alert>}
      {!factor ? (
        <button className="button" disabled={busy} onClick={() => void setup()}>
          Set up or verify authenticator
        </button>
      ) : (
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const s = browserClient();
              const { error } = await s.auth.mfa.challengeAndVerify({
                factorId: factor,
                code: String(new FormData(e.currentTarget).get("code")),
              });
              if (error) throw error;
              router.replace(destination);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Verification failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {qr && (
            <>
              <Image
                src={qr}
                alt="Scan this QR code in your authenticator"
                width={200}
                height={200}
                unoptimized
              />
              <small>Manual setup key: {secret}</small>
            </>
          )}
          <label>
            Six-digit code
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              required
            />
          </label>
          <button className="button" disabled={busy}>
            Verify and continue
          </button>
        </form>
      )}
    </main>
  );
}
