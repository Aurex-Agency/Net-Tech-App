"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "./provider";
import { SectionHead, Alert, Modal } from "./ui";
import { dateLabel } from "@/lib/format";
type Inquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  address: string;
  description: string;
  preferences: string[];
  created_at: string;
};
export function InquiryQueue({ base }: { base: string }) {
  const { demo, store } = useData();
  const router = useRouter();
  const [items, setItems] = useState<Inquiry[]>([]),
    [selected, setSelected] = useState<Inquiry | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (demo) return;
    try {
      const r = await fetch("/api/inquiries");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setItems(data);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load estimate inquiries",
      );
    }
  }, [demo]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  if (demo || (!items.length && !error)) return null;
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <SectionHead
        title="New estimate inquiries"
        subtitle="Public inquiries need a client/location record before scheduling."
      />
      {error && (
        <Alert>
          {error}
          <button onClick={() => void load()}>Retry</button>
        </Alert>
      )}
      {items.map((i) => (
        <div className="availability-row" key={i.id}>
          <span>
            <strong>{i.organization}</strong>
            <small>
              {i.name} · {dateLabel(i.created_at)}
            </small>
          </span>
          <button
            className="button secondary small"
            onClick={() => setSelected(i)}
          >
            Review inquiry
          </button>
        </div>
      ))}
      {selected && (
        <Modal
          title="Review estimate inquiry"
          onClose={() => setSelected(null)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await fetch("/api/inquiries", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    inquiry_id: selected.id,
                    location_id: new FormData(e.currentTarget).get(
                      "location_id",
                    ),
                  }),
                });
                const result = await r.json();
                if (!r.ok) throw new Error(result.error);
                router.push(`${base}/requests/${result.id}`);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to accept inquiry",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>{selected.organization}</h3>
            <p>
              {selected.name} · {selected.email} · {selected.phone}
            </p>
            <p>{selected.address}</p>
            <p>{selected.description}</p>
            <div className="info-box">
              Preferred windows:{" "}
              {selected.preferences.join(" · ") || "Not specified"}. No
              reservation exists.
            </div>
            <label>
              Match to an existing location
              <select name="location_id" required defaultValue="">
                <option value="" disabled>
                  Choose a location
                </option>
                {store?.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {
                      store.organizations.find(
                        (o) => o.id === l.organization_id,
                      )?.name
                    }{" "}
                    · {l.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="caption">
              If this is a new client, add their organization and location on
              the Clients page first. Membership is never inferred from email
              domains.
            </p>
            {error && <Alert>{error}</Alert>}
            <button className="button" disabled={busy}>
              Accept inquiry for scheduling
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
