import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>This page is out of reach.</h1>
      <p>
        The link may have changed, or the page isn’t available to your account.
      </p>
      <Link className="button" href="/">
        Back to your workspace
      </Link>
    </main>
  );
}
