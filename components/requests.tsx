"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  Send,
  Paperclip,
  LockKeyhole,
  CheckCircle2,
  MapPin,
  UserRound,
  CalendarDays,
  Clock3,
  Download,
  FileText,
  X,
} from "lucide-react";
import { RequestSharing, LocationControls } from "./record-controls";
import { useData } from "./provider";
import { PageHeading, SectionHead, Badge, Empty, Alert, Modal } from "./ui";
import { RequestTable } from "./dashboard";
import { dateLabel, initials, timeLabel } from "@/lib/format";
import {
  isDispatch,
  isStaff,
  statusLabel,
  type Action,
  type ServiceRequest,
  type Message,
} from "@/lib/types";
import { uploadAttachment } from "@/lib/upload-client";
import { InquiryQueue } from "./inquiries";
import { unreadCount } from "@/lib/domain";
export function Requests({ base }: { base: string }) {
  const { store, user, demo } = useData(),
    params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? ""),
    [filter, setFilter] = useState(params.get("filter") ?? "all"),
    [priority, setPriority] = useState(params.get("priority") ?? "all"),
    [client, setClient] = useState("all"),
    [tech, setTech] = useState(params.get("tech") ?? "all"),
    [category, setCategory] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(0),
    [filters, setFilters] = useState(false);
  const [remote, setRemote] = useState<{
    requests: ServiceRequest[];
    total: number;
  }>({ requests: [], total: 0 });
  const [remoteError, setRemoteError] = useState(""),
    [remoteLoading, setRemoteLoading] = useState(false);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRemoteLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          filter,
          priority,
          client,
          tech,
          category,
          from,
          to,
          page: String(page),
        });
        const response = await fetch("/api/requests?" + params, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setRemote(result);
        setRemoteError("");
      } catch (e) {
        if (!controller.signal.aborted)
          setRemoteError(
            e instanceof Error ? e.message : "Unable to load requests",
          );
      } finally {
        if (!controller.signal.aborted) setRemoteLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    demo,
    query,
    filter,
    priority,
    client,
    tech,
    category,
    from,
    to,
    page,
    store?.requests,
  ]);
  if (!store || !user) return null;
  const staff = isStaff(user.role);
  const filtered = store.requests.filter(
    (r) =>
      (!query ||
        `${r.title} ${r.reference} ${store.organizations.find((o) => o.id === r.organization_id)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (filter === "all" ||
        (filter === "unassigned" &&
          (!r.assignee_id ||
            !store.profiles.find((p) => p.id === r.assignee_id)?.active)) ||
        (filter === "mine" && r.assignee_id === user.id) ||
        r.status === filter) &&
      (priority === "all" ||
        (priority === "high" && ["high", "urgent"].includes(r.priority)) ||
        r.priority === priority) &&
      (client === "all" || r.organization_id === client) &&
      (tech === "all" || r.assignee_id === tech) &&
      (category === "all" || r.category === category) &&
      (!from || dateLabel(r.created_at, "yyyy-MM-dd") >= from) &&
      (!to || dateLabel(r.created_at, "yyyy-MM-dd") <= to),
  );
  const total = demo ? filtered.length : remote.total;
  const visible = demo
    ? filtered.slice(page * 10, page * 10 + 10)
    : remote.requests;
  const tabs = staff
    ? [
        [
          "all",
          user.role === "technician" ? "Assigned & shared" : "All requests",
        ],
        ["new", "New"],
        ...(isDispatch(user.role) ? [["unassigned", "Unassigned"]] : []),
        ["mine", "Mine"],
        ["waiting_client", "Waiting on client"],
        ["waiting_vendor", "Parts / vendor"],
        ["resolved", "Resolved"],
      ]
    : [
        ["all", "All requests"],
        ["waiting_client", "Needs your reply"],
        ["in_progress", "In progress"],
        ["resolved", "Resolved"],
      ];
  return (
    <>
      <PageHeading
        eyebrow={staff ? "SERVICE DESK" : "YOUR SERVICE DESK"}
        title={
          user.role === "technician"
            ? "My work"
            : staff
              ? "Requests"
              : "Your requests"
        }
        description="A clear path from the first message to the final fix."
        actions={
          user.role !== "technician" ? (
            <Link className="button" href={`${base}/requests/new`}>
              <Plus size={17} />
              New request
            </Link>
          ) : undefined
        }
      />
      {isDispatch(user.role) && <InquiryQueue base={base} />}
      <section className="panel">
        <div className="tabs" role="tablist" aria-label="Request status">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? "active" : ""}
              onClick={() => {
                setFilter(value);
                setPage(0);
              }}
            >
              {label}
              {value === "all" && <span>{store.requests.length}</span>}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Filter requests"
              placeholder={
                staff
                  ? "Search by request, reference, or client…"
                  : "Search requests or references…"
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <button
            className="button secondary small"
            onClick={() => setFilters(!filters)}
            aria-expanded={filters}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>
        {filters && (
          <div className="filter-row">
            <label>
              Priority
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All priorities</option>
                {["urgent", "high", "normal", "low"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              {staff ? "Client" : "Organization"}
              <select
                value={client}
                onChange={(e) => {
                  setClient(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">
                  {staff ? "All clients" : "All your organizations"}
                </option>
                {store.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All categories</option>
                {store.settings.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Opened from
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Opened through
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            {staff && (
              <label>
                Technician
                <select
                  value={tech}
                  onChange={(e) => {
                    setTech(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">All technicians</option>
                  {store.profiles
                    .filter((p) => isStaff(p.role))
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
        )}
        {remoteError && <Alert>{remoteError}</Alert>}
        {remoteLoading && (
          <p className="padded muted" role="status">
            Loading requests…
          </p>
        )}
        <RequestTable requests={visible} base={base} />
        <div className="pagination">
          <span>
            {total} requests
            {total > 0 &&
              ` · Showing ${page * 10 + 1}–${Math.min(page * 10 + 10, total)}`}
          </span>
          <div>
            <button
              className="button secondary small"
              disabled={!page}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="button secondary small"
              disabled={(page + 1) * 10 >= total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
export function RequestForm({ base }: { base: string }) {
  const { store, user, run, demo } = useData(),
    params = useSearchParams();
  const kind =
    params.get("kind") === "estimate"
      ? "estimate"
      : params.get("kind") === "general"
        ? "general"
        : "support";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [receipt, setReceipt] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());
  if (!store || !user) return null;
  if (user.role === "technician")
    return (
      <Empty title="Request intake is handled by dispatch">
        Ask your dispatcher to create or link a follow-up request. You can
        continue work assigned or shared with you.
        <Link className="text-link" href={`${base}/requests`}>
          Back to my work
        </Link>
      </Empty>
    );
  const dispatch = isDispatch(user.role);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const p = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await run({
        type: "create_request",
        key: key.current,
        payload: {
          ...p,
          kind,
          linked_request_id: params.get("followup") ?? "",
          preferences: [p.window1, p.window2, p.window3].filter(Boolean),
        },
      });
      if (files.length) {
        if (demo)
          throw new Error(
            "Your demo request is saved. File storage is available only in a connected workspace; no files were uploaded.",
          );
        for (const file of files)
          await uploadAttachment(file, result.id!, user!.id);
      }
      setReceipt(result.id!);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your form is still here; try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href={`${base}/requests`}>
        <ArrowLeft size={16} />
        Back to requests
      </Link>
      <PageHeading
        eyebrow={
          dispatch
            ? "CLIENT INTAKE"
            : kind === "estimate"
              ? "LET’S PLAN WHAT’S NEXT"
              : "WE’RE HERE TO HELP"
        }
        title={
          dispatch
            ? kind === "estimate"
              ? "Record an estimate request"
              : kind === "general"
                ? "Record a client question"
                : "Record a support request"
            : kind === "estimate"
              ? "Request an on-site estimate"
              : kind === "general"
                ? "Message Net-Tech"
                : "How can we help?"
        }
        description={
          dispatch
            ? "Create a request on the client’s behalf, using their location and contact details."
            : kind === "estimate"
              ? "Tell us about your project. We’ll follow up to confirm a visit."
              : kind === "general"
                ? "Ask a question and keep the conversation in one place."
                : "A few details now help us get you back to work sooner."
        }
      />
      {receipt ? (
        <section className="panel receipt">
          <span className="receipt-check">
            <CheckCircle2 size={36} />
          </span>
          <h2>{dispatch ? "Request recorded." : "We have your request."}</h2>
          <p>
            {store.requests.find((r) => r.id === receipt)?.reference ??
              "Request saved"}
          </p>
          <p>
            {dispatch
              ? "Review priority, assign a technician, and confirm any visit with the client."
              : kind === "estimate"
                ? "Awaiting scheduling confirmation. Your preferred windows are not reserved."
                : "You can follow the conversation and add details at any time."}
          </p>
          {demo && (
            <p className="demo-hint">
              This is a demo receipt. No email or message was sent.
            </p>
          )}
          <Link className="button" href={`${base}/requests/${receipt}`}>
            View request
            <ArrowRight size={16} />
          </Link>
        </section>
      ) : (
        <div className="form-layout">
          <form className="panel form-panel" onSubmit={submit}>
            <h2>
              {kind === "estimate"
                ? dispatch
                  ? "Client project"
                  : "Your project"
                : "Request details"}
            </h2>
            <div className="form-grid">
              <label className="wide">
                Location
                <select name="location_id" required defaultValue="">
                  <option value="" disabled>
                    Select a location
                  </option>
                  {store.locations.map((l) => (
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
              {kind !== "general" && (
                <label className="wide">
                  {kind === "estimate"
                    ? "What are you planning?"
                    : "What do you need help with?"}
                  <select name="category" required>
                    {(kind === "estimate"
                      ? [
                          "New equipment",
                          "Installation",
                          "Upgrades",
                          "Other services",
                        ]
                      : store.settings.categories
                    ).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="wide">
                A short summary
                <input
                  name="title"
                  required
                  minLength={5}
                  maxLength={160}
                  placeholder={
                    kind === "estimate"
                      ? "e.g. Security cameras for our second location"
                      : "e.g. Office Wi-Fi keeps disconnecting"
                  }
                />
              </label>
              <label className="wide">
                {kind === "estimate"
                  ? "Tell us about the project"
                  : "Tell us what’s happening"}
                <textarea
                  name="description"
                  required
                  minLength={10}
                  maxLength={10000}
                  rows={5}
                  placeholder="Include anything that would help our team understand what you need."
                />
              </label>
              {kind === "support" && (
                <>
                  <label>
                    When did it start?
                    <input
                      name="started_at"
                      placeholder="e.g. This morning"
                      maxLength={200}
                    />
                  </label>
                  <label>
                    How is it affecting work?
                    <select name="impact">
                      <option>One person affected</option>
                      <option>Several people affected</option>
                      <option>Business / site unable to operate</option>
                    </select>
                  </label>
                </>
              )}
              {kind === "estimate" && (
                <>
                  <div className="wide info-box">
                    <CalendarDays size={18} />
                    <span>
                      {dispatch
                        ? "Record the client’s preferences, then confirm a booking with them in the calendar."
                        : "Preferred windows help us plan. A visit is booked only after Net-Tech confirms it with you."}
                    </span>
                  </div>
                  {[1, 2, 3].map((n) => (
                    <label key={n} className="wide">
                      Preferred date / time window {n} (optional)
                      <input
                        name={`window${n}`}
                        placeholder="e.g. October 6, between 9 AM and noon"
                        maxLength={120}
                      />
                    </label>
                  ))}
                  <label>
                    Budget (optional)
                    <input
                      name="budget"
                      maxLength={100}
                      placeholder="A range is fine"
                    />
                  </label>
                  <label>
                    Target completion (optional)
                    <input name="target_date" type="date" />
                  </label>
                </>
              )}
              <label>
                {dispatch ? "Client contact name" : "Contact name"}
                <input
                  name="contact_name"
                  defaultValue={dispatch ? "" : user.name}
                  required
                  maxLength={120}
                />
              </label>
              <label>
                {dispatch ? "Client contact phone" : "Contact phone"}
                <input
                  name="contact_phone"
                  defaultValue={dispatch ? "" : user.phone}
                  type="tel"
                  maxLength={40}
                />
              </label>
              <div className="wide">
                <span className="field-label">Photos or files (optional)</span>
                <label className="upload-zone">
                  <Paperclip size={20} />
                  <strong>Add photos, screenshots, or PDFs</strong>
                  <span>Up to 5 files · 10 MB each</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    disabled={demo}
                    onChange={(e) => {
                      const f = Array.from(e.target.files ?? []);
                      if (
                        f.length > 5 ||
                        f.some((x) => x.size > 10 * 1024 * 1024)
                      ) {
                        setError("Choose up to 5 files, 10 MB each.");
                        return;
                      }
                      setFiles(f);
                    }}
                  />
                </label>
                {demo && (
                  <small className="muted">
                    File uploads are disabled in this synthetic demo.
                  </small>
                )}
                {files.map((f) => (
                  <div className="file-chip" key={f.name}>
                    <FileText size={14} />
                    {f.name}
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles(files.filter((x) => x !== f))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {error && <Alert>{error}</Alert>}
            <div className="form-footer">
              <span>
                {dispatch
                  ? "Request details are visible to the client. Keep internal notes in the staff conversation."
                  : "Your request is shared securely with Net-Tech."}
              </span>
              <button className="button" disabled={busy}>
                {busy
                  ? "Saving…"
                  : dispatch
                    ? "Create request"
                    : kind === "estimate"
                      ? "Request a visit"
                      : "Send request"}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
          <aside className="form-aside">
            <span className="soft-icon">
              <MessageSquareIcon />
            </span>
            <h3>
              {dispatch
                ? "A clear handoff starts here."
                : "Real people. Practical help."}
            </h3>
            <p>
              {dispatch
                ? "Capture what the client needs, identify the right contact, and coordinate the next step."
                : "Your request goes to the Net-Tech team. We’ll review the details and follow up right here."}
            </p>
            <ol>
              <li>
                <span>1</span>
                {dispatch
                  ? "Record the client’s needs"
                  : "Tell us what you need"}
              </li>
              <li>
                <span>2</span>
                {dispatch
                  ? "Review and assign the request"
                  : "We’ll review and respond"}
              </li>
              <li>
                <span>3</span>
                {dispatch
                  ? "Follow up with the client"
                  : "We’ll find the next step together"}
              </li>
            </ol>
            {!dispatch && (
              <>
                <hr />
                <p>Need to talk it through?</p>
                <a
                  className="text-link"
                  href={`tel:${store.settings.support_phone}`}
                >
                  {store.settings.support_phone}
                </a>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
function MessageSquareIcon() {
  return <UserRound size={24} />;
}
export function RequestDetail({ base, id }: { base: string; id: string }) {
  const { store, user, run, demo } = useData();
  const [mode, setMode] = useState<"reply" | "note">("reply"),
    [drafts, setDrafts] = useState({ reply: "", note: "" }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState(false),
    [messagePage, setMessagePage] = useState(1);
  const [older, setOlder] = useState<Message[]>([]),
    [moreAvailable, setMoreAvailable] = useState(true);
  const messageKeys = useRef({
    reply: crypto.randomUUID(),
    note: crypto.randomUUID(),
  });
  const body = drafts[mode];
  const seen = useRef("");
  const r = store?.requests.find((r) => r.id === id);
  const latest =
    store?.messages.filter((m) => m.request_id === id).at(-1)?.id ?? "";
  useEffect(() => {
    if (r && user && seen.current !== id + latest) {
      seen.current = id + latest;
      void run({
        type: "read",
        id,
        key: crypto.randomUUID(),
        payload: {},
      }).catch(() => {});
    }
  }, [id, latest, r, user, run]);
  if (!store || !user) return null;
  if (!r)
    return (
      <Empty title="Request unavailable">
        This request doesn’t exist or isn’t shared with your account.
        <Link className="text-link" href={`${base}/requests`}>
          Back to requests
        </Link>
      </Empty>
    );
  const staff = isStaff(user.role),
    dispatch = isDispatch(user.role),
    loc = store.locations.find((l) => l.id === r.location_id),
    assignee = store.profiles.find((p) => p.id === r.assignee_id);
  const messages = [
      ...(mode === "note" ? store.notes : [...older, ...store.messages]),
    ]
      .filter(
        (m, i, all) =>
          m.request_id === id && all.findIndex((x) => x.id === m.id) === i,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    archived = ["closed", "canceled"].includes(r.status);
  async function action(a: Action) {
    setError("");
    setBusy(true);
    try {
      await run(a);
      setEdit(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await run({
        type: mode,
        id,
        key: messageKeys.current[mode],
        payload: { body },
      });
      setDrafts((current) => ({ ...current, [mode]: "" }));
      messageKeys.current[mode] = crypto.randomUUID();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Message failed. Your draft is preserved; try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href={`${base}/requests`}>
        <ArrowLeft size={16} />
        {user.role === "technician" ? "My work" : "All requests"}
      </Link>
      <PageHeading
        eyebrow={`${r.reference} / ${r.kind.toUpperCase()}`}
        title={r.title}
        description={`Opened ${dateLabel(r.created_at, "MMMM d, yyyy")} · ${loc?.name ?? "Location"}`}
        actions={
          <>
            <Badge status={r.status} staff={staff} />
            {staff && (
              <button
                className="button secondary"
                onClick={() => setEdit(true)}
              >
                Manage request
              </button>
            )}
          </>
        }
      />
      {error && <Alert>{error}</Alert>}
      {r.status === "resolved" && (
        <div className="resolution-banner">
          <CheckCircle2 size={24} />
          <div>
            <strong>
              {staff ? "Request resolved" : "We believe this is taken care of."}
            </strong>
            <p>{r.completion_summary}</p>
            <small>
              A reply within {store.settings.closure_days} days reopens this
              request.
            </small>
          </div>
          {!staff && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void action({
                  type: "client_action",
                  id,
                  key: crypto.randomUUID(),
                  payload: { action: "confirm" },
                })
              }
            >
              Yes, it’s fixed
            </button>
          )}
        </div>
      )}
      <div className="detail-grid">
        <div>
          <section className="panel issue-description">
            <SectionHead title="The request" />
            <p>{r.description}</p>
            <div className="detail-tags">
              <span>{r.category}</span>
              <span>{r.impact}</span>
            </div>
            {r.preferences.length > 0 && (
              <div className="info-box">
                <CalendarDays size={18} />
                <span>
                  {staff ? "Client’s preferred windows" : "Preferred windows"}:{" "}
                  {r.preferences.join(" · ")}. Preferences are not confirmed
                  bookings.
                </span>
              </div>
            )}
          </section>
          <section
            className={`panel conversation ${mode === "note" ? "internal-conversation" : ""}`}
          >
            <div className="conversation-header">
              <div>
                <h2>
                  {mode === "note" ? (
                    <>
                      <LockKeyhole size={17} />
                      Internal notes
                    </>
                  ) : (
                    "Conversation"
                  )}
                </h2>
                <p>
                  {mode === "note"
                    ? "Visible to authorized Net-Tech staff only. Never sent to the client."
                    : staff
                      ? "Public conversation with the client. Replies are visible to contacts with access."
                      : "You and the Net-Tech team, in one conversation."}
                </p>
              </div>
              {staff && (
                <div className="segmented">
                  <button
                    className={mode === "reply" ? "active" : ""}
                    aria-pressed={mode === "reply"}
                    disabled={busy}
                    onClick={() => setMode("reply")}
                  >
                    Client reply
                  </button>
                  <button
                    className={mode === "note" ? "active" : ""}
                    aria-pressed={mode === "note"}
                    disabled={busy}
                    onClick={() => setMode("note")}
                  >
                    <LockKeyhole size={13} />
                    Internal
                  </button>
                </div>
              )}
            </div>
            <div className="messages-list">
              {((demo && messages.length > messagePage * 30) ||
                (!demo &&
                  mode === "reply" &&
                  messages.length >= 30 &&
                  moreAvailable)) && (
                <button
                  className="text-link"
                  onClick={async () => {
                    if (demo) {
                      setMessagePage(messagePage + 1);
                      return;
                    }
                    try {
                      const response = await fetch(
                        `/api/messages?request=${id}&page=${messagePage}`,
                      );
                      const result = await response.json();
                      if (!response.ok) throw new Error(result.error);
                      setOlder([...older, ...result.messages]);
                      setMoreAvailable(result.messages.length === 30);
                      setMessagePage(messagePage + 1);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Could not load earlier replies.",
                      );
                    }
                  }}
                >
                  Load earlier messages
                </button>
              )}
              {messages.length ? (
                messages.slice(-messagePage * 30).map((m) => {
                  const author = store.profiles.find(
                    (p) => p.id === m.author_id,
                  );
                  return (
                    <article
                      className={`message ${m.author_id === user.id ? "own-message" : ""}`}
                      key={m.id}
                    >
                      <span
                        className={`avatar ${author && isStaff(author.role) ? "avatar-blue" : ""}`}
                      >
                        {initials(author?.name ?? "Participant")}
                      </span>
                      <div>
                        <div className="message-author">
                          <strong>
                            {author?.name ?? "Previous participant"}
                          </strong>
                          {author && isStaff(author.role) && (
                            <span className="team-label">NET-TECH</span>
                          )}
                          <time dateTime={m.created_at}>
                            {dateLabel(m.created_at, "MMM d, h:mm a")}
                          </time>
                        </div>
                        <p>{m.body}</p>
                        <small>
                          {demo ? "Demo message" : "Sent"}
                          {mode === "note" ? " · Staff only" : ""}
                        </small>
                        {mode === "note" && !demo && (
                          <label className="text-link" style={{ marginTop: 8 }}>
                            <Paperclip size={13} />
                            Attach staff-only file
                            <input
                              className="sr-only"
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  await uploadAttachment(
                                    file,
                                    id,
                                    user.id,
                                    m.id,
                                  );
                                  await action({
                                    type: "read",
                                    id,
                                    key: crypto.randomUUID(),
                                    payload: {},
                                  });
                                } catch (e) {
                                  setError(
                                    e instanceof Error
                                      ? e.message
                                      : "Upload failed. Retry this file.",
                                  );
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <Empty
                  title={
                    mode === "note"
                      ? "No internal notes yet"
                      : "Start the conversation"
                  }
                >
                  {mode === "note"
                    ? "Keep work context here, separate from client messages."
                    : staff
                      ? "Send an update or ask the client a question."
                      : "Send a message to the Net-Tech team."}
                </Empty>
              )}
            </div>
            {archived ? (
              <div className="composer-footer">
                <p>
                  This request is archived.
                  {user.role !== "technician" &&
                    " Start a linked follow-up to continue."}
                </p>
                {user.role === "technician" ? (
                  <p>Ask dispatch to create the linked follow-up.</p>
                ) : (
                  <Link
                    href={`${base}/requests/new?followup=${r.id}`}
                    className="button secondary"
                  >
                    Create follow-up
                  </Link>
                )}
              </div>
            ) : (
              <form className="composer" onSubmit={send}>
                <label htmlFor="reply-body">
                  {mode === "note" ? (
                    <>
                      <LockKeyhole size={14} /> Staff only — never sent to the
                      client
                    </>
                  ) : staff ? (
                    "Reply to the client"
                  ) : (
                    "Reply to the conversation"
                  )}
                </label>
                <textarea
                  id="reply-body"
                  value={body}
                  onChange={(e) =>
                    setDrafts((current) => ({
                      ...current,
                      [mode]: e.target.value,
                    }))
                  }
                  disabled={busy}
                  required
                  maxLength={10000}
                  placeholder={
                    mode === "note"
                      ? "Add context for your team…"
                      : "Write your message…"
                  }
                  rows={3}
                />
                <div>
                  <small>
                    {mode === "note"
                      ? "Internal work notes"
                      : staff
                        ? "Public reply · visible to the client"
                        : "Asynchronous messaging · we’ll follow up here"}
                  </small>
                  <button
                    className="button small"
                    disabled={busy || !body.trim()}
                  >
                    {busy
                      ? "Sending…"
                      : mode === "note"
                        ? "Save note"
                        : "Send reply"}
                    <Send size={15} />
                  </button>
                </div>
              </form>
            )}
          </section>
          <section className="panel">
            <SectionHead title="Activity" />
            <div className="request-events">
              {store.events
                .filter((e) => e.request_id === id)
                .slice()
                .reverse()
                .map((e) => (
                  <div key={e.id}>
                    <span className="status-dot" />
                    <strong>{e.label}</strong>
                    <time>{dateLabel(e.created_at, "MMM d · h:mm a")}</time>
                  </div>
                ))}
            </div>
          </section>
        </div>
        <aside className="detail-sidebar">
          <RequestSharing request={r} />
          <section className="panel">
            <SectionHead title="Request details" />
            <dl className="metadata">
              <dt>
                <MapPin size={15} />
                Location
              </dt>
              <dd>
                {loc?.name}
                <small>{loc?.address}</small>
              </dd>
              <dt>
                <UserRound size={15} />
                {staff ? "Assigned technician" : "Your technician"}
              </dt>
              <dd>
                {assignee ? (
                  <span className="person-inline">
                    <span className="avatar avatar-tiny avatar-blue">
                      {initials(assignee.name)}
                    </span>
                    {assignee.name}
                  </span>
                ) : (
                  "Awaiting assignment"
                )}
                {assignee && !assignee.active && (
                  <small className="danger-text">
                    Inactive employee — reassignment needed
                  </small>
                )}
              </dd>
              <dt>Priority</dt>
              <dd className={`priority priority-${r.priority}`}>
                <i />
                {r.priority}
              </dd>
              <dt>Contact</dt>
              <dd>
                {r.contact_name}
                {r.contact_phone && (
                  <a href={`tel:${r.contact_phone}`}>{r.contact_phone}</a>
                )}
              </dd>
            </dl>
            {staff && loc && (
              <div className="location-record">
                <LocationControls location={loc} />
              </div>
            )}
            {!staff && !archived && (
              <button
                className="text-link danger-text"
                disabled={busy}
                onClick={() =>
                  void action({
                    type: "client_action",
                    id,
                    key: crypto.randomUUID(),
                    payload: { action: "cancel" },
                  })
                }
              >
                Request cancellation
              </button>
            )}
            {!staff && (
              <p className="caption">
                Cancellation is reviewed by Net-Tech. Any confirmed visit
                remains active.
              </p>
            )}
          </section>
          <section className="panel">
            <SectionHead
              title="Visits"
              action={
                dispatch ? (
                  <Link
                    className="text-link"
                    href={`${base}/calendar?request=${id}`}
                  >
                    <Plus size={16} />
                    Schedule
                  </Link>
                ) : undefined
              }
            />
            {store.appointments
              .filter((a) => a.request_id === id)
              .map((a) => (
                <Link
                  className="mini-visit"
                  href={`${base}/calendar`}
                  key={a.id}
                >
                  <CalendarDays size={20} />
                  <span>
                    <strong>{a.purpose}</strong>
                    <small>
                      {dateLabel(a.starts_at, "MMM d")} ·{" "}
                      {timeLabel(a.starts_at)}
                    </small>
                    <Badge status={a.status} />
                  </span>
                </Link>
              ))}
            {!store.appointments.some((a) => a.request_id === id) && (
              <p className="padded muted">No visits scheduled.</p>
            )}
          </section>
          <section className="panel">
            <SectionHead title="Attachments" />
            <div className="attachment-list">
              {store.attachments
                .filter(
                  (a) =>
                    a.request_id === id &&
                    (mode === "note" ? !!a.note_id : !a.note_id),
                )
                .map((a) => (
                  <a
                    key={a.id}
                    href={`/api/attachments/${a.id}`}
                    className="file-chip"
                  >
                    <FileText size={17} />
                    {a.name}
                    <Download size={15} />
                  </a>
                ))}
              {!demo && !archived && mode === "reply" && (
                <label className="button secondary small">
                  <Paperclip size={16} />
                  Attach file
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await uploadAttachment(file, id, user.id);
                        await action({
                          type: "read",
                          id,
                          key: crypto.randomUUID(),
                          payload: {},
                        });
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Upload failed; please try again.",
                        );
                      }
                    }}
                  />
                </label>
              )}
              {demo && (
                <p className="caption">
                  Private file storage is available in connected mode.
                </p>
              )}
            </div>
          </section>
          {staff && (
            <Link
              className="button secondary full"
              href={`${base}/time?request=${id}`}
            >
              <Clock3 size={16} />
              Log time
            </Link>
          )}
        </aside>
      </div>
      {edit && (
        <Modal title="Manage request" onClose={() => setEdit(false)}>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              void action({
                type: "update_request",
                id,
                key: crypto.randomUUID(),
                payload: Object.fromEntries(new FormData(e.currentTarget)),
              });
            }}
          >
            <label>
              Status
              <select name="status" defaultValue={r.status}>
                {Object.entries(statusLabel).map(([v, l]) => (
                  <option key={v} value={v}>
                    {v === "waiting_client" ? "Waiting on client" : l}
                  </option>
                ))}
              </select>
            </label>
            {dispatch && (
              <>
                <label>
                  Assigned technician
                  <select name="assignee_id" defaultValue={r.assignee_id ?? ""}>
                    <option value="">Unassigned</option>
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
                  Priority
                  <select name="priority" defaultValue={r.priority}>
                    {["low", "normal", "high", "urgent"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Target completion date
                  <input
                    name="target_date"
                    type="date"
                    defaultValue={r.target_date ?? ""}
                  />
                </label>
                <label>
                  Request type
                  <select name="kind" defaultValue={r.kind}>
                    {["support", "estimate", "general"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              Public completion summary
              <textarea
                name="completion_summary"
                defaultValue={r.completion_summary ?? ""}
                placeholder="Required when resolving. Visible to the client."
                maxLength={10000}
              />
            </label>
            {error && <Alert>{error}</Alert>}
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Inbox({ base }: { base: string }) {
  const { store, user } = useData();
  const [query, setQuery] = useState("");
  if (!store || !user) return null;
  return (
    <>
      <PageHeading
        eyebrow="STAY IN THE LOOP"
        title="Messages"
        description="One conversation for every request. Pick up right where you left off."
        actions={
          user.role !== "technician" ? (
            <Link href={`${base}/requests/new?kind=general`} className="button">
              <Plus size={16} />
              {isDispatch(user.role)
                ? "Record client question"
                : "New conversation"}
            </Link>
          ) : undefined
        }
      />
      <section className="panel inbox-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search conversations"
              placeholder="Find a conversation…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {store.requests
          .filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
          .map((r) => {
            const message = store.messages
              .filter((m) => m.request_id === r.id)
              .at(-1);
            const unread = unreadCount(store, user.id, r.id);
            return (
              <Link
                className={`inbox-row ${unread ? "unread" : ""}`}
                href={`${base}/requests/${r.id}`}
                key={r.id}
              >
                <span className="avatar avatar-blue">
                  {isStaff(user.role)
                    ? initials(
                        store.organizations.find(
                          (o) => o.id === r.organization_id,
                        )?.name ?? "Client",
                      )
                    : "NT"}
                </span>
                <div>
                  <div>
                    <strong>{r.title}</strong>
                    <time>
                      {dateLabel(message?.created_at ?? r.created_at, "MMM d")}
                    </time>
                  </div>
                  <p>{message?.body ?? r.description}</p>
                  <small>
                    {r.reference} ·{" "}
                    {
                      store.organizations.find(
                        (o) => o.id === r.organization_id,
                      )?.name
                    }
                  </small>
                </div>
                {!!unread && (
                  <span
                    className="unread-dot"
                    aria-label={`${unread} unread messages`}
                  />
                )}
                <ArrowRight size={17} />
              </Link>
            );
          })}
        {!store.requests.length && (
          <Empty title="No conversations yet">
            {user.role === "technician"
              ? "Conversations appear when requests are assigned or shared with you."
              : isDispatch(user.role)
                ? "Record a client request to start a conversation."
                : "Create a request to start a conversation."}
          </Empty>
        )}
      </section>
    </>
  );
}
