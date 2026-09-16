import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByText("Internal synthetic diagnostic details.", { exact: true }),
  ).toBeVisible();
  await page.goto("/demo/client/requests/" + requestId);
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
});
