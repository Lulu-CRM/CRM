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
  it("lists people and companies together, with tab counts from the data", async () => {
    const [contacts, companies] = await Promise.all([api.contacts.list({ pageSize: 100 }), api.companies.list({ pageSize: 100 })]);
    const total = contacts.meta.total + companies.meta.total;
    await waitFor(() => expect(names()).toHaveLength(total), slow);
    expect(names()).toContain("Sophie Laurent");
    expect(names()).toContain("Atlas Logistics");
    expect(screen.getByText(`Showing ${total} of ${total} records`)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^All/ }).textContent).toContain(String(total));
      expect(screen.getByRole("tab", { name: /^Contacts/ }).textContent).toContain(String(contacts.meta.total));
    }, slow);
  });

  it("filters to companies only, and searches", async () => {
    await waitFor(() => expect(names()).toContain("Sophie Laurent"), slow);
    fireEvent.click(screen.getByRole("tab", { name: /^Companies/ }));
    await waitFor(() => expect(names()).not.toContain("Sophie Laurent"), slow);
    expect(names()).toContain("Atlas Logistics");

    fireEvent.click(screen.getByRole("tab", { name: /^All/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: messages.directory.search }), { target: { value: "atlas" } });
    await waitFor(() => expect(names()).toEqual(expect.arrayContaining(["Atlas Logistics"])), slow);
    expect(names()).not.toContain("Sophie Laurent");
  });

  it("opens the contact drawer for a person and the company drawer for a company", async () => {
    await waitFor(() => expect(names()).toContain("Sophie Laurent"), slow);
    fireEvent.click(screen.getByRole("button", { name: "Open Sophie Laurent" }));
    expect(await screen.findByRole("dialog", { name: "Sophie Laurent" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Open Atlas Logistics" }));
    expect(await screen.findByRole("dialog", { name: "Atlas Logistics" })).toBeTruthy();
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

  it("runs an AI analysis from the card and links to review it", async () => {
    await waitFor(() => expect(screen.getByRole("combobox", { name: messages.directory.ai.contact })).toBeTruthy(), slow);
    await waitFor(
      () => expect((screen.getByRole("combobox", { name: messages.directory.ai.contact }) as HTMLSelectElement).options.length).toBeGreaterThan(0),
      slow,
    );
    fireEvent.click(screen.getByRole("button", { name: messages.directory.ai.run }));
    const review = await screen.findByRole("link", { name: /Review and save/ }, { timeout: 5000 });
    expect(review.getAttribute("href")).toMatch(/^\/crm\/ai-analysis\?contact=/);
    expect(review.parentElement?.textContent).toContain(messages.directory.ai.nextStep);
  });

  it("adds a note linked to the chosen record from the notes card", async () => {
    const select = await screen.findByRole("combobox", { name: messages.directory.notes.record });
    await waitFor(() => expect((select as HTMLSelectElement).options.length).toBeGreaterThan(1), slow);
    const company = (await api.companies.list({ pageSize: 100 })).data.find((c) => c.name === "Atlas Logistics")!;
    fireEvent.change(select, { target: { value: `company:${company.id}` } });
    fireEvent.click(screen.getByRole("button", { name: /Add note/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Title/), { target: { value: "Renewal context" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: /Save note/ }));
    });
    await screen.findByText(messages.directory.notes.saved);
    const notes = await api.notes.list({ recordType: "company", recordId: company.id });
    expect(notes.data.map((n) => n.title)).toContain("Renewal context");
  });
});
