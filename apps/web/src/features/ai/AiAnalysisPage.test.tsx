// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

// The simulated AI looks at due dates and last contact. Pin the clock (Date only, so the mock's
// background job and the page's polling still run) to the design's "today".
const NOW = new Date("2026-10-17T10:00:00.000Z");

// Each test gets a fresh copy of the mock data.
let AiAnalysisPage: typeof import("./AiAnalysisPage").AiAnalysisPage;
let ToastProvider: typeof import("@/components/ui").ToastProvider;
let api: typeof import("@/lib/api").api;

beforeEach(async () => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.resetModules();
  ({ AiAnalysisPage } = await import("./AiAnalysisPage"));
  ({ ToastProvider } = await import("@/components/ui"));
  ({ api } = await import("@/lib/api"));
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <AiAnalysisPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  await screen.findByText("No analysis yet");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const pick = (name: string) => {
  const select = screen.getByRole("combobox", { name: "Analyze contact" }) as HTMLSelectElement;
  const option = [...select.options].find((o) => o.text.startsWith(name))!;
  fireEvent.change(select, { target: { value: option.value } });
};

const runAnalysis = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
  expect(await screen.findByRole("button", { name: "Analyzing…" })).toBeTruthy();
  await screen.findByRole("region", { name: "Relationship summary" }, { timeout: 4000 });
};

describe("AI Analysis page", () => {
  it("runs an analysis and shows summary, next step and data quality", async () => {
    await runAnalysis();
    // Sophie (first contact, most recent touch) has a proposal task due today.
    expect(within(screen.getByRole("region", { name: "Relationship summary" })).getByText(/Sophie Laurent is working with you on Northstar annual workspace/)).toBeTruthy();
    const next = screen.getByRole("region", { name: "Recommended next step" });
    expect(within(next).getByText("Finish the open follow-up")).toBeTruthy();
    expect(within(next).getByText("“Send proposal to Sophie Laurent” is due. Close it before planning the next step.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Data quality" })).getByText("5 of 5 fields complete")).toBeTruthy();
    // No change is proposed, so there is nothing to save, only dismiss.
    expect(screen.queryByRole("button", { name: "Review and save" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(await screen.findByText("Dismissed. Nothing was saved.")).toBeTruthy();
  });

  it("saves a suggested task only after the user confirms it", async () => {
    pick("Tobias Klein");
    await screen.findByText("No analysis yet");
    await runAnalysis();
    expect(screen.getByText("Follow up on the deal")).toBeTruthy();

    const before = (await api.tasks.list({ recordId: "contact_tobias" })).data.length;
    fireEvent.click(screen.getByRole("button", { name: "Review and save" }));
    const dialog = screen.getByRole("dialog", { name: "Save suggestions for Tobias Klein?" });
    const title = within(dialog).getByRole("textbox", { name: "Task title" }) as HTMLInputElement;
    expect(title.value).toBe("Follow up with Tobias Klein on Klarwerk finance workspace");
    expect(within(dialog).getByText("Create a follow-up task, due Oct 19, 2026")).toBeTruthy();

    // Still nothing saved while the dialog is open.
    expect((await api.tasks.list({ recordId: "contact_tobias" })).data).toHaveLength(before);

    fireEvent.change(title, { target: { value: "Call Tobias about the finance workspace" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save selected" }));
    });
    expect(await screen.findByText("Accepted. The changes you picked were saved.")).toBeTruthy();
    const tasks = (await api.tasks.list({ recordId: "contact_tobias" })).data;
    expect(tasks.map((t) => t.title)).toContain("Call Tobias about the finance workspace");
  });

  it("saving nothing is not possible: untick everything and the button turns off", async () => {
    pick("Tobias Klein");
    await screen.findByText("No analysis yet");
    await runAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "Review and save" }));
    const dialog = screen.getByRole("dialog", { name: "Save suggestions for Tobias Klein?" });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect((within(dialog).getByRole("button", { name: "Save selected" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the AI switches", async () => {
    const toggle = await screen.findByRole("switch", { name: /Suggest follow-ups/ });
    expect((toggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(toggle);
    await screen.findByText("AI setting saved");
    await waitFor(async () => expect((await api.settings.ai.get()).suggestFollowUps).toBe(false));
  });
});
