// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

// Rules like "last touch in the last 14 days" depend on today. Pin the clock (Date only, so the
// mock API's timers still run) to the design's "today", Saturday 17 October 2026.
const NOW = new Date("2026-10-17T10:00:00.000Z");

// Each test gets a fresh copy of the mock data.
let SegmentsPage: typeof import("./SegmentsPage").SegmentsPage;
let ToastProvider: typeof import("@/components/ui").ToastProvider;

beforeEach(async () => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.resetModules();
  ({ SegmentsPage } = await import("./SegmentsPage"));
  ({ ToastProvider } = await import("@/components/ui"));
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <SegmentsPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  await screen.findByText("High-intent leads");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const row = (name: string) => screen.getByText(name).closest("li")!;

describe("Segments page", () => {
  it("lists the design's segments with their rules and live counts", () => {
    const highIntent = row("High-intent leads");
    expect(within(highIntent).getByText("Stage is Qualified · Last touch in the last 14 days")).toBeTruthy();
    expect(within(highIntent).getByLabelText("2 contacts")).toBeTruthy();
    expect(within(row("Needs follow-up")).getByLabelText("1 contact")).toBeTruthy();
    expect(within(row("Customers at risk")).getByText("Stage is Customer · Last touch more than 30 days ago")).toBeTruthy();
    expect(within(row("Newsletter consent")).getByText("Marketing consent is granted")).toBeTruthy();
    expect(screen.getByText("High-intent leads is updating automatically")).toBeTruthy();
  });

  it("shows a segment's contacts", async () => {
    fireEvent.click(screen.getByRole("button", { name: /View contacts/ }));
    const drawer = await screen.findByRole("dialog", { name: "High-intent leads" });
    expect(await within(drawer).findByText("Sophie Laurent")).toBeTruthy();
    expect(within(drawer).getByText("Elena Schmidt")).toBeTruthy();
    expect(within(drawer).queryByText("Mila Rossi")).toBeNull();
  });

  it("creates a segment with a live preview count", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create segment" }));
    const dialog = screen.getByRole("dialog", { name: "Create a segment" });

    // Nothing is saved without a name.
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create segment" }));
    });
    expect(within(dialog).getByText("Give the segment a name")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Alex's people" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Field" }), { target: { value: "ownerId" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Value" }), { target: { value: "user_alex" } });
    await waitFor(() => expect(within(dialog).getByText("2 contacts match")).toBeTruthy());

    // A second condition narrows it down.
    fireEvent.click(within(dialog).getByRole("button", { name: /Add condition/ }));
    const values = within(dialog).getAllByRole("combobox", { name: "Value" });
    fireEvent.change(values[1], { target: { value: "new" } });
    expect(within(dialog).getByText("1 contact matches")).toBeTruthy();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create segment" }));
    });
    await screen.findByText("Alex's people");
    expect(within(row("Alex's people")).getByText("Owner is Alex Rivera · Stage is New")).toBeTruthy();
    expect(within(row("Alex's people")).getByLabelText("1 contact")).toBeTruthy();
  });

  it("flags an incomplete condition", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create segment" }));
    const dialog = screen.getByRole("dialog", { name: "Create a segment" });
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Tagged" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Field" }), { target: { value: "tag" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create segment" }));
    });
    expect(within(dialog).getByText("Complete or remove the highlighted condition")).toBeTruthy();
    expect(within(dialog).getByRole("textbox", { name: "Value" }).getAttribute("aria-invalid")).toBe("true");
  });

  it("edits and deletes a segment", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Edit Customers at risk" }));
    let dialog = screen.getByRole("dialog", { name: "Update this segment" });
    expect((within(dialog).getByLabelText(/^Name/) as HTMLInputElement).value).toBe("Customers at risk");

    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Quiet customers" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });
    await screen.findByText("Quiet customers");

    fireEvent.click(screen.getByRole("button", { name: "Edit Quiet customers" }));
    dialog = screen.getByRole("dialog", { name: "Update this segment" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete segment" }));
    const confirm = screen.getByRole("dialog", { name: "Delete Quiet customers?" });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    });
    await waitFor(() => expect(screen.queryByText("Quiet customers")).toBeNull());
    expect(screen.getByText("Segment deleted")).toBeTruthy();
  });
});
