import {
  isDispatch,
  isStaff,
  type Store,
  type Profile,
  type ServiceRequest,
  type Action,
  type RequestStatus,
  type Appointment,
} from "./types";
export function canRead(s: Store, user: Profile, r: ServiceRequest) {
  if (!user.active) return false;
  if (isDispatch(user.role)) return true;
  if (user.role === "technician")
    return (
      r.assignee_id === user.id ||
      s.collaborators.some(
        (c) => c.request_id === r.id && c.user_id === user.id,
      )
    );
  const member = s.memberships.find(
    (m) =>
      m.user_id === user.id &&
      m.organization_id === r.organization_id &&
      m.active,
  );
  return (
    !!member &&
    (member.admin ||
      r.created_by === user.id ||
      s.participants.some(
        (p) => p.request_id === r.id && p.user_id === user.id,
      ))
  );
}
export function scopeStore(s: Store, user: Profile): Store {
  const requests = s.requests.filter((r) => canRead(s, user, r));
  const ids = new Set(requests.map((r) => r.id));
  const orgs = new Set([
    ...requests.map((r) => r.organization_id),
    ...s.memberships
      .filter((m) => m.user_id === user.id && m.active)
      .map((m) => m.organization_id),
  ]);
  const related = (v: { request_id: string }) => ids.has(v.request_id);
  return {
    ...s,
    requests,
    site_notes: isStaff(user.role)
      ? (s.site_notes ?? []).filter(
          (n) =>
            isDispatch(user.role) ||
            requests.some((r) => r.location_id === n.location_id),
        )
      : [],
    participants: s.participants.filter(related),
    collaborators: isStaff(user.role) ? s.collaborators.filter(related) : [],
    organizations: s.organizations.filter(
      (o) => isDispatch(user.role) || orgs.has(o.id),
    ),
    locations: s.locations.filter(
      (l) =>
        isDispatch(user.role) ||
        (user.role === "technician"
          ? requests.some((r) => r.location_id === l.id)
          : orgs.has(l.organization_id)),
    ),
    messages: s.messages.filter(related),
    notes: isStaff(user.role) ? s.notes.filter(related) : [],
    appointments: s.appointments.filter(related),
    attachments: s.attachments.filter(
      (a) => related(a) && (!a.note_id || isStaff(user.role)),
    ),
    work_entries: isStaff(user.role) ? s.work_entries.filter(related) : [],
    events: s.events.filter(related),
    notifications: s.notifications.filter((n) => n.user_id === user.id),
    availability: isDispatch(user.role)
      ? s.availability
      : s.availability.filter((a) => a.user_id === user.id),
    memberships: s.memberships.filter(
      (m) => isDispatch(user.role) || m.user_id === user.id,
    ),
    read_cursors: s.read_cursors.filter((c) => c.user_id === user.id),
    profiles: s.profiles.filter(
      (p) =>
        isStaff(user.role) ||
        p.id === user.id ||
        requests.some((r) => r.assignee_id === p.id) ||
        s.messages.some((m) => related(m) && m.author_id === p.id),
    ),
  };
}
export function checkTransition(
  from: RequestStatus,
  to: RequestStatus,
  summary?: string,
) {
  if (from === "closed" || from === "canceled")
    throw new Error("This request is archived. Create a linked follow-up.");
  if (to === "resolved" && !summary?.trim())
    throw new Error("Add a public completion summary before resolving.");
  if (to === "closed" && from !== "resolved")
    throw new Error("Resolve the request before closing it.");
}
export function bookingConflicts(
  visits: Appointment[],
  next: Appointment,
  buffer: number,
) {
  if (["proposed", "canceled", "completed", "no_show"].includes(next.status))
    return false;
  return visits.some(
    (a) =>
      a.id !== next.id &&
      a.technician_id === next.technician_id &&
      ["confirmed", "en_route", "on_site"].includes(a.status) &&
      new Date(next.starts_at).getTime() <
        new Date(a.ends_at).getTime() +
          Math.max(buffer, a.buffer_minutes) * 60000 &&
      new Date(next.ends_at).getTime() +
        Math.max(buffer, a.buffer_minutes) * 60000 >
        new Date(a.starts_at).getTime(),
  );
}
export function unreadCount(s: Store, userId: string, requestId?: string) {
  if (s.unread_counts)
    return s.unread_counts
      .filter((c) => !requestId || c.request_id === requestId)
      .reduce((sum, c) => sum + Number(c.unread), 0);
  return s.messages.filter(
    (m) =>
      (!requestId || m.request_id === requestId) &&
      m.author_id !== userId &&
      m.created_at >
        (s.read_cursors.find(
          (c) => c.user_id === userId && c.request_id === m.request_id,
        )?.read_at ?? ""),
  ).length;
}
export function applyDemoAction(
  input: Store,
  userId: string,
  action: Action,
): { store: Store; id?: string } {
  const s = structuredClone(input),
    u = s.profiles.find((p) => p.id === userId);
  if (!u?.active) throw new Error("Your access is inactive. Contact Net-Tech.");
  const p = action.payload,
    now = new Date().toISOString(),
    id = action.id ?? crypto.randomUUID();
  const str = (k: string) => String(p[k] ?? "");
  const request = () => {
    const r = s.requests.find((r) => r.id === id);
    if (!r || !canRead(s, u, r))
      throw new Error("This request is not available to your account.");
    return r;
  };
  const staff = () => {
    if (!isStaff(u.role)) throw new Error("Staff access required.");
  };
  const dispatch = () => {
    if (!isDispatch(u.role)) throw new Error("Dispatcher access required.");
  };
  const event = (requestId: string, label: string) =>
    s.events.push({
      id: crypto.randomUUID(),
      request_id: requestId,
      actor_id: u.id,
      label,
      created_at: now,
    });
  if (action.type === "create_request") {
    const location = s.locations.find((l) => l.id === str("location_id"));
    if (!location) throw new Error("Select a location.");
    if (
      !isDispatch(u.role) &&
      !s.memberships.some(
        (m) =>
          m.user_id === u.id &&
          m.organization_id === location.organization_id &&
          m.active,
      )
    )
      throw new Error("Location access denied.");
    if (!str("title").trim() || !str("description").trim())
      throw new Error("Add a summary and description.");
    const existing = s.requests.find((r) => r.id === action.key);
    if (existing) return { store: s, id: existing.id };
    s.requests.unshift({
      id: action.key,
      reference: `NT-${10042 + s.requests.length}`,
      organization_id: location.organization_id,
      location_id: location.id,
      created_by: u.id,
      assignee_id: null,
      kind: (str("kind") || "support") as ServiceRequest["kind"],
      title: str("title"),
      description: str("description"),
      category: str("category"),
      impact: str("impact"),
      status: "new",
      priority: "normal",
      created_at: now,
      updated_at: now,
      resolved_at: null,
      closed_at: null,
      reopen_count: 0,
      completion_summary: null,
      intake_channel: isStaff(u.role) ? "phone" : "portal",
      preferences: (p.preferences ?? []) as string[],
      contact_name: str("contact_name") || u.name,
      contact_phone: str("contact_phone"),
      target_date: str("target_date") || null,
      budget: str("budget"),
      started_at: str("started_at"),
      linked_request_id: str("linked_request_id") || null,
    });
    event(action.key, "Request received");
    return { store: s, id: action.key };
  }
  if (action.type === "reply" || action.type === "note") {
    const r = request();
    if (!str("body").trim()) throw new Error("Write a message first.");
    if (action.type === "note") staff();
    if (r.status === "closed" || r.status === "canceled")
      throw new Error(
        "Create a follow-up request to continue this conversation.",
      );
    const list = action.type === "note" ? s.notes : s.messages;
    if (list.some((m) => m.id === action.key)) return { store: s, id };
    list.push({
      id: action.key,
      request_id: id,
      author_id: u.id,
      body: str("body"),
      created_at: now,
    });
    if (action.type === "reply" && r.status === "resolved") {
      if (
        Date.now() - new Date(r.resolved_at!).getTime() >
        s.settings.closure_days * 86400000
      )
        throw new Error(
          "The reopen window has ended. Create a follow-up request.",
        );
      r.status = "in_progress";
      r.reopen_count++;
      event(id, "Request reopened");
    }
    if (
      action.type === "reply" &&
      !isStaff(u.role) &&
      r.status === "waiting_client"
    )
      r.status = "in_progress";
    r.updated_at = now;
  } else if (action.type === "update_request") {
    staff();
    const r = request();
    if (
      p.assignee_id !== undefined ||
      p.priority !== undefined ||
      p.kind !== undefined ||
      p.target_date !== undefined
    )
      dispatch();
    if (p.status) {
      checkTransition(
        r.status,
        str("status") as RequestStatus,
        str("completion_summary"),
      );
      r.status = str("status") as RequestStatus;
      if (r.status === "resolved") {
        r.resolved_at = now;
        r.completion_summary = str("completion_summary");
        s.messages.push({
          id: crypto.randomUUID(),
          request_id: id,
          author_id: u.id,
          body: r.completion_summary,
          created_at: now,
        });
      }
      if (r.status === "closed") r.closed_at = now;
    }
    if (p.target_date !== undefined) r.target_date = str("target_date") || null;
    if (p.assignee_id !== undefined) r.assignee_id = str("assignee_id") || null;
    if (p.priority) r.priority = str("priority") as ServiceRequest["priority"];
    if (p.kind) r.kind = str("kind") as ServiceRequest["kind"];
    r.updated_at = now;
    event(id, "Request updated");
  } else if (action.type === "client_action") {
    const r = request();
    if (str("action") === "confirm" && r.status === "resolved") {
      r.status = "closed";
      r.closed_at = now;
      event(id, "Client confirmed the resolution");
    } else {
      s.messages.push({
        id: action.key,
        request_id: id,
        author_id: u.id,
        body:
          str("action") === "cancel"
            ? "Please review my request to cancel this work."
            : str("body"),
        created_at: now,
      });
      event(id, "Client requested a change");
    }
  } else if (action.type === "read") {
    request();
    s.read_cursors = s.read_cursors.filter(
      (c) => !(c.user_id === u.id && c.request_id === id),
    );
    s.read_cursors.push({ user_id: u.id, request_id: id, read_at: now });
    s.notifications
      .filter((n) => n.user_id === u.id && n.request_id === id)
      .forEach((n) => (n.read_at = now));
  } else if (action.type === "schedule") {
    dispatch();
    request();
    const existing = s.appointments.find((a) => a.id === str("appointment_id"));
    if (existing && Number(p.version) !== existing.version)
      throw new Error("This appointment changed. Refresh before editing.");
    const a: Appointment = {
      id: existing?.id ?? action.key,
      request_id: id,
      technician_id: str("technician_id"),
      starts_at: str("starts_at"),
      ends_at: str("ends_at"),
      timezone: "America/Chicago",
      status: (str("status") || "proposed") as Appointment["status"],
      purpose: str("purpose"),
      preparation: str("preparation"),
      summary: existing?.summary ?? "",
      tasks: existing?.tasks ?? [],
      change_requested: null,
      version: (existing?.version ?? 0) + 1,
      buffer_minutes: s.settings.buffer_minutes,
    };
    if (+new Date(a.ends_at) <= +new Date(a.starts_at))
      throw new Error("End time must be after start time.");
    if (
      !s.profiles.some(
        (t) => t.id === a.technician_id && t.active && isStaff(t.role),
      )
    )
      throw new Error("Select an active technician.");
    const assigned = s.profiles.find((t) => t.id === a.technician_id)!;
    if (!canRead(s, assigned, request()))
      throw new Error(
        "Assign this technician to the request or add them as a collaborator before booking.",
      );
    if (
      bookingConflicts(s.appointments, a, s.settings.buffer_minutes) &&
      !str("override_reason").trim()
    )
      throw new Error(
        "This time conflicts with a visit or its travel buffer. Choose another time or record an override reason.",
      );
    if (
      s.availability.some(
        (b) =>
          b.user_id === a.technician_id &&
          b.status === "approved" &&
          a.starts_at < b.ends_at &&
          a.ends_at > b.starts_at,
      )
    )
      throw new Error("The technician is unavailable at this time.");
    s.appointments = s.appointments.filter((v) => v.id !== a.id);
    s.appointments.push(a);
    event(
      id,
      `Visit ${a.status}${str("override_reason") ? " · Scheduling override recorded" : ""}`,
    );
  } else if (action.type === "visit") {
    const a = s.appointments.find((a) => a.id === id);
    if (!a) throw new Error("Visit not found.");
    const r = s.requests.find((r) => r.id === a.request_id)!;
    if (!canRead(s, u, r)) throw new Error("Access denied.");
    if (p.change_requested) {
      a.change_requested = str("change_requested");
      event(r.id, "Appointment change requested; booking remains active");
    } else {
      staff();
      if (!isDispatch(u.role) && a.technician_id !== u.id)
        throw new Error("Assigned technician required.");
      const allowed: Record<string, string[]> = {
        proposed: ["canceled"],
        confirmed: ["en_route", "canceled", "no_show"],
        en_route: ["on_site", "canceled"],
        on_site: ["completed", "canceled"],
      };
      if (!allowed[a.status]?.includes(str("status")))
        throw new Error("That visit transition is not allowed.");
      if (str("status") === "completed" && !str("summary").trim())
        throw new Error("Add a public work summary.");
      a.status = str("status") as Appointment["status"];
      a.summary = str("summary");
      if (p.tasks) a.tasks = p.tasks as Appointment["tasks"];
      if (a.status === "completed")
        s.messages.push({
          id: action.key,
          request_id: r.id,
          author_id: u.id,
          body: "Visit completed: " + a.summary,
          created_at: now,
        });
      event(r.id, "Visit " + a.status.replaceAll("_", " "));
    }
    a.version++;
  } else if (action.type === "work_entry") {
    staff();
    request();
    if (Number(p.minutes) <= 0 || Number(p.minutes) > 1440)
      throw new Error("Enter 1–1440 minutes.");
    const existing = s.work_entries.find((e) => e.id === str("entry_id"));
    if (
      existing &&
      (existing.request_id !== id ||
        (existing.author_id !== u.id && u.role !== "owner"))
    )
      throw new Error("You can edit only your own entries.");
    s.work_entries = s.work_entries.filter((e) => e.id !== existing?.id);
    s.work_entries.push({
      id: existing?.id ?? action.key,
      request_id: id,
      author_id: existing?.author_id ?? u.id,
      date: str("date"),
      minutes: Number(p.minutes),
      description: str("description"),
      materials: str("materials"),
    });
  } else if (action.type === "availability") {
    staff();
    if (str("ends_at") <= str("starts_at"))
      throw new Error("End time must follow start time.");
    s.availability.push({
      id: action.key,
      user_id: u.id,
      starts_at: str("starts_at"),
      ends_at: str("ends_at"),
      note: str("note"),
      status: "pending",
    });
  } else if (action.type === "review_availability") {
    dispatch();
    const a = s.availability.find((a) => a.id === id);
    if (!a) throw new Error("Period not found.");
    if (
      str("status") === "approved" &&
      s.appointments.some(
        (v) =>
          v.technician_id === a.user_id &&
          ["confirmed", "en_route", "on_site"].includes(v.status) &&
          v.starts_at < a.ends_at &&
          v.ends_at > a.starts_at,
      )
    )
      throw new Error("Reassign conflicting appointments first.");
    a.status = str("status") as typeof a.status;
  } else if (action.type === "employee") {
    if (u.role !== "owner") throw new Error("Owner access required.");
    const employee = s.profiles.find((t) => t.id === id);
    if (!employee) throw new Error("Employee not found.");
    if (employee.role === "owner")
      throw new Error(
        "Owner changes require a verified administrative process.",
      );
    if (p.active !== undefined) employee.active = Boolean(p.active);
    if (p.role && ["technician", "dispatcher"].includes(str("role")))
      employee.role = str("role") as Profile["role"];
  } else if (action.type === "staff_hours") {
    dispatch();
    const employee = s.profiles.find((t) => t.id === id);
    if (!employee) throw new Error("Employee not found.");
    employee.working_start = str("working_start");
    employee.working_end = str("working_end");
    employee.working_days = p.working_days as number[];
  } else if (action.type === "organization") {
    dispatch();
    s.organizations.push({ id: action.key, name: str("name"), tags: [] });
    s.locations.push({
      id: crypto.randomUUID(),
      organization_id: action.key,
      name: str("location_name"),
      address: str("address"),
      contact_name: str("contact_name"),
      contact_phone: str("contact_phone"),
      services: [],
    });
  } else if (action.type === "location") {
    dispatch();
    s.locations.push({
      id: action.key,
      organization_id: str("organization_id"),
      name: str("name"),
      address: str("address"),
      contact_name: str("contact_name"),
      contact_phone: str("contact_phone"),
      services: (p.services ?? []) as string[],
    });
  } else if (action.type === "edit_organization") {
    dispatch();
    const org = s.organizations.find((o) => o.id === id);
    if (!org) throw new Error("Organization unavailable.");
    org.name = str("name");
    org.tags = p.tags as string[];
  } else if (action.type === "edit_location") {
    dispatch();
    const loc = s.locations.find((l) => l.id === id);
    if (!loc) throw new Error("Location unavailable.");
    if (str("management_url") && !str("management_url").startsWith("https://"))
      throw new Error("Management links must use HTTPS.");
    Object.assign(loc, {
      name: str("name"),
      address: str("address"),
      contact_name: str("contact_name"),
      contact_phone: str("contact_phone"),
      services: p.services ?? [],
    });
    s.site_notes = (s.site_notes ?? []).filter((n) => n.location_id !== id);
    s.site_notes.push({
      location_id: id,
      summary: str("site_summary"),
      management_url: str("management_url") || null,
    });
  } else if (action.type === "membership") {
    dispatch();
    const member = s.memberships.find((m) => m.id === id);
    if (!member) throw new Error("Membership unavailable.");
    if (p.active !== undefined) member.active = Boolean(p.active);
    if (p.admin !== undefined) member.admin = Boolean(p.admin);
  } else if (action.type === "share") {
    dispatch();
    const r = request();
    const target = str("user_id");
    if (str("audience") === "collaborator") {
      if (
        !s.profiles.some(
          (t) => t.id === target && t.active && t.role === "technician",
        )
      )
        throw new Error("Active technician required.");
      s.collaborators = s.collaborators.filter(
        (c) => !(c.request_id === id && c.user_id === target),
      );
      if (!p.remove) s.collaborators.push({ request_id: id, user_id: target });
    } else {
      if (
        !s.memberships.some(
          (m) =>
            m.user_id === target &&
            m.organization_id === r.organization_id &&
            m.active,
        )
      )
        throw new Error("Active membership in the same organization required.");
      s.participants = s.participants.filter(
        (c) => !(c.request_id === id && c.user_id === target),
      );
      if (!p.remove) s.participants.push({ request_id: id, user_id: target });
    }
  } else if (action.type === "settings") {
    if (u.role !== "owner") throw new Error("Owner access required.");
    s.settings = { ...s.settings, ...p } as Store["settings"];
  } else if (action.type === "profile") {
    u.name = str("name") || u.name;
    u.phone = str("phone");
    u.email_notifications = Boolean(p.email_notifications);
  } else throw new Error("This action is not supported.");
  return { store: s, id };
}
