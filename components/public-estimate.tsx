"use client";
import { useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { Brand } from "./auth";
import { Alert, PageHeading } from "./ui";
import { CheckCircle2, ArrowRight } from "lucide-react";
export function PublicEstimate({ enabled }: { enabled: boolean }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState("");
  const key = useRef(crypto.randomUUID());
  return (
    <main className="public-intake">
      <Brand />
      <PageHeading
        eyebrow="LET’S BUILD WHAT’S NEXT"
        title="Good technology starts with a conversation."
        description="Tell Net-Tech about your project in North Mississippi. We’ll review the details and follow up about an on-site estimate."
      />
      {!enabled && (
        <div className="info-box">
          Online estimate intake is being prepared. This preview does not send
          requests. Call <a href="tel:+16625397787">662-539-7787</a> to contact
          Net-Tech.
        </div>
      )}
      {receipt ? (
        <section className="panel receipt">
          <span className="receipt-check">
            <CheckCircle2 size={36} />
          </span>
          <h2>Thanks. We have your inquiry.</h2>
          <p>Reference {receipt.slice(0, 8).toUpperCase()}</p>
          <p>
            Awaiting scheduling confirmation. No time is reserved and no paid
            work is authorized.
          </p>
          <Link className="button secondary" href="/sign-in">
            Client sign-in
          </Link>
        </section>
      ) : (
        <form
          className="panel form-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const response = await fetch("/api/estimate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...Object.fromEntries(form),
                  key: key.current,
                  preferences: [
                    form.get("window1"),
                    form.get("window2"),
                    form.get("window3"),
                  ].filter(Boolean),
                }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              setReceipt(data.id);
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Unable to send. Your details are preserved; please retry.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Project details</h2>
          <div className="form-grid">
            <label>
              Your name
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Organization
              <input name="organization" required maxLength={160} />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Phone (optional)
              <input name="phone" type="tel" maxLength={40} />
            </label>
            <label className="wide">
              Project location
              <input name="address" required maxLength={500} />
            </label>
            <label className="wide">
              What are you planning?
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={10000}
                rows={5}
                placeholder="New equipment, installation, upgrades, or something else?"
              />
            </label>
            {[1, 2, 3].map((n) => (
              <label className="wide" key={n}>
                Preferred date / time window {n} (optional)
                <input name={`window${n}`} maxLength={120} />
              </label>
            ))}
            <label className="sr-only" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div className="info-box">
            Preferred windows are not reserved. Net-Tech will confirm scheduling
            with you. A visit does not create a quote or authorize paid work.
          </div>
          {enabled && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <>
              <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                strategy="afterInteractive"
              />
              <div
                className="cf-turnstile"
                data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              />
            </>
          )}
          {error && <Alert>{error}</Alert>}
          <div className="form-footer">
            <span>
              Already a client?{" "}
              <Link className="text-link" href="/sign-in">
                Sign in for support
              </Link>
            </span>
            <button className="button" disabled={busy || !enabled}>
              {busy ? "Sending…" : "Request a visit"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
