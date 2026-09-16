"use client";
import { useState, type FormEvent } from "react";
import { useData } from "./provider";
import { Modal, Alert, SectionHead } from "./ui";
import {
  isDispatch,
  isStaff,
  type Action,
  type Location,
  type Organization,
  type Profile,
  type ServiceRequest,
} from "@/lib/types";
const list = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
function useChange() {
  const { run } = useData();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(action: Omit<Action, "key">, done?: () => void) {
    setBusy(true);
    setError("");
    try {
      await run({ ...action, key: crypto.randomUUID() });
      done?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, save };
}
export function OrganizationControls({
  organization,
}: {
  organization: Organization;
}) {
  const { store, user } = useData();
  const [open, setOpen] = useState(false);
  const { error, busy, save } = useChange();
  if (!store || !user || !isDispatch(user.role)) return null;
  const contacts = store.memberships.filter(
    (m) => m.organization_id === organization.id,
  );
  return (
    <>
      <button
        className="text-link"
        style={{ margin: "0 24px 20px" }}
        onClick={() => setOpen(true)}
      >
        Edit client & contacts
      </button>
      {open && (
        <Modal
          title={"Manage " + organization.name}
          onClose={() => setOpen(false)}
        >
          <div className="modal-body">
            <form
              className="form-stack"
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save(
                  {
                    type: "edit_organization",
                    id: organization.id,
                    payload: { name: f.get("name"), tags: list(f.get("tags")) },
                  },
                  () => setOpen(false),
                );
              }}
            >
              <label>
                Organization name
                <input
                  name="name"
                  defaultValue={organization.name}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Tags (comma separated)
                <input
                  name="tags"
                  defaultValue={organization.tags.join(", ")}
                  maxLength={500}
                />
              </label>
              <button className="button" disabled={busy}>
                Save client
              </button>
            </form>
            <h3>Portal contacts</h3>
            <p className="caption">
              Administrators see all service history for this organization.
              Contacts see their own and explicitly shared requests. Removing
              access preserves their history.
            </p>
            {contacts.length ? (
              contacts.map((m) => {
                const p = store.profiles.find((p) => p.id === m.user_id);
                return (
                  <div key={m.id} className="contact-control">
                    <strong>{p?.name ?? "Contact"}</strong>
                    <small>{p?.email}</small>
                    <label>
                      Organization access
                      <select
                        value={
                          !m.active ? "inactive" : m.admin ? "admin" : "contact"
                        }
                        disabled={busy}
                        onChange={(e) =>
                          void save({
                            type: "membership",
                            id: m.id,
                            payload: {
                              active: e.target.value !== "inactive",
                              admin: e.target.value === "admin",
                            },
                          })
                        }
                      >
                        <option value="contact">
                          Contact — own and shared requests
                        </option>
                        <option value="admin">
                          Administrator — organization history
                        </option>
                        <option value="inactive">Access removed</option>
                      </select>
                    </label>
                  </div>
                );
              })
            ) : (
              <p>
                No portal contacts yet. The owner can prepare invitations in
                Team.
              </p>
            )}
            {error && <Alert>{error}</Alert>}
          </div>
        </Modal>
      )}
    </>
  );
}
export function LocationControls({ location: loc }: { location: Location }) {
  const { store, user } = useData();
  const [open, setOpen] = useState(false);
  const { error, busy, save } = useChange();
  if (!store || !user || !isStaff(user.role)) return null;
  const note = store.site_notes?.find((n) => n.location_id === loc.id);
  return (
    <>
      {note?.summary && (
        <div className="internal-context">
          <strong>Internal site context</strong>
          <p>{note.summary}</p>
          {note.management_url?.startsWith("https://") && (
            <a
              href={note.management_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open management tool ↗
            </a>
          )}
        </div>
      )}
      {isDispatch(user.role) && (
        <button className="text-link" onClick={() => setOpen(true)}>
          Edit location & site context
        </button>
      )}
      {open && (
        <Modal title={"Edit " + loc.name} onClose={() => setOpen(false)}>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save(
                {
                  type: "edit_location",
                  id: loc.id,
                  payload: {
                    ...Object.fromEntries(f),
                    services: list(f.get("services")),
                  },
                },
                () => setOpen(false),
              );
            }}
          >
            <label>
              Location name
              <input
                name="name"
                defaultValue={loc.name}
                required
                maxLength={160}
              />
            </label>
            <label>
              Address
              <input
                name="address"
                defaultValue={loc.address}
                required
                maxLength={500}
              />
            </label>
            <label>
              Site contact
              <input
                name="contact_name"
                defaultValue={loc.contact_name}
                maxLength={120}
              />
            </label>
            <label>
              Contact phone
              <input
                name="contact_phone"
                type="tel"
                defaultValue={loc.contact_phone}
                maxLength={40}
              />
            </label>
            <label>
              Installed services (comma separated)
              <input
                name="services"
                defaultValue={loc.services.join(", ")}
                maxLength={500}
              />
            </label>
            <div className="internal-context">
              <label>
                Internal site summary
                <textarea
                  name="site_summary"
                  defaultValue={note?.summary}
                  maxLength={3000}
                />
              </label>
              <label>
                Management tool link (HTTPS)
                <input
                  name="management_url"
                  type="url"
                  defaultValue={note?.management_url ?? ""}
                  pattern="https://.*"
                  maxLength={1000}
                />
              </label>
              <p className="caption">
                Staff only. Never store passwords, access tokens, or recovery
                codes here.
              </p>
            </div>
            {error && <Alert>{error}</Alert>}
            <button className="button" disabled={busy}>
              Save location
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function EmployeeRole({ employee }: { employee: Profile }) {
  const { user } = useData();
  const { error, busy, save } = useChange();
  const [open, setOpen] = useState(false);
  if (
    user?.role !== "owner" ||
    !["technician", "dispatcher"].includes(employee.role)
  )
    return null;
  return (
    <>
      <button
        className="text-link"
        style={{ display: "block", marginTop: 16 }}
        onClick={() => setOpen(true)}
      >
        Change employee role
      </button>
      {open && (
        <Modal title={"Role · " + employee.name} onClose={() => setOpen(false)}>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save(
                {
                  type: "employee",
                  id: employee.id,
                  payload: { role: f.get("role") },
                },
                () => setOpen(false),
              );
            }}
          >
            <p>
              Technicians see assigned work. Dispatchers can access operational
              records across all clients. Owner access is managed through a
              separate verified process.
            </p>
            <label>
              Employee role
              <select name="role" defaultValue={employee.role}>
                <option value="technician">Technician</option>
                <option value="dispatcher">Dispatcher</option>
              </select>
            </label>
            {error && <Alert>{error}</Alert>}
            <button className="button" disabled={busy}>
              Save role
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function RequestSharing({ request: r }: { request: ServiceRequest }) {
  const { store, user } = useData();
  const [open, setOpen] = useState(false);
  const { error, busy, save } = useChange();
  if (!store || !user || !isDispatch(user.role)) return null;
  const contacts = store.memberships.filter(
    (m) =>
      m.organization_id === r.organization_id &&
      m.active &&
      !m.admin &&
      m.user_id !== r.created_by,
  );
  const technicians = store.profiles.filter(
    (p) => p.role === "technician" && p.active && p.id !== r.assignee_id,
  );
  return (
    <section className="panel">
      <SectionHead title="Request access" />
      <p className="caption">
        Share this conversation with a client contact or add a technician
        collaborator.
      </p>
      <button className="text-link" onClick={() => setOpen(true)}>
        Manage sharing
      </button>
      {open && (
        <Modal
          title="People with request access"
          onClose={() => setOpen(false)}
        >
          <div className="modal-body">
            <p>
              The creator and organization administrators retain access. One
              primary technician remains responsible for the request.
            </p>
            <h3>Client contacts</h3>
            {contacts.length ? (
              contacts.map((m) => {
                const checked = store.participants.some(
                  (p) => p.request_id === r.id && p.user_id === m.user_id,
                );
                return (
                  <label className="checkbox-label" key={m.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() =>
                        void save({
                          type: "share",
                          id: r.id,
                          payload: { user_id: m.user_id, remove: checked },
                        })
                      }
                    />
                    {store.profiles.find((p) => p.id === m.user_id)?.name ??
                      "Contact"}
                  </label>
                );
              })
            ) : (
              <p className="caption">
                No additional client contacts are available.
              </p>
            )}
            <h3>Technician collaborators</h3>
            {technicians.map((p) => {
              const checked = store.collaborators.some(
                (c) => c.request_id === r.id && c.user_id === p.id,
              );
              return (
                <label className="checkbox-label" key={p.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() =>
                      void save({
                        type: "share",
                        id: r.id,
                        payload: {
                          user_id: p.id,
                          audience: "collaborator",
                          remove: checked,
                        },
                      })
                    }
                  />
                  {p.name}
                </label>
              );
            })}
            {error && <Alert>{error}</Alert>}
            <button className="button secondary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
