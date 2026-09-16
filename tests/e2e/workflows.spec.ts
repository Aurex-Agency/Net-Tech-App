import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedStore } from "../../lib/seed";
const requestId = "30000000-0000-4000-8000-000000000001";
test("client creates one persisted support request and follows the canonical conversation", async ({
  page,
}) => {
  await page.goto("/demo/client");
  await expect(
    page.getByRole("heading", { name: "Good to see you, Jamie." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get support", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Location", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("A short summary")
    .fill("Front office network disconnects");
  await page
    .getByLabel("Tell us what’s happening")
    .fill(
      "The front office network disconnects on all laptops every few minutes.",
    );
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(
    page.getByRole("heading", { name: "We have your request." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View request" }).click();
  await expect(
    page.getByRole("heading", { name: "Front office network disconnects" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Front office network disconnects" }),
  ).toBeVisible();
  await page
    .getByLabel("Reply to the conversation")
    .fill("This began at 10 AM today.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.getByText("This began at 10 AM today.", { exact: true }),
  ).toHaveCount(1);
  await page.goto("/demo/client/messages");
  await expect(
    page.getByText("This began at 10 AM today.", { exact: true }),
  ).toBeVisible();
});
test("staff internal notes stay out of the client UI and unauthorized IDs fail closed", async ({
  page,
}) => {
  await page.goto("/demo/technician/requests/" + requestId);
  await page.getByRole("button", { name: "Internal", exact: true }).click();
  await page
    .getByLabel("Staff only — never sent to the client")
    .fill("Internal synthetic diagnostic details.");
  // Switching audiences must not move an internal draft into the public reply.
  await page.getByRole("button", { name: "Client reply", exact: true }).click();
  await expect(page.getByLabel("Reply to the client")).toHaveValue("");
  await page.getByLabel("Reply to the client").fill("Public update draft.");
  await page.getByRole("button", { name: "Internal", exact: true }).click();
  await expect(
    page.getByLabel("Staff only — never sent to the client"),
  ).toHaveValue("Internal synthetic diagnostic details.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByText("Internal synthetic diagnostic details.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Client reply", exact: true }).click();
  await expect(page.getByLabel("Reply to the client")).toHaveValue(
    "Public update draft.",
  );
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByLabel("Reply to the client")).toHaveValue("");
  await page.goto("/demo/client/requests/" + requestId);
  await expect(
    page.getByText("Public update draft.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Internal synthetic diagnostic details.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Internal", exact: true }),
  ).toHaveCount(0);
  await page.goto("/demo/client/requests/30000000-0000-4000-8000-000000000005");
  await expect(
    page.getByRole("heading", { name: "Request unavailable" }),
  ).toBeVisible();
  await page.goto("/demo/technician/requests/new");
  await expect(
    page.getByRole("heading", {
      name: "Request intake is handled by dispatch",
    }),
  ).toBeVisible();
});
test("appointment changes preserve the confirmed visit and field completion remains independent", async ({
  page,
}) => {
  await page.goto("/demo/client/calendar");
  await page.getByRole("button", { name: "Request a change" }).click();
  await page
    .getByLabel("What would you like to change?")
    .fill("Can we move the visit to the following morning?");
  await page.getByRole("button", { name: "Send change request" }).click();
  await expect(
    page.getByText("Current booking remains active.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".visit-card .badge")).toHaveText("Confirmed");
  await page.goto("/demo/technician/calendar");
  for (const status of ["en_route", "on_site", "completed"]) {
    await page.getByRole("button", { name: "Update visit" }).click();
    await page
      .getByRole("combobox", { name: "Next status" })
      .selectOption(status);
    if (status === "completed")
      await page
        .getByLabel("Public work summary")
        .fill(
          "Tested network and restored connectivity. Monitoring is still needed.",
        );
    await page.getByRole("button", { name: "Save update" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.goto("/demo/technician/requests/" + requestId);
  await expect(
    page.getByText(
      "Visit completed: Tested network and restored connectivity. Monitoring is still needed.",
    ),
  ).toBeVisible();
  await expect(page.locator(".heading-actions .badge")).not.toHaveText(
    "Resolved",
  );
});
test("owner detects booking conflicts and can deactivate staff while retaining assignments", async ({
  page,
}) => {
  await page.goto("/demo/owner/calendar");
  for (let n = 0; n < 2; n++) {
    await page.getByRole("button", { name: "Schedule a visit" }).click();
    await page
      .getByRole("combobox", { name: "Request", exact: true })
      .selectOption({ index: 1 });
    await page
      .getByRole("combobox", { name: "Technician", exact: true })
      .selectOption({ index: 1 });
    await page
      .getByLabel("Purpose", { exact: true })
      .fill("Synthetic office visit");
    await page.getByLabel("Start (Central time)").fill("2026-10-06T10:00");
    await page.getByLabel("End (Central time)").fill("2026-10-06T11:00");
    await page
      .getByRole("combobox", { name: "Status", exact: true })
      .selectOption("confirmed");
    await page.getByRole("button", { name: "Save appointment" }).click();
    if (n === 0) await expect(page.getByRole("dialog")).toHaveCount(0);
    else
      await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
        "conflicts",
      );
  }
  await page.keyboard.press("Escape");
  await page.goto("/demo/owner/team");
  await page.getByRole("button", { name: "Deactivate access" }).first().click();
  await page.getByRole("button", { name: "Confirm access change" }).click();
  await expect(page.getByText("requests need reassignment.")).toBeVisible();
});
test("representative screens meet automated accessibility and fit the viewport", async ({
  page,
}, testInfo) => {
  for (const path of [
    "/demo/client",
    "/demo/technician",
    "/demo/owner",
    "/demo/client/requests/" + requestId,
    "/sign-in",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const violations = (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations;
    expect(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${path.replaceAll("/", "-")}.png`,
      fullPage: true,
    });
  }
});
test("keyboard dialog dismissal, offline recovery and protected endpoints", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/demo/client/calendar");
  await page.getByRole("button", { name: "Request a change" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Request a change" }),
  ).toBeFocused();
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("offline");
  await context.setOffline(false);
  await expect(page.getByText("You’re offline.", { exact: false })).toHaveCount(
    0,
  );
  expect((await request.get("/api/jobs")).status()).toBe(401);
  expect((await request.get("/api/workspace")).status()).toBe(401);
  await page.goto("/estimate");
  await expect(
    page.getByRole("button", { name: "Request a visit" }),
  ).toBeDisabled();
});

test("owner maintains site context, shares work, and changes employee roles", async ({
  page,
}) => {
  await page.goto("/demo/owner/clients");
  await page
    .getByRole("button", { name: "Edit location & site context" })
    .first()
    .click();
  await page
    .getByLabel("Internal site summary")
    .fill("Synthetic staff-only switch cabinet details.");
  await page.getByRole("button", { name: "Save location" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Synthetic staff-only switch cabinet details.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/demo/client/organization");
  await expect(
    page.getByText("Synthetic staff-only switch cabinet details.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/demo/owner/requests/" + requestId);
  await page.getByRole("button", { name: "Manage sharing" }).click();
  await page.getByRole("checkbox", { name: "Jordan Lee" }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Manage sharing" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Jordan Lee" }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await page.goto("/demo/owner/team");
  await page
    .getByRole("button", { name: "Change employee role" })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Employee role" })
    .selectOption("dispatcher");
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .locator(".team-card")
      .filter({ hasText: "Alex Morgan" })
      .getByText("Dispatcher", { exact: true }),
  ).toBeVisible();
  await page.goto("/demo/technician");
  await expect(page.locator(".workspace-label small")).toHaveText(
    "Dispatcher workspace",
  );
  await expect(
    page.getByRole("heading", { name: "Next scheduled visit" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your next stop" }),
  ).toHaveCount(0);
  await page.goto("/demo/technician/requests/" + requestId);
  await expect(page.getByLabel("Reply to the client")).toBeVisible();
  await page.goto("/demo/technician/requests/new");
  await expect(
    page.getByRole("heading", { name: "Record a support request" }),
  ).toBeVisible();
  await expect(page.getByLabel("Client contact name")).toHaveValue("");
  await page.goto("/demo/technician/settings");
  await expect(
    page.getByRole("heading", {
      name: "This area isn’t available to your role",
    }),
  ).toBeVisible();
});

test("request conversations identify the recipient for clients, technicians, and owners", async ({
  page,
}) => {
  const emptyRequest = "30000000-0000-4000-8000-000000000006";
  for (const role of ["client", "technician", "owner"]) {
    await page.goto(`/demo/${role}/requests/${emptyRequest}`);
    await expect(
      page.getByRole("heading", { name: "Start the conversation" }),
    ).toBeVisible();
    if (role === "client") {
      await expect(
        page.getByText("Send a message to the Net-Tech team.", { exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Reply to the conversation")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Internal", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Yes, it’s fixed" }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText("Send a message to the Net-Tech team.", { exact: true }),
      ).toHaveCount(0);
      await expect(page.getByLabel("Reply to the client")).toBeVisible();
      await expect(
        page.getByText("Public reply · visible to the client", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Your technician", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Yes, it’s fixed" }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Internal", exact: true }).click();
      await expect(
        page.getByLabel("Staff only — never sent to the client"),
      ).toBeVisible();
      await expect(
        page.getByText("Public reply · visible to the client", { exact: true }),
      ).toHaveCount(0);
    }
  }
  await page.goto(`/demo/technician/requests/${emptyRequest}`);
  await page
    .getByLabel("Reply to the client")
    .fill("Please confirm the guest network is working.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.getByText("Please confirm the guest network is working.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`/demo/client/requests/${emptyRequest}`);
  await expect(
    page.getByText("Please confirm the guest network is working.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("technician navigation and direct routes match their role", async ({
  page,
}) => {
  await page.goto("/demo/technician/messages");
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".support-box a")).toHaveAttribute(
    "href",
    "/demo/technician/messages",
  );
  await expect(
    page.getByRole("link", { name: "New conversation" }),
  ).toHaveCount(0);
  await page.goto("/demo/technician/requests");
  await expect(
    page.getByRole("heading", { name: "My work", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Assigned & shared" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Unassigned", exact: true }),
  ).toHaveCount(0);
  for (const route of [
    "clients",
    "organization",
    "team",
    "reports",
    "settings",
  ]) {
    await page.goto(`/demo/technician/${route}`);
    await expect(
      page.getByRole("heading", {
        name: "This area isn’t available to your role",
      }),
    ).toBeVisible();
  }
  await page.goto("/demo/client/clients");
  await expect(
    page.getByRole("heading", {
      name: "This area isn’t available to your role",
    }),
  ).toBeVisible();
});

test("staff intake records the client's contact instead of the operator's identity", async ({
  page,
}) => {
  await page.goto("/demo/owner/requests/new?kind=general");
  await expect(
    page.getByRole("heading", { name: "Record a client question" }),
  ).toBeVisible();
  await expect(page.getByLabel("Client contact name")).toHaveValue("");
  await expect(page.getByLabel("Client contact phone")).toHaveValue("");
  await page
    .getByRole("combobox", { name: "Location", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("A short summary")
    .fill("Client asks about guest access");
  await page
    .getByLabel("Tell us what’s happening")
    .fill("Client called to ask how guest network access is managed.");
  await page.getByLabel("Client contact name").fill("Jamie Parker");
  await page.getByLabel("Client contact phone").fill("555-0100");
  await page
    .getByRole("button", { name: "Create request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request recorded." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View request", exact: true }).click();
  await expect(page.locator(".metadata")).toContainText("Jamie Parker");
  await expect(page.locator(".metadata")).toContainText("555-0100");
  await expect(page.getByLabel("Reply to the client")).toBeVisible();
  await page.goto("/demo/owner/team");
  await page
    .locator(".team-card")
    .filter({ hasText: "Alex Morgan" })
    .getByRole("link", { name: "Review assigned requests" })
    .click();
  await expect(page).toHaveURL(/tech=00000000-0000-4000-8000-000000000002/);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Technician", exact: true }),
  ).toHaveValue("00000000-0000-4000-8000-000000000002");
});

test("shared work does not imply ownership of another technician's visit", async ({
  page,
}) => {
  const fixture = seedStore();
  const colleague = fixture.profiles.find((p) => p.name === "Jordan Lee")!;
  fixture.appointments[0].technician_id = colleague.id;
  fixture.collaborators.push({
    request_id: fixture.requests[0].id,
    user_id: colleague.id,
  });
  await page.addInitScript((state) => {
    if (!localStorage.getItem("net-tech-synthetic-demo-v1"))
      localStorage.setItem("net-tech-synthetic-demo-v1", JSON.stringify(state));
  }, fixture);
  await page.goto("/demo/technician/calendar");
  await expect(page.locator(".visit-card")).toContainText("Jordan Lee");
  await expect(
    page.getByRole("button", { name: "Update visit", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit booking", exact: true }),
  ).toHaveCount(0);
  await page.goto("/demo/technician");
  await expect(page.locator(".appointment-card")).toContainText(
    "No upcoming visits",
  );
  await expect(page.locator(".appointment-card")).not.toContainText(
    "Jordan Lee",
  );
  await page.goto("/demo/owner/calendar");
  await expect(
    page.getByRole("button", { name: "Update visit", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit booking", exact: true }),
  ).toBeVisible();
  await page.goto("/demo/owner");
  await expect(
    page.getByRole("heading", { name: "Next scheduled visit" }),
  ).toBeVisible();
  await expect(page.locator(".appointment-card")).toContainText("Jordan Lee");
  await page.goto("/demo/client/calendar");
  await expect(
    page.getByRole("button", { name: "Request a change", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update visit", exact: true }),
  ).toHaveCount(0);
});
