"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  CalendarDays,
  MapPin,
  ArrowUpRight,
  Download,
  ChevronLeft,
  ChevronRight,
  Phone,
} from "lucide-react";
import { useData } from "./provider";
import { PageHeading, SectionHead, Badge, Empty, Alert, Modal } from "./ui";
import {
  dateLabel,
  timeLabel,
  localToUtc,
  calendarFile,
  download,
  initials,
} from "@/lib/format";
import {
  isDispatch,
  isStaff,
  type Appointment,
  type ServiceRequest,
} from "@/lib/types";
export function Calendar({ base }: { base: string }) {
  const { store: snapshot, user, run, demo } = useData(),
    params = useSearchParams();
  const [modal, setModal] = useState<"schedule" | "availability" | null>(
      params.get("request") ? "schedule" : null,
    ),
    [selected, setSelected] = useState<Appointment | null>(null),
    [change, setChange] = useState<Appointment | null>(null),
    [edit, setEdit] = useState<Appointment | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState("agenda"),
    [filter, setFilter] = useState("all"),
    [offset, setOffset] = useState(0),
    [includePast, setIncludePast] = useState(false),
    [page, setPage] = useState(0);
  const [remote, setRemote] = useState<{
    appointments: Appointment[];
    requests: ServiceRequest[];
    total: number;
  } | null>(null);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i + offset * 7);
    return dateLabel(d.toISOString(), "yyyy-MM-dd");
  });
  const from = view === "week" ? days[0] : "";
  const to = view === "week" ? days[6] : "";
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingVisits(true);
      try {
        const query = new URLSearchParams({
          page: String(page),
          history: String(includePast),
          from,
          to,
          technician: filter,
        });
        const response = await fetch("/api/appointments?" + query, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setRemote(data);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load visits.");
      } finally {
        if (!controller.signal.aborted) setLoadingVisits(false);
      }
    }, 50);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [demo, page, includePast, from, to, filter, snapshot?.appointments]);
  const store =
    snapshot && !demo && remote
      ? {
          ...snapshot,
          appointments: remote.appointments,
          requests: [
            ...snapshot.requests,
            ...remote.requests.filter(
              (r) => !snapshot.requests.some((s) => s.id === r.id),
            ),
          ],
        }
      : snapshot;
  if (!store || !user) return null;
  const dispatch = isDispatch(user.role),
    staff = isStaff(user.role);
  const visits = store.appointments
    .filter(
      (a) =>
        (filter === "all" || a.technician_id === filter) &&
        (includePast ||
          !["completed", "canceled", "no_show"].includes(a.status)),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  async function save(
    type: string,
    id: string | undefined,
    payload: Record<string, unknown>,
  ) {
    setBusy(true);
    setError("");
    try {
      await run({ type, id, key: crypto.randomUUID(), payload });
      setModal(null);
      setSelected(null);
      setChange(null);
      setEdit(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  const card = (a: Appointment) => {
    const r = store.requests.find((r) => r.id === a.request_id),
      loc = store.locations.find((l) => l.id === r?.location_id),
      tech = store.profiles.find((p) => p.id === a.technician_id);
    return (
      <article className="visit-card" key={a.id}>
        <div className="visit-card-time">
          <span>{dateLabel(a.starts_at, "MMM d")}</span>
          <strong>{timeLabel(a.starts_at)}</strong>
          <small>to {timeLabel(a.ends_at)} CT</small>
        </div>
        <div className="visit-card-content">
          <div className="visit-card-heading">
            <h3>{a.purpose}</h3>
            <Badge status={a.status} />
          </div>
          <Link href={`${base}/requests/${r?.id}`} className="text-link">
            {r?.reference} ·{" "}
            {store.organizations.find((o) => o.id === r?.organization_id)?.name}
          </Link>
          <p className="icon-text">
            <MapPin size={15} />
            {loc?.name} · {loc?.address}
          </p>
          {a.preparation && (
            <p className="visit-preparation">{a.preparation}</p>
          )}
          <div className="person-inline">
            <span className="avatar avatar-tiny avatar-blue">
              {initials(tech?.name ?? "NT")}
            </span>
            {tech?.name}
            {tech && !tech.active && (
              <span className="danger-text">Needs reassignment</span>
            )}
          </div>
          {a.change_requested && (
            <div className="info-box">
              Change requested: {a.change_requested}. Current booking remains
              active.
            </div>
          )}
        </div>
        <div className="visit-card-actions">
          {(dispatch || a.technician_id === user.id) &&
            staff &&
            !["completed", "canceled", "no_show", "proposed"].includes(
              a.status,
            ) && (
              <button
                className="button small"
                onClick={() => {
                  setError("");
                  setSelected(a);
                }}
              >
                Update visit
              </button>
            )}
          {dispatch && (
            <button
              className="button secondary small"
              onClick={() => {
                setEdit(a);
                setError("");
                setModal("schedule");
              }}
            >
              Edit booking
            </button>
          )}
          {!staff &&
            !["completed", "canceled", "no_show"].includes(a.status) && (
              <button
                className="button secondary small"
                onClick={() => {
                  setChange(a);
                  setError("");
                }}
              >
                Request a change
              </button>
            )}
          {a.status !== "proposed" && a.status !== "canceled" && (
            <button
              className="text-link"
              onClick={() =>
                download(
                  `net-tech-${a.id}.ics`,
                  calendarFile(a, loc?.address ?? ""),
                  "text/calendar",
                )
              }
            >
              <Download size={14} />
              Add to calendar
            </button>
          )}
          {staff && loc && (
            <a
              className="text-link"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`}
              target="_blank"
              rel="noreferrer"
            >
              Directions
              <ArrowUpRight size={14} />
            </a>
          )}
          {staff && loc?.contact_phone && (
            <a className="text-link" href={`tel:${loc.contact_phone}`}>
              <Phone size={14} />
              Call contact
            </a>
          )}
        </div>
      </article>
    );
  };
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE PLANNING. A SMOOTHER DAY."
        title={
          dispatch
            ? "Dispatch calendar"
            : staff
              ? "Your work calendar"
              : "Your appointments"
        }
        description={
          dispatch
            ? "Coordinate bookings, technician availability, and client change requests."
            : staff
              ? "Visits on your assigned and shared work. You can update visits assigned to you."
              : "Every visit has a clear time, a purpose, and a person to help."
        }
        actions={
          <>
            {staff && (
              <button
                className="button secondary"
                onClick={() => {
                  setError("");
                  setModal("availability");
                }}
              >
                Request time away
              </button>
            )}
            {dispatch && (
              <button
                className="button"
                onClick={() => {
                  setEdit(null);
                  setError("");
                  setModal("schedule");
                }}
              >
                <Plus size={16} />
                Schedule a visit
              </button>
            )}
          </>
        }
      />
      <section className="panel">
        <div className="calendar-toolbar">
          <div className="segmented">
            <button
              className={view === "agenda" ? "active" : ""}
              onClick={() => {
                setView("agenda");
                setPage(0);
              }}
            >
              Agenda
            </button>
            <button
              className={view === "week" ? "active" : ""}
              onClick={() => {
                setView("week");
                setPage(0);
              }}
            >
              Week
            </button>
          </div>
          <span className="muted">America/Chicago · Central time</span>
          {staff && (
            <select
              aria-label="Filter technician"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All technicians</option>
              {store.profiles
                .filter((p) => isStaff(p.role))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => {
                setIncludePast(e.target.checked);
                setPage(0);
              }}
            />
            Include past visits
          </label>
        </div>
        {loadingVisits && (
          <p className="caption" role="status">
            Loading visits…
          </p>
        )}
        {view === "week" ? (
          <>
            <div className="week-controls">
              <button
                className="icon-button"
                aria-label="Previous week"
                onClick={() => {
                  setOffset(offset - 1);
                  setPage(0);
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <strong>
                {dateLabel(localToUtc(days[0] + "T12:00"), "MMM d")} –{" "}
                {dateLabel(localToUtc(days[6] + "T12:00"), "MMM d, yyyy")}
              </strong>
              <button
                className="icon-button"
                aria-label="Next week"
                onClick={() => {
                  setOffset(offset + 1);
                  setPage(0);
                }}
              >
                <ChevronRight size={18} />
              </button>
              <button
                className="text-link"
                onClick={() => {
                  setOffset(0);
                  setPage(0);
                }}
              >
                This week
              </button>
            </div>
            <div className="week-grid">
              {days.map((d) => (
                <div className="week-day" key={d}>
                  <div
                    className={
                      d === dateLabel(new Date().toISOString(), "yyyy-MM-dd")
                        ? "today"
                        : ""
                    }
                  >
                    <small>{dateLabel(localToUtc(d + "T12:00"), "EEE")}</small>
                    <strong>{d.slice(-2)}</strong>
                  </div>
                  {visits
                    .filter((a) => dateLabel(a.starts_at, "yyyy-MM-dd") === d)
                    .map((a) => (
                      <button
                        className={`week-event ${a.status === "proposed" ? "tentative" : ""}`}
                        key={a.id}
                        onClick={() => {
                          setView("agenda");
                          setFilter(a.technician_id);
                        }}
                      >
                        <small>{timeLabel(a.starts_at)}</small>
                        <strong>{a.purpose}</strong>
                        <Badge status={a.status} />
                      </button>
                    ))}
                  {store.availability
                    .filter(
                      (a) =>
                        a.status === "approved" &&
                        (filter === "all" || a.user_id === filter) &&
                        a.starts_at < localToUtc(d + "T23:59") &&
                        a.ends_at > localToUtc(d + "T00:00"),
                    )
                    .map((a) => (
                      <div className="unavailable-event" key={a.id}>
                        Unavailable ·{" "}
                        {store.profiles.find((p) => p.id === a.user_id)?.name}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="agenda">
            {visits.length ? (
              visits.map(card)
            ) : (
              <Empty title="A clear calendar">
                Confirmed visits and proposals will appear here.
              </Empty>
            )}
          </div>
        )}
        {!demo && remote && (
          <div className="pagination">
            <span>{remote.total} visits</span>
            <div>
              <button
                className="button secondary small"
                disabled={!page || loadingVisits}
                onClick={() => setPage(page - 1)}
              >
                Previous visits
              </button>
              <button
                className="button secondary small"
                disabled={(page + 1) * 50 >= remote.total || loadingVisits}
                onClick={() => setPage(page + 1)}
              >
                More visits
              </button>
            </div>
          </div>
        )}
      </section>
      {staff && (
        <section className="panel availability-panel">
          <SectionHead
            title="Availability requests"
            subtitle="Approved blocks prevent new conflicting bookings."
          />
          {store.availability.length ? (
            store.availability.map((a) => (
              <div className="availability-row" key={a.id}>
                <span>
                  <strong>
                    {store.profiles.find((p) => p.id === a.user_id)?.name}
                  </strong>
                  <small>
                    {dateLabel(a.starts_at, "MMM d, h:mm a")} –{" "}
                    {dateLabel(a.ends_at, "MMM d, h:mm a")}
                  </small>
                </span>
                <span className="badge">{a.status}</span>
                {dispatch && a.status === "pending" && (
                  <>
                    <button
                      className="button secondary small"
                      onClick={() =>
                        void save("review_availability", a.id, {
                          status: "approved",
                        })
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        void save("review_availability", a.id, {
                          status: "declined",
                        })
                      }
                    >
                      Decline
                    </button>
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="padded muted">No time away requested.</p>
          )}
        </section>
      )}
      {error && !modal && !selected && !change && <Alert>{error}</Alert>}
      {modal === "schedule" && (
        <Modal
          title={edit ? "Edit appointment" : "Schedule a visit"}
          onClose={() => setModal(null)}
        >
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              const p = Object.fromEntries(new FormData(e.currentTarget));
              void save("schedule", String(p.request_id), {
                ...p,
                starts_at: localToUtc(String(p.starts_at)),
                ends_at: localToUtc(String(p.ends_at)),
                appointment_id: edit?.id,
                version: edit?.version,
              });
            }}
          >
            <div className="info-box">
              <CalendarDays size={18} />
              <span>
                Proposed times are unconfirmed. Confirm only after agreeing a
                time with the client.
              </span>
            </div>
            <label>
              Request
              <select
                name="request_id"
                required
                defaultValue={edit?.request_id ?? params.get("request") ?? ""}
              >
                <option value="" disabled>
                  Select a request
                </option>
                {store.requests
                  .filter((r) => !["closed", "canceled"].includes(r.status))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.reference} · {r.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Technician
              <select
                name="technician_id"
                defaultValue={edit?.technician_id ?? ""}
                required
              >
                <option value="" disabled>
                  Select technician
                </option>
                {store.profiles
                  .filter((p) => isStaff(p.role) && p.active)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Purpose
              <input
                name="purpose"
                required
                maxLength={160}
                defaultValue={edit?.purpose}
                placeholder="e.g. Wi-Fi troubleshooting"
              />
            </label>
            <div className="form-grid">
              <label>
                Start (Central time)
                <input
                  name="starts_at"
                  type="datetime-local"
                  required
                  defaultValue={
                    edit
                      ? dateLabel(edit.starts_at, "yyyy-MM-dd'T'HH:mm")
                      : undefined
                  }
                />
              </label>
              <label>
                End (Central time)
                <input
                  name="ends_at"
                  type="datetime-local"
                  required
                  defaultValue={
                    edit
                      ? dateLabel(edit.ends_at, "yyyy-MM-dd'T'HH:mm")
                      : undefined
                  }
                />
              </label>
            </div>
            <label>
              Status
              <select name="status" defaultValue={edit?.status ?? "proposed"}>
                <option value="proposed">Proposed — not confirmed</option>
                <option value="confirmed">Confirmed with client</option>
                {edit && <option value="canceled">Canceled</option>}
              </select>
            </label>
            <label>
              Preparation instructions
              <textarea
                name="preparation"
                maxLength={2000}
                defaultValue={edit?.preparation}
              />
            </label>
            <label>
              Conflict override reason (optional)
              <input
                name="override_reason"
                maxLength={500}
                placeholder="Required to override an overlapping appointment"
              />
            </label>
            <p className="caption">
              Working hours: {store.settings.working_start}–
              {store.settings.working_end} CT, weekdays. Assign the selected
              technician to the request or add them as a collaborator before
              booking. {store.settings.buffer_minutes}-minute travel buffer.
              Out-of-hours booking also requires a reason.
            </p>
            {error && <Alert>{error}</Alert>}
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Save appointment"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "availability" && (
        <Modal title="Request time away" onClose={() => setModal(null)}>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              const p = Object.fromEntries(new FormData(e.currentTarget));
              void save("availability", undefined, {
                ...p,
                starts_at: localToUtc(String(p.starts_at)),
                ends_at: localToUtc(String(p.ends_at)),
              });
            }}
          >
            <p className="muted">
              Dispatch reviews availability before the time is blocked.
            </p>
            <label>
              From (Central time)
              <input type="datetime-local" name="starts_at" required />
            </label>
            <label>
              Until (Central time)
              <input type="datetime-local" name="ends_at" required />
            </label>
            <label>
              Operational note (optional)
              <input name="note" maxLength={300} />
            </label>
            {error && <Alert>{error}</Alert>}
            <button className="button" disabled={busy}>
              Submit for review
            </button>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title="Update visit" onClose={() => setSelected(null)}>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              const p = Object.fromEntries(new FormData(e.currentTarget));
              const tasks = selected.tasks.map((t, i) => ({
                ...t,
                done: p["task" + i] === "on",
              }));
              void save("visit", selected.id, { ...p, tasks });
            }}
          >
            <Badge status={selected.status} />
            <label>
              Next status
              <select name="status">
                {selected.status === "confirmed" && (
                  <option value="en_route">En route</option>
                )}
                {selected.status === "en_route" && (
                  <option value="on_site">On site</option>
                )}
                {selected.status === "on_site" && (
                  <option value="completed">Completed</option>
                )}
                {selected.status === "confirmed" && (
                  <option value="no_show">No show</option>
                )}
                <option value="canceled">Canceled</option>
              </select>
            </label>
            {selected.tasks.map((t, i) => (
              <label className="checkbox-label" key={i}>
                <input
                  type="checkbox"
                  name={"task" + i}
                  defaultChecked={t.done}
                />
                {t.label}
              </label>
            ))}
            <label>
              Public work summary
              <textarea
                name="summary"
                maxLength={10000}
                placeholder="Required when completing. Explain the work performed and any next steps."
              />
            </label>
            <div className="info-box">
              Completing this visit does not resolve the service request. Your
              summary is shared with the client.
            </div>
            {error && <Alert>{error}</Alert>}
            <button className="button" disabled={busy}>
              Save update
            </button>
          </form>
        </Modal>
      )}
      {change && (
        <Modal
          title="Request an appointment change"
          onClose={() => setChange(null)}
        >
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              void save(
                "visit",
                change.id,
                Object.fromEntries(new FormData(e.currentTarget)),
              );
            }}
          >
            <p>
              Your existing booking remains active until Net-Tech confirms a
              change.
            </p>
            <label>
              What would you like to change?
              <textarea
                required
                name="change_requested"
                maxLength={1000}
                placeholder="Tell us if you need to reschedule or cancel, and any preferred times."
              />
            </label>
            {error && <Alert>{error}</Alert>}
            <button className="button" disabled={busy}>
              Send change request
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
