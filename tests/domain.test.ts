import { describe, it, expect } from "vitest";
import { seedStore, DEMO_IDS } from "../lib/seed";
import {
  applyDemoAction,
  scopeStore,
  canRead,
  bookingConflicts,
  unreadCount,
} from "../lib/domain";
import { csvCell, localToUtc, calendarFile } from "../lib/format";
import { detectFile, safeFilename } from "../lib/uploads";
describe("request access and audiences", () => {
  it("never serializes internal notes or other organizations for a client", () => {
    const s = seedStore(),
      u = s.profiles[0];
    const scoped = scopeStore(s, u);
    expect(scoped.notes).toEqual([]);
    expect(
      scoped.requests.every((r) => r.organization_id === s.organizations[0].id),
    ).toBe(true);
    expect(JSON.stringify(scoped)).not.toContain("PoE budget");
  });
  it("rejects technician access after assignment removal and deactivation", () => {
    const s = seedStore(),
      u = s.profiles[1],
      r = s.requests[0];
    expect(canRead(s, u, r)).toBe(true);
    r.assignee_id = null;
    expect(canRead(s, u, r)).toBe(false);
    r.assignee_id = u.id;
    u.active = false;
    expect(canRead(s, u, r)).toBe(false);
  });
  it("requires active membership even for a request author", () => {
    const s = seedStore();
    s.memberships[0].active = false;
    expect(canRead(s, s.profiles[0], s.requests[0])).toBe(false);
  });
  it("prevents a client from assigning or changing priority", () => {
    const s = seedStore();
    expect(() =>
      applyDemoAction(s, DEMO_IDS.client, {
        type: "update_request",
        id: s.requests[0].id,
        key: crypto.randomUUID(),
        payload: { priority: "urgent" },
      }),
    ).toThrow();
  });
});
describe("canonical conversations", () => {
  it("deduplicates a retried reply", () => {
    const s = seedStore(),
      id = s.requests[0].id,
      key = crypto.randomUUID();
    const action = {
      type: "reply",
      id,
      key,
      payload: { body: "All laptops are affected." },
    };
    const once = applyDemoAction(s, DEMO_IDS.client, action).store;
    const twice = applyDemoAction(once, DEMO_IDS.client, action).store;
    expect(twice.messages.filter((m) => m.id === key)).toHaveLength(1);
    expect(twice.requests[0].status).toBe("in_progress");
  });
  it("reconciles unread counts when a conversation is opened", () => {
    const s = seedStore(),
      id = s.requests[0].id;
    expect(unreadCount(s, DEMO_IDS.client, id)).toBe(1);
    const { store } = applyDemoAction(s, DEMO_IDS.client, {
      type: "read",
      id,
      key: crypto.randomUUID(),
      payload: {},
    });
    expect(unreadCount(store, DEMO_IDS.client, id)).toBe(0);
  });
  it("requires a public completion summary", () => {
    const s = seedStore();
    expect(() =>
      applyDemoAction(s, DEMO_IDS.technician, {
        type: "update_request",
        id: s.requests[0].id,
        key: crypto.randomUUID(),
        payload: { status: "resolved" },
      }),
    ).toThrow("summary");
  });
  it("preserves the booking while a client requests cancellation", () => {
    const s = seedStore(),
      a = s.appointments[0];
    const { store } = applyDemoAction(s, DEMO_IDS.client, {
      type: "visit",
      id: a.id,
      key: crypto.randomUUID(),
      payload: { change_requested: "Please cancel this appointment." },
    });
    expect(store.appointments[0].status).toBe("confirmed");
    expect(store.appointments[0].change_requested).toContain("cancel");
  });
});
describe("scheduling and safe output", () => {
  it("includes travel buffers and does not reserve proposals", () => {
    const s = seedStore(),
      a = s.appointments[0];
    const b = {
      ...a,
      id: "other",
      starts_at: a.ends_at,
      ends_at: new Date(+new Date(a.ends_at) + 3600000).toISOString(),
    };
    expect(bookingConflicts([a], b, 15)).toBe(true);
    expect(bookingConflicts([a], { ...b, status: "proposed" }, 15)).toBe(false);
  });
  it("uses the correct Central offsets in summer and winter", () => {
    expect(localToUtc("2026-07-10T09:00")).toBe("2026-07-10T14:00:00.000Z");
    expect(localToUtc("2026-12-10T09:00")).toBe("2026-12-10T15:00:00.000Z");
  });
  it.each(["=1+2", "+CMD", "-2+3", "@SUM(A1)", "\t=1", "  =1"])(
    "escapes spreadsheet formulas: %s",
    (input) => {
      expect(csvCell(input)).toMatch(/^"'/);
    },
  );
  it("escapes quotes and calendar newlines", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(
      calendarFile(
        { ...seedStore().appointments[0], purpose: "Test\nBEGIN:VEVENT" },
        "a;b",
      ),
    ).toContain("SUMMARY:Test\\nBEGIN:VEVENT");
  });
  it("validates file signatures rather than trusting extensions", () => {
    expect(() =>
      detectFile(new TextEncoder().encode("<script>alert(1)</script>")),
    ).toThrow();
    expect(detectFile(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      "image/png",
    );
    expect(() =>
      detectFile(new TextEncoder().encode("%PDF-1.4 /JavaScript evil %%EOF")),
    ).toThrow("Interactive");
    expect(() =>
      detectFile(new TextEncoder().encode("%PDF-1.7 /J#53 evil %%EOF")),
    ).toThrow("Interactive");
    expect(() =>
      detectFile(new TextEncoder().encode("%PDF-1.7 /ObjStm 1 %%EOF")),
    ).toThrow("Interactive");
    expect(
      detectFile(
        new TextEncoder().encode(
          "%PDF-1.4 1 0 obj << /Type /Catalog >> endobj %%EOF",
        ),
      ),
    ).toBe("application/pdf");
    expect(safeFilename("../evil<script>.pdf")).not.toContain("<");
  });
});

describe("technician onboarding and business routing", () => {
  it("adds a demo technician with a business without transferring existing work", () => {
    const original = seedStore(),
      key = crypto.randomUUID();
    const action = {
      type: "add_technician",
      key,
      payload: {
        name: "Morgan Davis",
        email: "morgan@example.test",
        business_ids: [original.organizations[0].id],
      },
    };
    const { store } = applyDemoAction(original, DEMO_IDS.owner, action);
    const tech = store.profiles.find((p) => p.id === key)!;
    expect(tech.role).toBe("technician");
    expect(store.requests).toEqual(original.requests);
    expect(canRead(store, tech, original.requests[0])).toBe(false);
    expect(
      applyDemoAction(store, DEMO_IDS.owner, action).store.profiles.filter(
        (p) => p.id === key,
      ),
    ).toHaveLength(1);
    const created = applyDemoAction(store, DEMO_IDS.client, {
      type: "create_request",
      key: crypto.randomUUID(),
      payload: {
        location_id: original.locations[0].id,
        title: "New network problem",
        description: "Please review the guest network connection.",
      },
    });
    expect(created.store.requests[0].assignee_id).toBe(key);
    expect(canRead(created.store, tech, created.store.requests[0])).toBe(true);
    expect(scopeStore(created.store, tech).requests).toHaveLength(1);
    expect(
      scopeStore(created.store, original.profiles[0]).business_technicians,
    ).toEqual([]);
  });
  it("limits business connections to dispatch and adding technicians to the owner", () => {
    const s = seedStore();
    for (const actor of [DEMO_IDS.client, DEMO_IDS.technician]) {
      expect(() =>
        applyDemoAction(s, actor, {
          type: "connect_businesses",
          id: DEMO_IDS.technician,
          key: crypto.randomUUID(),
          payload: { business_ids: [s.organizations[0].id] },
        }),
      ).toThrow();
      expect(() =>
        applyDemoAction(s, actor, {
          type: "add_technician",
          key: crypto.randomUUID(),
          payload: { name: "Morgan", email: "morgan@example.test" },
        }),
      ).toThrow();
    }
    expect(() =>
      applyDemoAction(s, DEMO_IDS.owner, {
        type: "add_technician",
        key: crypto.randomUUID(),
        payload: { name: "Duplicate", email: "ALEX@example.test" },
      }),
    ).toThrow(/already/);
  });
  it("routes to one default, preserves history, and stops routing to inactive staff", () => {
    const initial = seedStore(),
      business = initial.organizations[0].id,
      jordan = initial.profiles[4].id;
    let s = applyDemoAction(initial, DEMO_IDS.owner, {
      type: "connect_businesses",
      id: DEMO_IDS.technician,
      key: crypto.randomUUID(),
      payload: { business_ids: [business] },
    }).store;
    s = applyDemoAction(s, DEMO_IDS.owner, {
      type: "connect_businesses",
      id: jordan,
      key: crypto.randomUUID(),
      payload: { business_ids: [business] },
    }).store;
    expect(s.business_technicians).toHaveLength(1);
    expect(s.business_technicians![0].technician_id).toBe(jordan);
    expect(s.requests).toEqual(initial.requests);
    s = applyDemoAction(s, DEMO_IDS.owner, {
      type: "employee",
      id: jordan,
      key: crypto.randomUUID(),
      payload: { active: false },
    }).store;
    s = applyDemoAction(s, DEMO_IDS.client, {
      type: "create_request",
      key: crypto.randomUUID(),
      payload: {
        location_id: initial.locations[0].id,
        title: "A new support request",
        description:
          "A support request after the default technician is deactivated.",
      },
    }).store;
    expect(s.requests[0].assignee_id).toBeNull();
    expect(() =>
      applyDemoAction(s, DEMO_IDS.owner, {
        type: "connect_businesses",
        id: jordan,
        key: crypto.randomUUID(),
        payload: { business_ids: [initial.organizations[1].id] },
      }),
    ).toThrow(/active/);
    expect(
      applyDemoAction(s, DEMO_IDS.owner, {
        type: "connect_businesses",
        id: jordan,
        key: crypto.randomUUID(),
        payload: { business_ids: [] },
      }).store.business_technicians,
    ).toEqual([]);
  });
});
