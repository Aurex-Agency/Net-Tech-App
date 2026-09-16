"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  Building2,
  Check,
  Copy,
  Plus,
  Search,
  UserRoundPlus,
} from "lucide-react";
import { useData } from "./provider";
import { Alert, Modal } from "./ui";
import {
  isDispatch,
  type Organization,
  type PendingTechnician,
  type Profile,
} from "@/lib/types";
import { dateLabel } from "@/lib/format";

function BusinessPicker({
  selected,
  onChange,
  technicianId,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  technicianId?: string;
}) {
  const { store } = useData();
  const [search, setSearch] = useState("");
  if (!store) return null;
  const businesses = store.organizations.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <fieldset className="business-picker">
      <legend>
        Connect businesses <span className="muted">· optional</span>
      </legend>
      <p>
        New requests from selected businesses will go to this technician.
        Existing work stays with its current assignee.
      </p>
      <div className="search-field">
        <Search size={16} />
        <input
          aria-label="Find a business"
          placeholder="Find a business…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="business-options">
        {businesses.map((b) => {
          const current = store.profiles.find(
            (p) =>
              p.id ===
              store.business_technicians?.find(
                (c) => c.organization_id === b.id,
              )?.technician_id,
          );
          return (
            <label
              className={`business-option ${selected.includes(b.id) ? "selected" : ""}`}
              key={b.id}
            >
              <input
                type="checkbox"
                aria-label={b.name}
                checked={selected.includes(b.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, b.id]
                      : selected.filter((id) => id !== b.id),
                  )
                }
              />
              <span>
                <strong>{b.name}</strong>
                <small>
                  {current
                    ? current.id === technicianId
                      ? "Connected to this technician"
                      : `Currently ${current.name}${selected.includes(b.id) ? " · will be replaced for new requests" : ""}`
                    : "No default technician"}
                </small>
              </span>
              <Building2 size={17} />
            </label>
          );
        })}
        {!businesses.length && (
          <p className="padded muted">
            {store.organizations.length
              ? "No businesses match your search."
              : "Add a business from Clients first, or connect it later."}
          </p>
        )}
      </div>
      <small>
        {selected.length} {selected.length === 1 ? "business" : "businesses"}{" "}
        selected
      </small>
    </fieldset>
  );
}

export function AddTechnician({ pending }: { pending?: PendingTechnician }) {
  const { user, store, demo, run, refresh } = useData();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [url, setUrl] = useState(""),
    [copied, setCopied] = useState(false),
    [created, setCreated] = useState("");
  const key = useRef(crypto.randomUUID());
  if (!store || user?.role !== "owner") return null;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (demo) {
        await run({
          type: "add_technician",
          key: key.current,
          payload: { ...fields, business_ids: selected },
        });
        setCreated(String(fields.name));
      } else {
        const response = await fetch("/api/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...fields,
            role: "technician",
            business_ids: selected,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setUrl(result.url);
        await refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not add the technician. Your details are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={pending ? "button secondary small" : "button"}
        onClick={() => {
          setSelected(pending?.business_ids ?? []);
          setError("");
          setUrl("");
          setCreated("");
          setCopied(false);
          key.current = crypto.randomUUID();
          setOpen(true);
        }}
      >
        {pending ? <Copy size={15} /> : <UserRoundPlus size={17} />}
        {pending ? "Prepare new link" : "Add technician"}
      </button>
      {open && (
        <Modal
          title={
            created
              ? "Technician added"
              : url
                ? "Technician invitation ready"
                : "Add technician"
          }
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          {created ? (
            <div className="modal-body">
              <div className="success-message">
                <Check size={20} />
                {created} is on your demo team.
              </div>
              <p>
                {selected.length
                  ? `Connected to ${selected.length} ${selected.length === 1 ? "business" : "businesses"}. New demo requests route automatically.`
                  : "You can connect businesses from their team card whenever you’re ready."}
              </p>
              <p className="demo-hint">
                Synthetic demo only. No account or invitation email was created.
              </p>
              <button className="button" onClick={() => setOpen(false)}>
                Back to team
              </button>
            </div>
          ) : url ? (
            <div className="modal-body">
              <p>
                The technician will appear as active after accepting the
                invitation. Their business connections start then; newer
                assignments are kept.
              </p>
              <label>
                Acceptance link
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                  } catch {
                    setError("Select the link above and copy it manually.");
                  }
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <p className="demo-hint">
                No email was sent. Share this single-use, 7-day link only after
                pilot approval.
              </p>
              {error && <Alert>{error}</Alert>}
            </div>
          ) : (
            <form className="modal-body" onSubmit={save}>
              <p className="muted">
                Add their details and choose the businesses they’ll look after.
              </p>
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    name="name"
                    required
                    maxLength={120}
                    autoComplete="off"
                    defaultValue={pending?.name ?? ""}
                    placeholder="e.g. Morgan Davis"
                  />
                </label>
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="off"
                    defaultValue={pending?.email ?? ""}
                    placeholder="technician@example.com"
                  />
                </label>
                <label className="wide">
                  Phone (optional)
                  <input
                    name="phone"
                    type="tel"
                    maxLength={40}
                    defaultValue={pending?.phone ?? ""}
                  />
                </label>
              </div>
              <BusinessPicker selected={selected} onChange={setSelected} />
              <div className="info-box">
                <Building2 size={18} />
                <span>
                  {demo
                    ? "Demo technician becomes available immediately. No real account or email is created."
                    : "We’ll prepare an acceptance link. No email is sent, and access starts only after the technician accepts."}
                </span>
              </div>
              {error && <Alert>{error}</Alert>}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button className="button" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : demo
                      ? "Add technician"
                      : "Prepare technician invitation"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

export function TechnicianBusinesses({ employee }: { employee: Profile }) {
  const { store, user, run } = useData();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!store || !user || !isDispatch(user.role)) return null;
  const connections = (store.business_technicians ?? []).filter(
    (b) => b.technician_id === employee.id,
  );
  if (employee.role !== "technician" && !connections.length) return null;
  return (
    <div className="technician-businesses">
      <div className="connection-heading">
        <strong>
          <Building2 size={15} />
          Businesses
        </strong>
        <span>{connections.length}</span>
      </div>
      {connections.length ? (
        <ul>
          {connections.map((b) => (
            <li key={b.organization_id}>
              {store.organizations.find((o) => o.id === b.organization_id)
                ?.name ?? "Business"}
            </li>
          ))}
        </ul>
      ) : (
        <p>No businesses connected yet.</p>
      )}
      {connections.length > 0 &&
        (!employee.active || employee.role !== "technician") && (
          <p className="danger-text">
            Routing paused. New requests go to the unassigned queue.
          </p>
        )}
      {((employee.active && employee.role === "technician") ||
        connections.length > 0) && (
        <button
          className="button secondary small full"
          onClick={() => {
            setSelected(connections.map((b) => b.organization_id));
            setError("");
            setOpen(true);
          }}
        >
          <Plus size={15} />
          {connections.length ? "Manage businesses" : "Connect businesses"}
        </button>
      )}
      {open && (
        <Modal
          title={`Businesses · ${employee.name}`}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await run({
                  type: "connect_businesses",
                  id: employee.id,
                  key: crypto.randomUUID(),
                  payload: { business_ids: selected },
                });
                setOpen(false);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not save connections.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <BusinessPicker
              selected={selected}
              onChange={setSelected}
              technicianId={employee.id}
            />
            {(!employee.active || employee.role !== "technician") && (
              <p className="danger-text">
                Remove connections here, or assign another active technician
                from Clients.
              </p>
            )}
            {error && <Alert>{error}</Alert>}
            <div className="dialog-actions">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Save connections"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function BusinessTechnician({ business }: { business: Organization }) {
  const { store, user, run } = useData();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!store || !user || !isDispatch(user.role)) return null;
  const currentId = store.business_technicians?.find(
    (b) => b.organization_id === business.id,
  )?.technician_id;
  const current = store.profiles.find((p) => p.id === currentId);
  return (
    <div className="business-technician">
      <div>
        <span className="field-label">Default technician</span>
        <strong>{current?.name ?? "Not connected"}</strong>
        <small>
          {current
            ? current.active && current.role === "technician"
              ? "Receives new requests automatically"
              : "Routing paused · choose an active technician"
            : "New requests go to the unassigned queue"}
        </small>
      </div>
      <button
        className="button secondary small"
        onClick={() => {
          setSelected(currentId ?? "");
          setError("");
          setOpen(true);
        }}
      >
        {current ? "Change" : "Connect technician"}
      </button>
      {open && (
        <Modal
          title={`Default technician · ${business.name}`}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const target = selected || currentId;
                if (target)
                  await run({
                    type: "connect_businesses",
                    id: target,
                    key: crypto.randomUUID(),
                    payload: {
                      business_ids: [
                        ...(store.business_technicians ?? [])
                          .filter(
                            (b) =>
                              b.technician_id === target &&
                              b.organization_id !== business.id,
                          )
                          .map((b) => b.organization_id),
                        ...(selected ? [business.id] : []),
                      ],
                    },
                  });
                setOpen(false);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not connect technician.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              New requests from this business go to the selected technician.
              Existing requests and visits keep their current assignments.
            </p>
            <label>
              Technician
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">No default · send to unassigned queue</option>
                {store.profiles
                  .filter(
                    (p) =>
                      (p.role === "technician" && p.active) ||
                      p.id === currentId,
                  )
                  .map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={!p.active || p.role !== "technician"}
                    >
                      {p.name}
                      {!p.active || p.role !== "technician"
                        ? " · unavailable"
                        : ""}
                    </option>
                  ))}
              </select>
            </label>
            {error && <Alert>{error}</Alert>}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Save technician"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function PendingTechnicians() {
  const { store, user } = useData();
  if (user?.role !== "owner" || !store?.pending_technicians?.length)
    return null;
  return (
    <section className="panel pending-team">
      <h2>Waiting to join</h2>
      <p>
        Prepared invitations. Access and business routing start after
        acceptance.
      </p>
      {store.pending_technicians.map((p) => (
        <div className="pending-person" key={p.id}>
          <div>
            <strong>{p.name}</strong>
            <small>
              {p.email} · Link expires {dateLabel(p.expires_at, "MMM d")}
            </small>
            <small>
              {p.business_ids
                .map((id) => store.organizations.find((o) => o.id === id)?.name)
                .filter(Boolean)
                .join(" · ") || "No businesses selected"}
            </small>
          </div>
          <AddTechnician pending={p} />
        </div>
      ))}
    </section>
  );
}
