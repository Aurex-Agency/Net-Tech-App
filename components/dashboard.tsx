"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Headphones,
  Camera,
  MessageSquare,
  CalendarDays,
  MapPin,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  ArrowDownLeft,
  Inbox,
  TriangleAlert,
} from "lucide-react";
import { useData } from "./provider";
import { PageHeading, SectionHead, Badge, Empty } from "./ui";
import { dateLabel, timeLabel, initials } from "@/lib/format";
import { isDispatch, isStaff, type ServiceRequest } from "@/lib/types";
export function RequestTable({
  requests,
  base,
  compact = false,
}: {
  requests: ServiceRequest[];
  base: string;
  compact?: boolean;
}) {
  const { store, user } = useData();
  if (!store || !user) return null;
  if (!requests.length)
    return (
      <Empty title="You’re all caught up">New requests will appear here.</Empty>
    );
  return (
    <div className="table-scroll">
      <table className="request-table request-list-table">
        <thead>
          <tr>
            <th>Request</th>
            {isStaff(user.role) && !compact && <th>Client</th>}
            <th>Status</th>
            {!compact && <th>Priority</th>}
            <th>{isStaff(user.role) ? "Assigned to" : "Updated"}</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const assignee = store.profiles.find((p) => p.id === r.assignee_id);
            return (
              <tr key={r.id}>
                <td>
                  <Link
                    className="request-title"
                    href={`${base}/requests/${r.id}`}
                  >
                    <span
                      className={`category-symbol ${r.kind === "estimate" ? "purple" : ""}`}
                    >
                      {r.kind === "estimate" ? (
                        <Camera size={18} />
                      ) : (
                        <Headphones size={18} />
                      )}
                    </span>
                    <span>
                      <strong>{r.title}</strong>
                      <small>
                        {r.reference}
                        <span>·</span>
                        {
                          store.locations.find((l) => l.id === r.location_id)
                            ?.name
                        }
                      </small>
                    </span>
                  </Link>
                </td>
                {isStaff(user.role) && !compact && (
                  <td>
                    {
                      store.organizations.find(
                        (o) => o.id === r.organization_id,
                      )?.name
                    }
                  </td>
                )}
                <td>
                  <Badge status={r.status} staff={isStaff(user.role)} />
                </td>
                {!compact && (
                  <td>
                    <span className={`priority priority-${r.priority}`}>
                      <i />
                      {r.priority}
                    </span>
                  </td>
                )}
                <td>
                  {isStaff(user.role) ? (
                    assignee ? (
                      <span className="person-inline">
                        <span className="avatar avatar-tiny">
                          {initials(assignee.name)}
                        </span>
                        {assignee.name.split(" ")[0]}
                        {!assignee.active && (
                          <span className="danger-text">Inactive</span>
                        )}
                      </span>
                    ) : (
                      <span className="muted">Unassigned</span>
                    )
                  ) : (
                    <span className="muted">
                      {dateLabel(r.updated_at, "MMM d")}
                    </span>
                  )}
                </td>
                <td>
                  <Link
                    className="row-arrow"
                    href={`${base}/requests/${r.id}`}
                    aria-label={`Open ${r.reference}`}
                  >
                    <ChevronRight size={17} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function Dashboard({ base }: { base: string }) {
  const { store, user } = useData();
  const [now] = useState(() => Date.now());
  if (!store || !user) return null;
  const staff = isStaff(user.role),
    dispatch = isDispatch(user.role),
    open = store.requests.filter(
      (r) => !["resolved", "closed", "canceled"].includes(r.status),
    );
  const waiting = store.requests.filter((r) => r.status === "waiting_client");
  const visits = store.appointments
    .filter(
      (a) =>
        new Date(a.ends_at).getTime() >= now &&
        !["completed", "canceled", "no_show"].includes(a.status),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = visits.find((a) =>
      ["confirmed", "en_route", "on_site"].includes(a.status),
    ),
    request = store.requests.find((r) => r.id === next?.request_id),
    location = store.locations.find((l) => l.id === request?.location_id),
    tech = store.profiles.find((p) => p.id === next?.technician_id);
  const date = new Date().toISOString();
  return (
    <>
      <PageHeading
        eyebrow={dateLabel(date, "EEEE, MMMM d")}
        title={
          dispatch
            ? "Your operations, at a glance."
            : staff
              ? `Let’s get to work, ${user.name.split(" ")[0]}.`
              : `Good to see you, ${user.name.split(" ")[0]}.`
        }
        description={
          dispatch
            ? "A clear view of what needs attention and what’s coming next."
            : staff
              ? "Your assigned work, conversations, and next stops in one place."
              : "Your technology, your team. We’ll take it from here."
        }
        actions={
          <Link
            href={`${base}/${user.role === "technician" ? "calendar" : "requests/new"}`}
            className="button"
          >
            {user.role === "technician" ? (
              <CalendarDays size={17} />
            ) : (
              <Plus size={17} />
            )}
            {user.role === "technician"
              ? "View schedule"
              : staff
                ? "New request"
                : "Get support"}
          </Link>
        }
      />
      {!staff && (
        <div className="quick-actions">
          <Link
            className="quick-action primary-action"
            href={`${base}/requests/new`}
          >
            <span className="quick-icon">
              <Headphones size={24} />
            </span>
            <div>
              <h2>Get support</h2>
              <p>Something not working? Let’s fix it.</p>
            </div>
            <ArrowUpRight size={22} />
          </Link>
          <Link
            className="quick-action"
            href={`${base}/requests/new?kind=estimate`}
          >
            <span className="quick-icon">
              <Camera size={24} />
            </span>
            <div>
              <h2>Request an on-site estimate</h2>
              <p>Plan your next upgrade with us.</p>
            </div>
            <ArrowUpRight size={22} />
          </Link>
          <Link
            className="quick-action"
            href={`${base}/requests/new?kind=general`}
          >
            <span className="quick-icon">
              <MessageSquare size={24} />
            </span>
            <div>
              <h2>Message Net-Tech</h2>
              <p>A question? Start a conversation.</p>
            </div>
            <ArrowUpRight size={22} />
          </Link>
        </div>
      )}
      <div className="stat-strip">
        {(dispatch
          ? [
              {
                label: "Open requests",
                value: store.summary?.open ?? open.length,
                icon: Inbox,
                caption: "Across your clients",
                link: "requests",
              },
              {
                label: "Unassigned",
                value:
                  store.summary?.unassigned ??
                  open.filter(
                    (r) =>
                      !r.assignee_id ||
                      !store.profiles.find((p) => p.id === r.assignee_id)
                        ?.active,
                  ).length,
                icon: ArrowDownLeft,
                caption: "Ready for your review",
                link: "requests?filter=unassigned",
              },
              {
                label: "High-impact issues",
                value:
                  store.summary?.high ??
                  open.filter((r) => ["high", "urgent"].includes(r.priority))
                    .length,
                icon: TriangleAlert,
                caption: "Prioritize these requests",
                link: "requests?priority=high",
              },
              {
                label: "Upcoming visits",
                value: store.summary?.visits ?? visits.length,
                icon: CalendarDays,
                caption: "Keep the day moving",
                link: "calendar",
              },
            ]
          : [
              {
                label: staff ? "Assigned requests" : "Open requests",
                value: store.summary?.open ?? open.length,
                icon: Inbox,
                caption: staff ? "Your active work" : "We’re working on it",
                link: "requests",
              },
              {
                label: staff ? "Upcoming visits" : "Upcoming appointment",
                value: store.summary?.visits ?? visits.length,
                icon: CalendarDays,
                caption: next
                  ? dateLabel(next.starts_at, "EEE, MMM d")
                  : "No visits scheduled",
                link: "calendar",
              },
              {
                label: staff ? "Resolved requests" : "Resolved requests",
                value:
                  store.summary?.resolved ??
                  store.requests.filter((r) =>
                    ["resolved", "closed"].includes(r.status),
                  ).length,
                icon: CheckCircle2,
                caption: staff
                  ? "Work you’ve taken care of"
                  : "A little less to worry about",
                link: "requests?filter=resolved",
              },
            ]
        ).map(({ label, value, icon: Icon, caption, link }) => (
          <Link className="stat" href={`${base}/${link}`} key={label}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{String(value).padStart(2, "0")}</strong>
            <small>
              {caption}
              <ArrowUpRight size={13} />
            </small>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          {!staff && waiting.length > 0 && (
            <section className="attention-card">
              <div className="attention-top">
                <span className="attention-icon">
                  <MessageSquare size={20} />
                </span>
                <span>
                  <h2>A quick reply will help us move forward.</h2>
                  <p>
                    We need a little more information on{" "}
                    {waiting.length === 1
                      ? "your request"
                      : `${waiting.length} requests`}
                    .
                  </p>
                </span>
                <span className="badge status-waiting_client">Your turn</span>
              </div>
              {waiting.slice(0, 2).map((r) => (
                <Link
                  href={`${base}/requests/${r.id}`}
                  className="attention-request"
                  key={r.id}
                >
                  <div>
                    <small>{r.reference}</small>
                    <strong>{r.title}</strong>
                    <p>
                      {store.messages
                        .filter(
                          (m) =>
                            m.request_id === r.id && m.author_id !== user.id,
                        )
                        .at(-1)?.body ??
                        "Open your request to reply to the team."}
                    </p>
                  </div>
                  <span className="button small secondary">
                    Reply <ArrowRight size={14} />
                  </span>
                </Link>
              ))}
            </section>
          )}
          <section className="panel">
            <SectionHead
              title={
                dispatch
                  ? "Needs attention"
                  : staff
                    ? "Your work queue"
                    : "Recent requests"
              }
              subtitle={
                dispatch
                  ? "New requests and work waiting for an owner."
                  : "Every conversation. Every update. All in one place."
              }
              action={
                <Link className="text-link" href={`${base}/requests`}>
                  View all <ArrowRight size={15} />
                </Link>
              }
            />
            <RequestTable
              requests={(dispatch
                ? [...open].sort(
                    (a, b) => Number(!!a.assignee_id) - Number(!!b.assignee_id),
                  )
                : store.requests
              ).slice(0, 5)}
              base={base}
              compact
            />
          </section>
          {staff && (
            <section className="panel">
              <SectionHead
                title="Keep work moving"
                subtitle="Follow up on the details that make a difference."
              />
              <div className="action-list">
                <Link href={`${base}/requests?filter=waiting_client`}>
                  <span className="soft-icon">
                    <MessageSquare size={20} />
                  </span>
                  <div>
                    <strong>Waiting on a client</strong>
                    <p>{waiting.length} requests need more information</p>
                  </div>
                  <ChevronRight size={18} />
                </Link>
                <Link href={`${base}/calendar`}>
                  <span className="soft-icon">
                    <CalendarDays size={20} />
                  </span>
                  <div>
                    <strong>Review the schedule</strong>
                    <p>Confirm visits and check availability</p>
                  </div>
                  <ChevronRight size={18} />
                </Link>
              </div>
            </section>
          )}
        </div>
        <div className="dashboard-secondary">
          <section className="panel appointment-card">
            <SectionHead
              title={staff ? "Your next stop" : "Your next appointment"}
              action={<CalendarDays size={19} className="muted" />}
            />
            {next ? (
              <>
                <div className="appointment-date">
                  <span className="date-tile">
                    <small>{dateLabel(next.starts_at, "MMM")}</small>
                    <strong>{dateLabel(next.starts_at, "d")}</strong>
                  </span>
                  <div>
                    <strong>{dateLabel(next.starts_at, "EEEE, MMMM d")}</strong>
                    <span>
                      {timeLabel(next.starts_at)} – {timeLabel(next.ends_at)} CT
                    </span>
                    <Badge status={next.status} />
                  </div>
                </div>
                <h3>{next.purpose}</h3>
                <p className="icon-text">
                  <MapPin size={16} />
                  <span>
                    {location?.name}
                    <small>{location?.address}</small>
                  </span>
                </p>
                <div className="assigned-person">
                  <span className="avatar avatar-blue">
                    {initials(tech?.name ?? "NT")}
                  </span>
                  <span>
                    <small>Your technician</small>
                    <strong>{tech?.name ?? "To be assigned"}</strong>
                  </span>
                  <ShieldCheck size={18} />
                </div>
                <Link
                  href={`${base}/calendar`}
                  className="button secondary full"
                >
                  View appointment <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <Empty title="No upcoming visits">
                When a visit is confirmed, you’ll find the details here.
              </Empty>
            )}
          </section>
          <section className="panel activity-panel">
            <SectionHead title="Recent activity" />
            <div className="timeline">
              {store.events
                .slice()
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, 4)
                .map((e) => {
                  const r = store.requests.find((r) => r.id === e.request_id);
                  return (
                    <Link
                      href={`${base}/requests/${e.request_id}`}
                      key={e.id}
                      className="timeline-item"
                    >
                      <span className="timeline-dot">
                        <CheckCircle2 size={13} />
                      </span>
                      <div>
                        <strong>{e.label}</strong>
                        <p>{r?.title}</p>
                        <small>
                          {dateLabel(e.created_at, "MMM d · h:mm a")}
                        </small>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </section>
          <div className="secure-note">
            <ShieldCheck size={16} />
            <span>
              Your requests are shared only with the people who need to help.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
