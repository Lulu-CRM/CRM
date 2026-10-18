// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

// The sample tasks are dated relative to "now". Pin the clock (Date only, so the mock API's
// timers still run) to Saturday 17 October 2026, so the chips are the same on every machine.
const NOW = new Date("2026-10-17T10:00:00.000Z");

// Each test gets a fresh copy of the mock data.
let ActivitiesPage: typeof import("./ActivitiesPage").ActivitiesPage;
let ToastProvider: typeof import("@/components/ui").ToastProvider;
let api: typeof import("@/lib/api").api;
let ApiError: typeof import("@/lib/api").ApiError;

beforeEach(async () => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.resetModules();
  ({ ActivitiesPage } = await import("./ActivitiesPage"));
  ({ ToastProvider } = await import("@/components/ui"));
  ({ api, ApiError } = await import("@/lib/api"));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const renderPage = async () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <ActivitiesPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  await screen.findByText("Send proposal to Sophie Laurent");
  await screen.findByText("Email received");
};

const row = (title: string) => screen.getByText(title).closest("li")!;
// Task titles in list order (the "Show completed" filter checkbox is not a task row).
const titles = () =>
  screen
    .queryAllByRole("checkbox")
    .map((box) => box.closest("li"))
    .filter((li): li is HTMLLIElement => li !== null)
    .map((li) => li.querySelector("strong")!.textContent);
const timeline = () => screen.getByRole("list", { name: "Every touchpoint, together." });

describe("Activities & Tasks page", () => {
  it("shows the design's tasks with their chips, and the activity timeline", async () => {
    await renderPage();

    expect(within(row("Send proposal to Sophie Laurent")).getByText("Today")).toBeTruthy();
    expect(within(row("Send proposal to Sophie Laurent")).getByText("Sophie Laurent · Jamie Morgan")).toBeTruthy();
    expect(within(row("Review Atlas onboarding notes")).getByText("Tomorrow")).toBeTruthy();
    expect(within(row("Schedule Klarwerk finance review")).getByText("Wednesday")).toBeTruthy();
    expect(within(row("Confirm Roam & Root requirements")).getByText("Done")).toBeTruthy();

    // Open tasks by due date, done tasks last.
    expect(titles()).toEqual([
      "Send proposal to Sophie Laurent",
      "Review Atlas onboarding notes",
      "Schedule Klarwerk finance review",
      "Confirm Roam & Root requirements",
    ]);

    const items = within(timeline()).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(within(items[0]).getByText("Email received")).toBeTruthy();
    expect(within(items[0]).getByText(/Sophie Laurent/)).toBeTruthy();
  });

  it("filters by owner and due date", async () => {
    await renderPage();

    fireEvent.change(screen.getByRole("combobox", { name: "Owner" }), { target: { value: "user_alex" } });
    expect(titles()).toEqual(["Schedule Klarwerk finance review", "Confirm Roam & Root requirements"]);

    fireEvent.change(screen.getByRole("combobox", { name: "Owner" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^Today/ }));
    expect(titles()).toEqual(["Send proposal to Sophie Laurent"]);

    fireEvent.click(screen.getByRole("button", { name: /^Overdue/ }));
    expect(screen.getByText("No tasks match these filters")).toBeTruthy();
  });

  it("ticking a task marks it done and adds it to the timeline at once", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("checkbox", { name: /^Send proposal to Sophie Laurent/ }));

    // Optimistic: before the API answers.
    expect(within(row("Send proposal to Sophie Laurent")).getByText("Done")).toBeTruthy();
    const first = within(timeline()).getAllByRole("listitem")[0];
    expect(within(first).getByText("Task completed")).toBeTruthy();
    expect(within(first).getByText("Sophie Laurent · Jamie Morgan completed a follow-up.")).toBeTruthy();

    // And still there once the server's timeline is back.
    await waitFor(() => expect(within(timeline()).getAllByRole("listitem")).toHaveLength(6));
    expect(within(within(timeline()).getAllByRole("listitem")[0]).getByText("Task completed")).toBeTruthy();
    // Done tasks move below open ones, most recently finished first.
    expect(titles()).toEqual([
      "Review Atlas onboarding notes",
      "Schedule Klarwerk finance review",
      "Send proposal to Sophie Laurent",
      "Confirm Roam & Root requirements",
    ]);
  });

  it("puts the task back and shows an error when the API refuses", async () => {
    vi.spyOn(api.tasks, "update").mockRejectedValue(new ApiError("FORBIDDEN", 403));
    await renderPage();

    // The sample data already has one completed task (Roam & Root) on the timeline.
    expect(within(timeline()).getAllByText("Task completed")).toHaveLength(1);
    const box = screen.getByRole("checkbox", { name: /^Review Atlas onboarding notes/ }) as HTMLInputElement;
    fireEvent.click(box);

    expect(await screen.findByText("You don't have permission to do this")).toBeTruthy();
    expect(box.checked).toBe(false);
    expect(within(row("Review Atlas onboarding notes")).getByText("Tomorrow")).toBeTruthy();
    expect(within(timeline()).getAllByText("Task completed")).toHaveLength(1);
  });

  it("creates a task linked to a contact", async () => {
    await renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "New task" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Create a follow-up" });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create task" }));
    });
    expect(within(dialog).getByText("Give the task a title")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/Task title/), { target: { value: "Call Elena about the renewal" } });
    fireEvent.change(within(dialog).getByLabelText("Related to"), { target: { value: "contact:contact_elena" } });
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: "2026-10-17" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create task" }));
    });

    await screen.findByText("Call Elena about the renewal");
    expect(within(row("Call Elena about the renewal")).getByText("Today")).toBeTruthy();
    expect(within(row("Call Elena about the renewal")).getByText("Elena Schmidt · Jamie Morgan")).toBeTruthy();
    expect(screen.getByText("Task added to Activities.")).toBeTruthy();
  });

  it("edits a task", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit Review Atlas onboarding notes" }));
    const dialog = screen.getByRole("dialog", { name: "Update this follow-up" });

    // The record link is fixed after creation.
    expect((within(dialog).getByLabelText("Related to") as HTMLSelectElement).disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/Task title/), { target: { value: "Review Atlas onboarding plan" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });

    await screen.findByText("Review Atlas onboarding plan");
    expect(screen.queryByText("Review Atlas onboarding notes")).toBeNull();
    expect(within(row("Review Atlas onboarding plan")).getByText("Atlas Logistics · Jamie Morgan")).toBeTruthy();
  });

  it("shows an error with a retry when tasks cannot load", async () => {
    vi.spyOn(api.tasks, "list").mockRejectedValueOnce(new ApiError("NETWORK_ERROR", 0));
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <ToastProvider>
          <ActivitiesPage />
        </ToastProvider>
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText("Can't reach the server. Check your connection.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]);
    expect(await screen.findByText("Send proposal to Sophie Laurent")).toBeTruthy();
  });
});
