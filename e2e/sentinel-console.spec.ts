import { expect, test } from "@playwright/test";

/**
 * The demo path a reviewer will follow:
 * dashboard -> new run from a ticket -> live self-healing -> approve the repair.
 */
test.describe("Agentic-mesh console", () => {
  test("runs a ticket, shows the healing banner and records a repair review", async ({ page }) => {
    await page.goto("/");

    // Dashboard is reachable and reports the mock-mode badge from /api/health.
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Tests that repair themselves when the UI moves.")).toBeVisible();
    await expect(page.getByText("Mock mode — no keys required")).toBeVisible();

    // New Run: fetch the bundled ticket, generate the plan, start it.
    await page.getByRole("link", { name: /Start a run/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: "New Run" })).toBeVisible();

    // Fetching the ticket also generates the plan, so we land on the Tests step.
    // In mock mode (UI_MOCK=1) the button loads the bundled fixture ticket.
    await page.getByRole("button", { name: /mock ticket/i }).click();
    await expect(page.getByText("QA-101")).toBeVisible();
    await expect(page.getByText("Generated test plan")).toBeVisible();
    await expect(page.getByText(/test[s]? ·/)).toBeVisible();
    await page.getByRole("button", { name: /^Continue$/ }).click();

    // Run against the refactored demo build so selectors have to be healed.
    await page.getByLabel("Demo version").selectOption("v2");
    await page.getByRole("button", { name: /Start run/i }).click();

    // Live run: SSE/polling drives the timeline, and a heal raises the banner
    // plus an inline old -> new locator diff.
    await expect(page.getByRole("heading", { level: 1, name: "Live Run" })).toBeVisible();
    await expect(page.getByText(/Healing a broken locator — no test failed/i)).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText("Old locator").first()).toBeVisible();

    // The run finishes and the console offers the full report.
    await expect(page.getByRole("button", { name: /Open report/i })).toBeVisible({
      timeout: 60_000,
    });

    // Repairs center: the newest repair is the one we just produced. The default
    // filter is "pending", so switch to "All" to keep the row after approval.
    await page.getByRole("link", { name: "Repairs", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Repairs Center" })).toBeVisible();
    await page.getByRole("tab", { name: /^All/ }).click();

    const repairRow = page.locator("button[aria-expanded]").first();
    await expect(repairRow).toBeVisible();
    await repairRow.click();
    await expect(repairRow.getByText("Pending review")).toBeVisible();

    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(repairRow.getByText("Approved")).toBeVisible();
    // "Reviewed …" lives in the expanded panel, not inside the toggle button.
    await expect(page.getByText(/Reviewed just now/)).toBeVisible();
  });
});
