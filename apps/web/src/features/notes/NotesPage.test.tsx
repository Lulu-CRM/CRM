// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

// Each test gets a fresh copy of the mock data.
let NotesPage: typeof import("./NotesPage").NotesPage;
let ToastProvider: typeof import("@/components/ui").ToastProvider;
let api: typeof import("@/lib/api").api;
let ApiError: typeof import("@/lib/api").ApiError;

beforeEach(async () => {
  vi.resetModules();
  ({ NotesPage } = await import("./NotesPage"));
  ({ ToastProvider } = await import("@/components/ui"));
  ({ api, ApiError } = await import("@/lib/api"));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderPage = async () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <NotesPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  await screen.findByText("Northstar decision criteria");
};

const grid = () => screen.getByRole("list", { name: "Context that does not get lost." });
const cardTitles = () => within(grid()).getAllByRole("listitem").map((li) => li.querySelector("strong")!.textContent);
const card = (title: string) => screen.getByRole("button", { name: `Open note ${title}` });
const dialog = () => screen.getByRole("dialog");

describe("Notes page", () => {
  it("shows the shared sample notes with author, visibility and linked record", async () => {
    await renderPage();

    expect(cardTitles()).toEqual(["Northstar decision criteria", "Roam & Root context"]);
    // Alex's private note is not shown to Jamie.
    expect(screen.queryByText("Klarwerk next step")).toBeNull();

    const northstar = card("Northstar decision criteria");
    expect(within(northstar).getByText("Shared")).toBeTruthy();
    expect(within(northstar).getByText("Jamie Morgan")).toBeTruthy();
    await waitFor(() => expect(within(northstar).getByText("Company: Northstar Studio")).toBeTruthy());
    await waitFor(() => expect(within(card("Roam & Root context")).getByText("Contact: Mila Rossi")).toBeTruthy());
  });

  it("adds a private note linked to a deal, and filters by visibility and search", async () => {
    await renderPage();
    await screen.findByText("Contact: Mila Rossi");

    fireEvent.click(screen.getAllByRole("button", { name: /Add note/ })[0]);
    fireEvent.change(within(dialog()).getByLabelText(/Title/), { target: { value: "Atlas pricing" } });
    fireEvent.change(within(dialog()).getByLabelText("Note"), { target: { value: "Ten seats, yearly." } });
    fireEvent.change(within(dialog()).getByLabelText("Visibility"), { target: { value: "private" } });
    fireEvent.change(within(dialog()).getByLabelText("Linked to"), { target: { value: "deal:deal_atlas" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save note" }));

    await screen.findByText("Note saved to the CRM workspace.");
    expect(cardTitles()[0]).toBe("Atlas pricing");
    const created = card("Atlas pricing");
    expect(within(created).getByText("Private")).toBeTruthy();
    expect(within(created).getByText(/^Deal: /)).toBeTruthy();

    const filters = screen.getByRole("group", { name: "Show notes" });
    expect(within(filters).getByRole("button", { name: "All 3" })).toBeTruthy();
    fireEvent.click(within(filters).getByRole("button", { name: "Private 1" }));
    expect(cardTitles()).toEqual(["Atlas pricing"]);

    fireEvent.click(within(filters).getByRole("button", { name: "All 3" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search notes" }), { target: { value: "approval" } });
    expect(cardTitles()).toEqual(["Northstar decision criteria"]);
    expect(within(filters).getByRole("button", { name: "Private 0" })).toBeTruthy();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search notes" }), { target: { value: "nothing like this" } });
    expect(screen.getByText("No notes match")).toBeTruthy();
  });

  it("asks for a title", async () => {
    await renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Add note/ })[0]);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save note" }));
    expect(await within(dialog()).findByText("Give the note a title")).toBeTruthy();
  });

  it("edits a note, moves its link and then deletes it", async () => {
    await renderPage();
    await screen.findByText("Contact: Mila Rossi");

    fireEvent.click(card("Roam & Root context"));
    const title = within(dialog()).getByLabelText(/Title/) as HTMLInputElement;
    expect(title.value).toBe("Roam & Root context");
    fireEvent.change(title, { target: { value: "Roam & Root updates" } });
    fireEvent.change(within(dialog()).getByLabelText("Linked to"), { target: { value: "company:company_roam" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));

    await screen.findByText("Note updated.");
    expect(within(card("Roam & Root updates")).getByText("Company: Roam & Root")).toBeTruthy();

    fireEvent.click(card("Roam & Root updates"));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Delete note" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete this note?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));

    await screen.findByText("Note deleted.");
    expect(cardTitles()).toEqual(["Northstar decision criteria"]);
    expect((await api.notes.list()).meta.total).toBe(1);
  });

  it("shows the API error with a retry", async () => {
    vi.spyOn(api.notes, "list").mockRejectedValueOnce(new ApiError("NETWORK_ERROR", 0));
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <ToastProvider>
          <NotesPage />
        </ToastProvider>
      </NextIntlClientProvider>,
    );
    await screen.findByText("Can't reach the server. Check your connection.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Northstar decision criteria");
  });

  it("shows an empty state when there are no notes", async () => {
    vi.spyOn(api.notes, "list").mockResolvedValue({ data: [], meta: { page: 1, pageSize: 100, total: 0 } });
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <ToastProvider>
          <NotesPage />
        </ToastProvider>
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText("No notes yet")).toBeTruthy();
  });
});
