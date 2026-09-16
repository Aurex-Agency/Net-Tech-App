"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  MapPin,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  TriangleAlert,
} from "lucide-react";
import { useData } from "./provider";
import { PageHeading, SectionHead, Empty, Alert, Modal } from "./ui";
import { dateLabel, initials } from "@/lib/format";
import { isDispatch, isStaff, roleLabel, type Action } from "@/lib/types";
import { Reports } from "./reports";
import {
  OrganizationControls,
  LocationControls,
  EmployeeRole,
} from "./record-controls";
import { SignOut } from "./shell";
export function Operations({ screen, base }: { screen: string; base: string }) {
  const { store, user, run, demo, reset } = useData(),
    params = useSearchParams();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(""),
    [modal, setModal] = useState<string | null>(null),
    [query, setQuery] = useState("");
  if (!store || !user) return null;
  const editedEntry = store.work_entries.find(
    (e) => e.id === modal?.replace("time:", ""),
  );
  const hoursEmployee = store.profiles.find(
    (p) => p.id === modal?.replace("hours:", ""),
  );
  const dispatch = isDispatch(user.role),
    staff = isStaff(user.role);
  async function act(a: Action) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await run(a);
      setModal(null);
      setSuccess("Changes saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  const submit =
    (type: string, id?: string) => (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void act({
        type,
        id,
        key: crypto.randomUUID(),
        payload: Object.fromEntries(new FormData(e.currentTarget)),
      });
    };
  const denied = (
    <Empty title="This area isn’t available to your role">
      Your account can access only the work and settings shared with you.
    </Empty>
  );
  const feedback = (
    <>
      {error && <Alert>{error}</Alert>}
      {success && (
        <div className="success-message" role="status">
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}
    </>
  );
  if (screen === "clients" || screen === "organization")
    return (
      <>
        <PageHeading
          eyebrow="PEOPLE & PLACES"
          title={dispatch ? "Your clients" : "Your organization"}
          description="The locations, people, and service history behind every request."
          actions={
            dispatch ? (
              <button
                className="button"
                onClick={() => setModal("organization")}
              >
                <Plus size={16} />
                Add client
              </button>
            ) : (
              <Link
                href={`${base}/requests/new?kind=general`}
                className="button secondary"
              >
                Request a correction
              </Link>
            )
          }
        />
        {feedback}
        <div className="search-field client-search">
          <Building2 size={17} />
          <input
            aria-label="Search clients"
            placeholder="Search organizations or locations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="organization-grid">
          {store.organizations
            .filter((o) =>
              (
                o.name +
                " " +
                store.locations
                  .filter((l) => l.organization_id === o.id)
                  .map((l) => l.name)
                  .join(" ")
              )
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((o) => (
              <section className="panel organization-card" key={o.id}>
                <div className="org-heading">
                  <span className="organization-icon">
                    <Building2 size={25} />
                  </span>
                  <div>
                    <h2>{o.name}</h2>
                    <p>
                      {
                        store.locations.filter(
                          (l) => l.organization_id === o.id,
                        ).length
                      }{" "}
                      locations ·{" "}
                      {
                        store.requests.filter((r) => r.organization_id === o.id)
                          .length
                      }{" "}
                      requests
                    </p>
                  </div>
                </div>
                <div className="detail-tags">
                  {o.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                {store.locations
                  .filter((l) => l.organization_id === o.id)
                  .map((l) => (
                    <div className="location-record" key={l.id}>
                      <h3>
                        <MapPin size={16} />
                        {l.name}
                      </h3>
                      <p>{l.address}</p>
                      <small>Site contact · {l.contact_name}</small>
                      {l.contact_phone && (
                        <a href={`tel:${l.contact_phone}`}>{l.contact_phone}</a>
                      )}
                      <div className="detail-tags">
                        {l.services.map((s) => (
                          <span key={s}>{s}</span>
                        ))}
                      </div>
                      <LocationControls location={l} />
                    </div>
                  ))}
                <Link
                  className="text-link"
                  href={`${base}/requests?q=${encodeURIComponent(o.name)}`}
                >
                  View service history
                  <ArrowRight size={15} />
                </Link>
                <OrganizationControls organization={o} />
                {dispatch && (
                  <button
                    className="text-link"
                    style={{ margin: "0 24px 22px" }}
                    onClick={() => setModal("location:" + o.id)}
                  >
                    <Plus size={15} />
                    Add location
                  </button>
                )}
              </section>
            ))}
        </div>
        {modal?.startsWith("location:") && (
          <Modal title="Add a client location" onClose={() => setModal(null)}>
            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                const p = Object.fromEntries(new FormData(e.currentTarget));
                void act({
                  type: "location",
                  key: crypto.randomUUID(),
                  payload: {
                    ...p,
                    organization_id: modal.slice(9),
                    services: String(p.services)
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  },
                });
              }}
            >
              <label>
                Location name
                <input name="name" required maxLength={160} />
              </label>
              <label>
                Address
                <input name="address" required maxLength={500} />
              </label>
              <label>
                Site contact
                <input name="contact_name" maxLength={120} />
              </label>
              <label>
                Contact phone
                <input name="contact_phone" type="tel" maxLength={40} />
              </label>
              <label>
                Installed services (comma separated)
                <input name="services" maxLength={500} />
              </label>
              {error && <Alert>{error}</Alert>}
              <button className="button" disabled={busy}>
                Add location
              </button>
            </form>
          </Modal>
        )}
        {modal === "organization" && (
          <Modal
            title="Add client and first location"
            onClose={() => setModal(null)}
          >
            <form className="modal-body" onSubmit={submit("organization")}>
              <label>
                Organization name
                <input name="name" required maxLength={160} />
              </label>
              <label>
                Location name
                <input
                  name="location_name"
                  required
                  maxLength={160}
                  defaultValue="Main office"
                />
              </label>
              <label>
                Street address
                <input name="address" required maxLength={500} />
              </label>
              <label>
                Site contact
                <input name="contact_name" maxLength={120} />
              </label>
              <label>
                Contact phone
                <input name="contact_phone" type="tel" maxLength={40} />
              </label>
              {demo && (
                <p className="caption">
                  This creates a fictional record in your browser’s demo
                  workspace.
                </p>
              )}
              {error && <Alert>{error}</Alert>}
              <button className="button" disabled={busy}>
                Create client
              </button>
            </form>
          </Modal>
        )}
      </>
    );
  if (screen === "team")
    return !dispatch ? (
      denied
    ) : (
      <>
        <PageHeading
          eyebrow="YOUR PEOPLE, CONNECTED"
          title="The Net-Tech team"
          description="Keep assignments visible, workloads balanced, and access intentional."
          actions={
            user.role === "owner" ? (
              <button className="button" onClick={() => setModal("invite")}>
                <Plus size={16} />
                Prepare invitation
              </button>
            ) : undefined
          }
        />
        {feedback}
        <div className="team-grid">
          {store.profiles
            .filter((p) => isStaff(p.role))
            .map((p) => {
              const requests = store.requests.filter(
                (r) =>
                  r.assignee_id === p.id &&
                  !["closed", "resolved", "canceled"].includes(r.status),
              );
              return (
                <section
                  className={`panel team-card ${!p.active ? "inactive" : ""}`}
                  key={p.id}
                >
                  <div className="team-card-top">
                    <span className="avatar avatar-large avatar-blue">
                      {initials(p.name)}
                    </span>
                    <span
                      className={`badge ${p.active ? "status-resolved" : ""}`}
                    >
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <h2>{p.name}</h2>
                  <p>{roleLabel[p.role]}</p>
                  <small>{p.email}</small>
                  <div className="team-stats">
                    <span>
                      <strong>{requests.length}</strong>Open assignments
                    </span>
                    <span>
                      <strong>
                        {
                          store.appointments.filter(
                            (a) =>
                              a.technician_id === p.id &&
                              !["completed", "canceled"].includes(a.status),
                          ).length
                        }
                      </strong>
                      Upcoming visits
                    </span>
                  </div>
                  {!p.active && requests.length > 0 && (
                    <div className="info-box">
                      <TriangleAlert size={17} />
                      {requests.length} requests need reassignment.
                    </div>
                  )}
                  <Link
                    className="text-link"
                    href={`${base}/requests?filter=unassigned`}
                  >
                    {!p.active
                      ? "Review reassignment queue"
                      : "Review open work"}
                    <ArrowRight size={14} />
                  </Link>
                  <button
                    className="text-link"
                    style={{ display: "flex", marginTop: 16 }}
                    onClick={() => setModal("hours:" + p.id)}
                  >
                    Working hours ·{" "}
                    {p.working_start?.slice(0, 5) ??
                      store.settings.working_start}
                    –{p.working_end?.slice(0, 5) ?? store.settings.working_end}
                  </button>
                  <EmployeeRole employee={p} />
                  {user.role === "owner" && p.role !== "owner" && (
                    <button
                      className={`button secondary small ${p.active ? "danger-text" : ""}`}
                      onClick={() => setModal(p.id)}
                    >
                      {p.active ? "Deactivate access" : "Reactivate access"}
                    </button>
                  )}
                </section>
              );
            })}
        </div>
        {modal && modal !== "invite" && !modal.startsWith("hours:") && (
          <Modal
            title={
              store.profiles.find((p) => p.id === modal)?.active
                ? "Deactivate employee access?"
                : "Reactivate employee access?"
            }
            onClose={() => setModal(null)}
          >
            <div className="modal-body">
              <p>
                Existing sessions lose protected access immediately after
                deactivation. Their history stays intact. Open requests and
                upcoming visits remain visible for reassignment.
              </p>
              {error && <Alert>{error}</Alert>}
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void act({
                    type: "employee",
                    id: modal,
                    key: crypto.randomUUID(),
                    payload: {
                      active: !store.profiles.find((p) => p.id === modal)
                        ?.active,
                    },
                  })
                }
              >
                Confirm access change
              </button>
            </div>
          </Modal>
        )}
        {modal?.startsWith("hours:") && hoursEmployee && (
          <Modal
            title={"Working hours · " + hoursEmployee.name}
            onClose={() => setModal(null)}
          >
            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void act({
                  type: "staff_hours",
                  id: hoursEmployee.id,
                  key: crypto.randomUUID(),
                  payload: {
                    working_start: form.get("working_start"),
                    working_end: form.get("working_end"),
                    working_days: form.getAll("working_days").map(Number),
                  },
                });
              }}
            >
              <p>
                Central time. Confirmed visits outside these hours require a
                dispatcher override with a recorded reason.
              </p>
              <label>
                Start
                <input
                  type="time"
                  name="working_start"
                  defaultValue={
                    hoursEmployee.working_start ?? store.settings.working_start
                  }
                  required
                />
              </label>
              <label>
                End
                <input
                  type="time"
                  name="working_end"
                  defaultValue={
                    hoursEmployee.working_end ?? store.settings.working_end
                  }
                  required
                />
              </label>
              <div className="form-grid">
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day, i) => (
                  <label className="checkbox-label" key={day}>
                    <input
                      type="checkbox"
                      name="working_days"
                      value={i + 1}
                      defaultChecked={(
                        hoursEmployee.working_days ?? [1, 2, 3, 4, 5]
                      ).includes(i + 1)}
                    />
                    {day}
                  </label>
                ))}
              </div>
              {error && <Alert>{error}</Alert>}
              <button className="button" disabled={busy}>
                Save working hours
              </button>
            </form>
          </Modal>
        )}
        {modal === "invite" && (
          <Modal title="Prepare an invitation" onClose={() => setModal(null)}>
            <form
              className="modal-body"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const res = await fetch("/api/invitations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                      Object.fromEntries(new FormData(e.currentTarget)),
                    ),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error);
                  setSuccess(
                    `Invitation prepared; no email was sent. Share only after pilot approval: ${json.url}`,
                  );
                  setModal(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not prepare invitation",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Creates a single-use, 7-day acceptance link. No invitation email
                is sent. Real-user invitations remain pending review.
              </p>
              <label>
                Email
                <input type="email" name="email" required />
              </label>
              <label>
                Role
                <select name="role">
                  <option value="technician">Technician</option>
                  <option value="dispatcher">Dispatcher</option>
                  <option value="client">Client contact</option>
                  <option value="client_admin">Client administrator</option>
                </select>
              </label>
              <label>
                Organization (client roles only)
                <select name="organization_id">
                  <option value="">No organization (staff)</option>
                  {store.organizations.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              {error && <Alert>{error}</Alert>}
              <button className="button" disabled={busy || demo}>
                {demo ? "Unavailable in demo" : "Prepare link"}
              </button>
            </form>
          </Modal>
        )}
      </>
    );
  if (screen === "time")
    return !staff ? (
      denied
    ) : (
      <>
        <PageHeading
          eyebrow="FIELD NOTES"
          title="Time & work entries"
          description="Record time and materials against the work. These are service records, not payroll."
          actions={
            <button className="button" onClick={() => setModal("time")}>
              <Plus size={16} />
              Log time
            </button>
          }
        />
        {feedback}
        <section className="panel">
          <SectionHead
            title="Service time"
            subtitle={`${store.work_entries.reduce((s, e) => s + e.minutes, 0)} minutes logged`}
          />
          {store.work_entries.length ? (
            <div className="table-scroll">
              <table className="request-table">
                <thead>
                  <tr>
                    <th>Date / request</th>
                    <th>Technician</th>
                    <th>Work performed</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {store.work_entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {e.date}
                        <small className="block">
                          <Link href={`${base}/requests/${e.request_id}`}>
                            {
                              store.requests.find((r) => r.id === e.request_id)
                                ?.reference
                            }
                          </Link>
                        </small>
                      </td>
                      <td>
                        {store.profiles.find((p) => p.id === e.author_id)?.name}
                      </td>
                      <td>
                        {e.description}
                        <small className="block">{e.materials}</small>
                      </td>
                      <td>
                        {e.minutes} min
                        {(e.author_id === user.id || user.role === "owner") && (
                          <button
                            className="text-link"
                            style={{ display: "block", marginTop: 8 }}
                            onClick={() => setModal("time:" + e.id)}
                          >
                            Edit entry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Your work deserves a record">
              Add your first time entry after working a request.
            </Empty>
          )}
        </section>
        {(modal === "time" || modal?.startsWith("time:")) && (
          <Modal title="Log service time" onClose={() => setModal(null)}>
            <form
              className="modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                const p = Object.fromEntries(new FormData(e.currentTarget));
                void act({
                  type: "work_entry",
                  id: String(p.request_id),
                  key: crypto.randomUUID(),
                  payload: {
                    ...p,
                    minutes: Number(p.minutes),
                    entry_id: editedEntry?.id,
                  },
                });
              }}
            >
              <label>
                Request
                <select
                  name="request_id"
                  defaultValue={
                    editedEntry?.request_id ?? params.get("request") ?? ""
                  }
                  required
                >
                  <option value="" disabled>
                    Choose request
                  </option>
                  {store.requests.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.reference} · {r.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Work date
                  <input
                    name="date"
                    type="date"
                    defaultValue={
                      editedEntry?.date ??
                      dateLabel(new Date().toISOString(), "yyyy-MM-dd")
                    }
                    required
                  />
                </label>
                <label>
                  Duration (minutes)
                  <input
                    name="minutes"
                    defaultValue={editedEntry?.minutes}
                    type="number"
                    min={1}
                    max={1440}
                    required
                  />
                </label>
              </div>
              <label>
                Work performed
                <textarea
                  name="description"
                  defaultValue={editedEntry?.description}
                  maxLength={2000}
                  required
                />
              </label>
              <label>
                Materials / follow-up (optional)
                <textarea
                  name="materials"
                  defaultValue={editedEntry?.materials}
                  maxLength={2000}
                />
              </label>
              <div className="info-box">
                Time entries and materials are visible to staff only.
              </div>
              {error && <Alert>{error}</Alert>}
              <button className="button" disabled={busy}>
                Save time entry
              </button>
            </form>
          </Modal>
        )}
      </>
    );
  if (screen === "reports") return dispatch ? <Reports /> : denied;
  if (screen === "settings")
    return user.role !== "owner" ? (
      denied
    ) : (
      <>
        <PageHeading
          eyebrow="MAKE IT YOURS"
          title="Workspace settings"
          description="Set clear expectations for clients and a dependable rhythm for your team."
        />
        {feedback}
        <form
          className="panel form-panel settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const p = Object.fromEntries(form);
            void act({
              type: "settings",
              key: crypto.randomUUID(),
              payload: {
                ...p,
                categories: String(p.categories)
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
                buffer_minutes: Number(p.buffer_minutes),
                duration_minutes: Number(p.duration_minutes),
                closure_days: Number(p.closure_days),
                auto_close: form.has("auto_close"),
              },
            });
          }}
        >
          <h2>Company & support</h2>
          <div className="form-grid">
            <label>
              Product name
              <input
                name="company_name"
                defaultValue={store.settings.company_name}
                required
                maxLength={100}
              />
            </label>
            <label>
              Service area
              <input
                name="service_area"
                defaultValue={store.settings.service_area}
                maxLength={200}
              />
            </label>
            <label>
              Support phone
              <input
                name="support_phone"
                defaultValue={store.settings.support_phone}
                maxLength={40}
              />
            </label>
            <label>
              Support email
              <input
                name="support_email"
                type="email"
                defaultValue={store.settings.support_email}
              />
            </label>
            <label className="wide">
              Request categories (one per line)
              <textarea
                name="categories"
                defaultValue={store.settings.categories.join("\n")}
                rows={6}
                required
              />
            </label>
          </div>
          <h2>Scheduling & resolution</h2>
          <div className="form-grid">
            <label>
              Working day starts (Central)
              <input
                type="time"
                name="working_start"
                defaultValue={store.settings.working_start}
                required
              />
            </label>
            <label>
              Working day ends (Central)
              <input
                type="time"
                name="working_end"
                defaultValue={store.settings.working_end}
                required
              />
            </label>
            <label>
              Default visit (minutes)
              <input
                name="duration_minutes"
                type="number"
                min={15}
                max={480}
                defaultValue={store.settings.duration_minutes}
              />
            </label>
            <label>
              Travel buffer (minutes)
              <input
                name="buffer_minutes"
                type="number"
                min={0}
                max={120}
                defaultValue={store.settings.buffer_minutes}
              />
            </label>
            <label>
              Resolution reply window (days)
              <input
                name="closure_days"
                type="number"
                min={1}
                max={90}
                defaultValue={store.settings.closure_days}
              />
            </label>
            <label className="checkbox-label">
              <input
                name="auto_close"
                type="checkbox"
                defaultChecked={store.settings.auto_close}
              />
              Automatically close after the reply window
            </label>
          </div>
          <p className="caption">
            Automatic closure and reminders require the authenticated jobs
            worker. Keep automatic closure off until the scheduler is verified.
          </p>
          <div className="form-footer">
            <span>No response-time guarantee is configured.</span>
            <button className="button" disabled={busy}>
              Save settings
            </button>
          </div>
        </form>
      </>
    );
  if (screen === "account")
    return (
      <>
        <PageHeading
          eyebrow="YOUR WORKSPACE"
          title="Account & preferences"
          description="Keep your contact details current and choose how you hear from us."
        />
        {feedback}
        <div className="two-column">
          <form
            className="panel form-panel"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void act({
                type: "profile",
                key: crypto.randomUUID(),
                payload: {
                  ...Object.fromEntries(form),
                  email_notifications: form.has("email_notifications"),
                },
              });
            }}
          >
            <div className="account-heading">
              <span className="avatar avatar-large avatar-blue">
                {initials(user.name)}
              </span>
              <span>
                <h2>{user.name}</h2>
                <p>{roleLabel[user.role]}</p>
              </span>
            </div>
            <label>
              Full name
              <input
                name="name"
                defaultValue={user.name}
                maxLength={120}
                required
              />
            </label>
            <label>
              Email
              <input value={user.email} readOnly />
              <small>Contact Net-Tech to change your sign-in address.</small>
            </label>
            <label>
              Phone
              <input
                type="tel"
                name="phone"
                defaultValue={user.phone}
                maxLength={40}
              />
            </label>
            <label className="checkbox-label">
              <input
                name="email_notifications"
                type="checkbox"
                defaultChecked={user.email_notifications}
              />
              Email me about service updates
            </label>
            <button className="button" disabled={busy}>
              Save preferences
            </button>
          </form>
          <section className="panel form-panel">
            <ShieldCheck size={28} className="blue" />
            <h2>Your access is intentional.</h2>
            <p>
              Net-Tech manages organization membership and team roles. You can
              only see the service work shared with you.
            </p>
            {staff && !demo && (
              <Link href="/auth/mfa" className="button secondary">
                Set up / verify two-step authentication
              </Link>
            )}
            <SignOut />
            {demo && (
              <>
                <hr />
                <h3>Demo controls</h3>
                <p>
                  This workspace contains fictional people, organizations, and
                  requests. Changes are saved only in this browser.
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    reset();
                    setSuccess("Synthetic demo data reset.");
                  }}
                >
                  Reset demo data
                </button>
              </>
            )}
          </section>
        </div>
      </>
    );
  return denied;
}
