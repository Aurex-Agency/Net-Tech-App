export type Role =
  "client" | "client_admin" | "technician" | "dispatcher" | "owner";
export type RequestStatus =
  | "new"
  | "triaged"
  | "in_progress"
  | "waiting_client"
  | "waiting_vendor"
  | "resolved"
  | "closed"
  | "canceled";
export type VisitStatus =
  | "proposed"
  | "confirmed"
  | "en_route"
  | "on_site"
  | "completed"
  | "canceled"
  | "no_show";
export type Profile = {
  working_start?: string;
  working_end?: string;
  working_days?: number[];
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  role: Role;
  email_notifications: boolean;
};
export type BusinessTechnician = {
  organization_id: string;
  technician_id: string;
  updated_at?: string;
};
export type PendingTechnician = {
  id: string;
  name: string;
  email: string;
  phone: string;
  business_ids: string[];
  expires_at: string;
};
export type Organization = { id: string; name: string; tags: string[] };
export type Location = {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  services: string[];
};
export type Membership = {
  id: string;
  user_id: string;
  organization_id: string;
  admin: boolean;
  active: boolean;
};
export type ServiceRequest = {
  id: string;
  reference: string;
  organization_id: string;
  location_id: string;
  created_by: string;
  assignee_id: string | null;
  kind: "support" | "estimate" | "general";
  title: string;
  description: string;
  category: string;
  impact: string;
  status: RequestStatus;
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  reopen_count: number;
  completion_summary: string | null;
  intake_channel: string;
  preferences: string[];
  contact_name: string;
  contact_phone: string;
  target_date: string | null;
  budget: string;
  started_at: string;
  linked_request_id: string | null;
};
export type Message = {
  id: string;
  request_id: string;
  author_id: string;
  body: string;
  created_at: string;
};
export type Note = Message;
export type Appointment = {
  id: string;
  request_id: string;
  technician_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: VisitStatus;
  purpose: string;
  preparation: string;
  summary: string;
  tasks: { label: string; done: boolean }[];
  change_requested: string | null;
  version: number;
  buffer_minutes: number;
};
export type WorkEntry = {
  id: string;
  request_id: string;
  author_id: string;
  date: string;
  minutes: number;
  description: string;
  materials: string;
};
export type Availability = {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  note: string;
  status: "pending" | "approved" | "declined";
};
export type Attachment = {
  id: string;
  request_id: string;
  note_id: string | null;
  name: string;
  object_key: string;
  mime: string;
  size: number;
  uploaded_by: string;
  created_at: string;
};
export type RequestEvent = {
  id: string;
  request_id: string;
  actor_id: string;
  label: string;
  created_at: string;
};
export type Notification = {
  id: string;
  user_id: string;
  request_id: string;
  title: string;
  created_at: string;
  read_at: string | null;
};
export type Settings = {
  company_name: string;
  support_phone: string;
  support_email: string;
  categories: string[];
  duration_minutes: number;
  buffer_minutes: number;
  closure_days: number;
  auto_close: boolean;
  working_start: string;
  working_end: string;
  service_area: string;
  require_staff_mfa: boolean;
};
export type Store = {
  summary?: {
    open: number;
    unassigned: number;
    high: number;
    waiting: number;
    resolved: number;
    visits: number;
  };
  site_notes?: {
    location_id: string;
    summary: string;
    management_url: string | null;
  }[];
  unread_counts?: { request_id: string; unread: number }[];
  profiles: Profile[];
  business_technicians?: BusinessTechnician[];
  pending_technicians?: PendingTechnician[];
  organizations: Organization[];
  memberships: Membership[];
  locations: Location[];
  requests: ServiceRequest[];
  messages: Message[];
  notes: Note[];
  appointments: Appointment[];
  work_entries: WorkEntry[];
  availability: Availability[];
  attachments: Attachment[];
  events: RequestEvent[];
  notifications: Notification[];
  participants: { request_id: string; user_id: string }[];
  collaborators: { request_id: string; user_id: string }[];
  read_cursors: { request_id: string; user_id: string; read_at: string }[];
  settings: Settings;
};
export type Action = {
  type: string;
  id?: string;
  key: string;
  payload: Record<string, unknown>;
};
export const roleLabel: Record<Role, string> = {
  client: "Client",
  client_admin: "Client administrator",
  technician: "Technician",
  dispatcher: "Dispatcher",
  owner: "Owner",
};
export const statusLabel: Record<RequestStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  waiting_client: "Waiting on you",
  waiting_vendor: "Waiting on parts",
  resolved: "Resolved",
  closed: "Closed",
  canceled: "Canceled",
};
export const visitLabel: Record<VisitStatus, string> = {
  proposed: "Proposed",
  confirmed: "Confirmed",
  en_route: "En route",
  on_site: "On site",
  completed: "Completed",
  canceled: "Canceled",
  no_show: "No show",
};
export const categories = [
  "Internet / Wi-Fi",
  "Network equipment",
  "Computers / IT support",
  "Email / Cloud services",
  "Security cameras",
  "Other / Not sure",
];
export const isStaff = (role: Role) =>
  ["owner", "dispatcher", "technician"].includes(role);
export const isDispatch = (role: Role) =>
  ["owner", "dispatcher"].includes(role);
