// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

let api: typeof import("@/lib/api").api;

async function renderPage() {
  vi.resetModules();
  const { OverviewPage } = await import("./OverviewPage");
  ({ api } = await import("@/lib/api"));
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <OverviewPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(renderPage);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Overview page", () => {
  it("shows the numbers from GET /overview", async () => {
    const overview = await api.overview();
    await waitFor(() => expect(screen.getByTestId("stat-contacts").textContent).toBe(String(overview.contactCount)));
    expect(screen.getByTestId("stat-pipeline").textContent).toMatch(/€/);
    expect(screen.getByTestId("stat-followUps").textContent).toBe(String(overview.followUpsDue));
    expect(screen.getByTestId("stat-signals").textContent).toBe(String(overview.aiSignals));
  });

  it("lists recent contacts, pipeline stages and activity", async () => {
    expect(await screen.findByText("Sophie Laurent", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("Negotiation")).toBeTruthy();
    expect(screen.getByText(/active opportunit/)).toBeTruthy();
    const stream = screen.getByText("The team is in motion.").closest("section")!;
    expect(within(stream).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("shows an error with a retry", async () => {
    cleanup();
    vi.spyOn((await import("@/lib/api")).api, "overview").mockRejectedValue(new Error("down"));
    // Render again with the failing api (the spy is on the module the page imports).
    const { OverviewPage } = await import("./OverviewPage");
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <OverviewPage />
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText(messages.errors.UNKNOWN_ERROR)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
