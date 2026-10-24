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

  it("adds a company: WhatsApp with a country, existing contacts linked, notes saved, AI notes written", async () => {
    await waitFor(() => expect(names()).toContain("Sophie Laurent"), slow);
    fireEvent.click(screen.getByRole("button", { name: /Add company/ }));
    const dialog = await screen.findByRole("dialog");
    const form = messages.companies.form;
    const type = (label: string, value: string) =>
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    fireEvent.change(within(dialog).getByLabelText(/Company name/), { target: { value: "Blue Harbor" } });
    fireEvent.change(within(dialog).getByLabelText(form.leadStatus), { target: { value: "qualified" } });
    // Dave, Oct 24: a country picker for the WhatsApp number.
    type(form.whatsappCountry, "NG");
    type(form.whatsapp, "0803 123 4567");
    type(form.instagram, "@blueharbor");
    type(form.facebook, "facebook.com/blueharbor");
    type(form.productService, "Boat rentals");
    type(form.note, "Met at the expo\nWants a demo in May");
    // No AI notes box any more: the AI writes them.
    expect(within(dialog).queryByLabelText(/AI notes/)).toBeNull();
    // Dave, Oct 24: pick existing contacts for the company.
    fireEvent.click(within(dialog).getByLabelText(form.contacts));
    fireEvent.click(await within(dialog).findByRole("checkbox", { name: /Sophie Laurent/ }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: form.submit }));
    });
    await waitFor(() => expect(names()).toContain("Blue Harbor"), slow);

    const company = (await api.companies.list({ q: "Blue Harbor" })).data[0]!;
    expect(company).toMatchObject({
      leadStatus: "qualified",
      whatsapp: "+2348031234567",
      instagram: "@blueharbor",
      facebook: "facebook.com/blueharbor",
      productService: "Boat rentals",
    });
    const notes = await api.notes.list({ recordType: "company", recordId: company.id });
    expect(notes.data.map((n) => [n.title, n.visibility])).toEqual([["Met at the expo", "shared"]]);
    const sophie = (await api.contacts.list({ q: "Sophie Laurent" })).data[0]!;
    expect(sophie.companyId).toBe(company.id);

    // The AI writes the notes in the background after the save.
    await waitFor(async () => expect((await api.companies.get(company.id)).aiNotes).not.toBeNull(), { timeout: 5000 });
    const written = (await api.companies.get(company.id)).aiNotes!;
    expect(written.map((line) => ("key" in line ? line.key : "text"))).toContain("companyPeople");
  });

  it("opens WhatsApp, Instagram and Facebook from the company, and shows its AI notes", async () => {
    await waitFor(() => expect(names()).toContain("Atlas Logistics"), slow);
    const atlas = (await api.companies.list({ q: "Atlas Logistics" })).data[0]!;
    await api.companies.update(atlas.id, { whatsapp: "+4917641474606", instagram: "atlas_logistics", facebook: "Atlas.Logistics" });
    await act(async () => {
      await api.companies.aiNotes(atlas.id);
    });
    fireEvent.change(screen.getByRole("searchbox", { name: messages.directory.search }), { target: { value: "atlas" } });
    await waitFor(() => expect(names()).toContain("Atlas Logistics"), slow);
    fireEvent.click(screen.getByRole("button", { name: "Open Atlas Logistics" }));
    const drawer = await screen.findByRole("dialog", { name: "Atlas Logistics" });

    const drawerText = messages.companies.drawer;
    // The drawer shows the fresh copy it loads, so wait for it.
    const whatsapp = await within(drawer).findByTitle(drawerText.openWhatsapp, {}, slow);
    expect(whatsapp.getAttribute("href")).toBe("https://wa.me/4917641474606");
    expect(within(drawer).getByTitle(drawerText.openInstagram).getAttribute("href")).toBe("https://instagram.com/atlas_logistics");
    expect(within(drawer).getByTitle(drawerText.openFacebook).getAttribute("href")).toBe("https://facebook.com/Atlas.Logistics");

    const notes = within(drawer).getByRole("region", { name: messages.companies.aiNotes.title });
    await waitFor(() => expect(within(notes).getByText(/Atlas Logistics is an account in your CRM/)).toBeTruthy(), { timeout: 5000 });
  });
});
