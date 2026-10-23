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

// Each test gets a fresh copy of the mock data.
let api: typeof import("@/lib/api").api;

beforeEach(async () => {
  vi.resetModules();
  const { DirectoryPage } = await import("./DirectoryPage");
  const { ToastProvider } = await import("@/components/ui");
  ({ api } = await import("@/lib/api"));
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <DirectoryPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const slow = { timeout: 3000 };
// Record names in table order (contacts first, then companies).
const names = () =>
  screen
    .queryAllByRole("row")
    .slice(1)
    .map((row) => row.querySelector("strong")?.textContent);

describe("Contacts & Companies page", () => {
  it("lists people and companies together, with no page header or filter row", async () => {
    const [contacts, companies] = await Promise.all([api.contacts.list({ pageSize: 100 }), api.companies.list({ pageSize: 100 })]);
    const total = contacts.meta.total + companies.meta.total;
    await waitFor(() => expect(names()).toHaveLength(total), slow);
    expect(names()).toContain("Sophie Laurent");
    expect(names()).toContain("Atlas Logistics");
    expect(screen.getByText(`Showing ${total} of ${total} records`)).toBeTruthy();
    // Removed at Dave's request: the page header (its description) and the All / Contacts / ... tabs.
    expect(screen.queryByText(messages.pages.directory.description)).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("button", { name: /Filter/ })).toBeNull();
  });

  it("searches people and companies together", async () => {
    await waitFor(() => expect(names()).toContain("Sophie Laurent"), slow);
    fireEvent.change(screen.getByRole("searchbox", { name: messages.directory.search }), { target: { value: "atlas" } });
    await waitFor(() => expect(names()).not.toContain("Sophie Laurent"), slow);
    expect(names()).toContain("Atlas Logistics");
  });

  it("opens the contact drawer for a person and the company drawer for a company", async () => {
    await waitFor(() => expect(names()).toContain("Sophie Laurent"), slow);
    fireEvent.click(screen.getByRole("button", { name: "Open Sophie Laurent" }));
    expect(await screen.findByRole("dialog", { name: "Sophie Laurent" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Open Atlas Logistics" }));
    expect(await screen.findByRole("dialog", { name: "Atlas Logistics" })).toBeTruthy();
  });

  it("deletes the selected records after confirming", async () => {
    await waitFor(() => expect(names()).toContain("Mila Rossi"), slow);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Mila Rossi" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Roam & Root" }));
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete 2 records?" });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    });
    await screen.findByText("2 records were deleted.");
    await waitFor(() => expect(names()).not.toContain("Mila Rossi"), slow);
    expect(names()).not.toContain("Roam & Root");
  });

  it("adds a contact and shows it in the table", async () => {
    await waitFor(() => expect(names()).toContain("Sophie Laurent"), slow);
    fireEvent.click(screen.getAllByRole("button", { name: /Add contact/ })[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Full name/), { target: { value: "Ada Lovelace" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: /Create contact/ }));
    });
    await waitFor(() => expect(names()).toContain("Ada Lovelace"), slow);
  });

  it("has no Notes or AI Analysis cards under the table", async () => {
    await waitFor(() => expect(names()).toContain("Sophie Laurent"), slow);
    expect(screen.queryByRole("button", { name: /Add note/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generate AI analysis/ })).toBeNull();
  });

  it("adds a company with the new fields, and its notes become a shared note on it", async () => {
    await waitFor(() => expect(names()).toContain("Sophie Laurent"), slow);
    fireEvent.click(screen.getByRole("button", { name: /Add company/ }));
    const dialog = await screen.findByRole("dialog");
    const form = messages.companies.form;
    const type = (label: string, value: string) =>
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    fireEvent.change(within(dialog).getByLabelText(/Company name/), { target: { value: "Blue Harbor" } });
    fireEvent.change(within(dialog).getByLabelText(form.leadStatus), { target: { value: "qualified" } });
    type(form.whatsapp, "+49 151 000 111");
    type(form.instagram, "@blueharbor");
    type(form.facebook, "facebook.com/blueharbor");
    type(form.productService, "Boat rentals");
    type(form.note, "Met at the expo\nWants a demo in May");
    type(form.aiNotes, "Seasonal business, busy in summer.");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: form.submit }));
    });
    await waitFor(() => expect(names()).toContain("Blue Harbor"), slow);

    const company = (await api.companies.list({ q: "Blue Harbor" })).data[0]!;
    expect(company).toMatchObject({
      leadStatus: "qualified",
      whatsapp: "+49 151 000 111",
      instagram: "@blueharbor",
      facebook: "facebook.com/blueharbor",
      productService: "Boat rentals",
      aiNotes: "Seasonal business, busy in summer.",
    });
    const notes = await api.notes.list({ recordType: "company", recordId: company.id });
    expect(notes.data.map((n) => [n.title, n.visibility])).toEqual([["Met at the expo", "shared"]]);
  });
});
