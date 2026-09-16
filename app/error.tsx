"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Let’s try that again.</h1>
      <p>We couldn’t load this page. Your saved requests are safe.</p>
      <button className="button" onClick={reset}>
        Reload page
      </button>
    </main>
  );
}
