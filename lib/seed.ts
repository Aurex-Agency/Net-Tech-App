import { categories, type Store, type ServiceRequest } from "./types";
export const DEMO_IDS = {
  client: "00000000-0000-4000-8000-000000000001",
  technician: "00000000-0000-4000-8000-000000000002",
  owner: "00000000-0000-4000-8000-000000000003",
  other: "00000000-0000-4000-8000-000000000004",
};
const orgA = "10000000-0000-4000-8000-000000000001",
  orgB = "10000000-0000-4000-8000-000000000002";
const locA = "20000000-0000-4000-8000-000000000001",
  locB = "20000000-0000-4000-8000-000000000002",
  locC = "20000000-0000-4000-8000-000000000003";
export function seedStore(): Store {
  const now = new Date();
  const ago = (hours: number) =>
    new Date(now.getTime() - hours * 3600000).toISOString();
  const visitStart = new Date(now);
  visitStart.setDate(visitStart.getDate() + 1);
  visitStart.setUTCHours(15, 0, 0, 0);
  const specs: [
    string,
    string,
    ServiceRequest["status"],
    ServiceRequest["category"],
    ServiceRequest["priority"],
    number,
  ][] = [
    [
      "Office Wi-Fi drops in the west wing",
      "Internet / Wi-Fi",
      "waiting_client",
      "Internet / Wi-Fi",
      "high",
      24,
    ],
    [
      "New cameras for the loading dock",
      "Security cameras",
      "triaged",
      "Security cameras",
      "normal",
      48,
    ],
    [
      "Set up email on a new laptop",
      "Email / Cloud services",
      "in_progress",
      "Email / Cloud services",
      "normal",
      6,
    ],
    [
      "Front desk printer is offline",
      "Computers / IT support",
      "new",
      "Computers / IT support",
      "normal",
      2,
    ],
    [
      "Network upgrade for the new office",
      "Network equipment",
      "new",
      "Network equipment",
      "normal",
      3,
    ],
    [
      "Guest network password update",
      "Internet / Wi-Fi",
      "resolved",
      "Internet / Wi-Fi",
      "low",
      96,
    ],
    [
      "Point-of-sale connection is down",
      "Network equipment",
      "new",
      "Network equipment",
      "urgent",
      1,
    ],
    [
      "Cloud backup review",
      "Email / Cloud services",
      "waiting_vendor",
      "Email / Cloud services",
      "normal",
      72,
    ],
  ];
  const requests: ServiceRequest[] = specs.map(
    ([title, , status, category, priority, h], i) => ({
      id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      reference: `NT-${10042 + i}`,
      organization_id: i === 4 || i === 6 ? orgB : orgA,
      location_id: i === 4 || i === 6 ? locC : i === 1 ? locB : locA,
      created_by: i === 4 || i === 6 ? DEMO_IDS.other : DEMO_IDS.client,
      assignee_id: i === 3 || i === 4 || i === 6 ? null : DEMO_IDS.technician,
      kind: i === 1 || i === 4 ? "estimate" : "support",
      title,
      description:
        i === 0
          ? "Our team is losing Wi-Fi connectivity in the west wing, especially near the conference room. It started yesterday afternoon. The main office seems to be working normally."
          : "Please help us with " +
            title.toLowerCase() +
            ". The site contact will be available during business hours.",
      category,
      impact:
        i === 6
          ? "Business / site unable to operate"
          : "Several people affected",
      status,
      priority,
      created_at: ago(h),
      updated_at: ago(Math.max(h - 2, 0.5)),
      resolved_at: status === "resolved" ? ago(12) : null,
      closed_at: null,
      reopen_count: 0,
      completion_summary:
        status === "resolved"
          ? "Updated guest network access and verified connectivity with the site contact."
          : null,
      intake_channel: "portal",
      preferences:
        i === 1 ? ["Next Tuesday, morning", "Next Wednesday, afternoon"] : [],
      contact_name: "Jamie Parker",
      contact_phone: "",
      target_date: null,
      budget: "",
      started_at: "Yesterday afternoon",
      linked_request_id: null,
    }),
  );
  return {
    profiles: [
      {
        id: DEMO_IDS.client,
        name: "Jamie Parker",
        email: "jamie@example.test",
        phone: "",
        role: "client_admin",
        active: true,
        email_notifications: true,
      },
      {
        id: DEMO_IDS.technician,
        name: "Alex Morgan",
        email: "alex@example.test",
        phone: "",
        role: "technician",
        active: true,
        email_notifications: true,
      },
      {
        id: DEMO_IDS.owner,
        name: "Taylor Brooks",
        email: "taylor@example.test",
        phone: "",
        role: "owner",
        active: true,
        email_notifications: true,
      },
      {
        id: DEMO_IDS.other,
        name: "Sam Ellis",
        email: "sam@example.test",
        phone: "",
        role: "client",
        active: true,
        email_notifications: true,
      },
      {
        id: "00000000-0000-4000-8000-000000000005",
        name: "Jordan Lee",
        email: "jordan@example.test",
        phone: "",
        role: "technician",
        active: true,
        email_notifications: true,
      },
    ],
    organizations: [
      {
        id: orgA,
        name: "Oak & Main Dental",
        tags: ["Managed IT", "Networking"],
      },
      {
        id: orgB,
        name: "Union County Supply",
        tags: ["Networking", "Security"],
      },
    ],
    memberships: [
      {
        id: "m1",
        user_id: DEMO_IDS.client,
        organization_id: orgA,
        admin: true,
        active: true,
      },
      {
        id: "m2",
        user_id: DEMO_IDS.other,
        organization_id: orgB,
        admin: false,
        active: true,
      },
    ],
    locations: [
      {
        id: locA,
        organization_id: orgA,
        name: "Main office",
        address: "100 Example Lane, New Albany, MS 38652",
        contact_name: "Jamie Parker",
        contact_phone: "",
        services: ["Managed IT", "Wi-Fi", "Cloud backup"],
      },
      {
        id: locB,
        organization_id: orgA,
        name: "North location",
        address: "200 Sample Drive, New Albany, MS 38652",
        contact_name: "Jamie Parker",
        contact_phone: "",
        services: ["Security cameras"],
      },
      {
        id: locC,
        organization_id: orgB,
        name: "Warehouse",
        address: "300 Demo Road, New Albany, MS 38652",
        contact_name: "Sam Ellis",
        contact_phone: "",
        services: ["Networking"],
      },
    ],
    requests,
    messages: [
      {
        id: "msg1",
        request_id: requests[0].id,
        author_id: DEMO_IDS.client,
        body: requests[0].description,
        created_at: ago(24),
      },
      {
        id: "msg2",
        request_id: requests[0].id,
        author_id: DEMO_IDS.technician,
        body: "Hi Jamie, thanks for the details. Does this happen on all devices in the west wing, or just laptops? A photo of the access point lights would also help us narrow it down.",
        created_at: ago(22),
      },
      {
        id: "msg3",
        request_id: requests[2].id,
        author_id: DEMO_IDS.technician,
        body: "I have your request and will help get the new laptop connected. Is tomorrow morning a good time to reach you?",
        created_at: ago(4),
      },
    ],
    notes: [
      {
        id: "note1",
        request_id: requests[0].id,
        author_id: DEMO_IDS.technician,
        body: "Check switch PoE budget during the site visit. Bring a spare access point.",
        created_at: ago(21),
      },
    ],
    appointments: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        request_id: requests[0].id,
        technician_id: DEMO_IDS.technician,
        starts_at: visitStart.toISOString(),
        ends_at: new Date(+visitStart + 3600000).toISOString(),
        timezone: "America/Chicago",
        status: "confirmed",
        purpose: "Wi-Fi troubleshooting",
        preparation: "Please make sure we can access the network closet.",
        summary: "",
        tasks: [
          { label: "Check access point and cabling", done: false },
          { label: "Test connectivity with site contact", done: false },
        ],
        change_requested: null,
        version: 1,
        buffer_minutes: 15,
      },
    ],
    work_entries: [],
    availability: [],
    attachments: [],
    events: requests.map((r) => ({
      id: "event-" + r.id,
      request_id: r.id,
      actor_id: r.created_by,
      label: "Request received",
      created_at: r.created_at,
    })),
    notifications: [
      {
        id: "n1",
        user_id: DEMO_IDS.client,
        request_id: requests[0].id,
        title: "Alex replied to your request",
        created_at: ago(22),
        read_at: null,
      },
    ],
    participants: [],
    collaborators: [],
    read_cursors: [],
    settings: {
      company_name: "Net-Tech Connect",
      support_phone: "+1-662-539-7787",
      support_email: "",
      categories,
      duration_minutes: 60,
      buffer_minutes: 15,
      closure_days: 7,
      auto_close: false,
      working_start: "08:00",
      working_end: "17:00",
      service_area: "North Mississippi",
      require_staff_mfa: false,
    },
  };
}
