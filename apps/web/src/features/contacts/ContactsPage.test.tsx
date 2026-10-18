// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
let ContactsPage: typeof import("./ContactsPage").ContactsPage;
let ToastProvider: typeof import("@/components/ui").ToastProvider;
let api: typeof import("@/lib/api").api;

beforeEach(async () => {
  vi.resetModules();
  ({ ContactsPage } = await import("./ContactsPage"));
  ({ ToastProvider } = await import("@/components/ui"));
  ({ api } = await import("@/lib/api"));
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <ContactsPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const table = () => screen.getByRole("table");
const names = () =>
  within(table())
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelector("strong")?.textContent);
const waitForRows = (count: number) => waitFor(() => expect(names()).toHaveLength(count), { timeout: 2000 });

describe("Contacts page", () => {
  it("lists the sample contacts, most recent touch first, with filter counts", async () => {
    await waitForRows(5);
    expect(names()[0]).toBe("Sophie Laurent");
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /All contacts/ }).textContent).toContain("5");
      expect(screen.getByRole("tab", { name: /My contacts/ }).textContent).toContain("3");
      expect(screen.getByRole("tab", { name: /Needs follow-up/ }).textContent).toContain("1");
    });
    expect(screen.getByText("Showing 5 of 5 contacts")).toBeTruthy();
  });

  it("searches by company name", async () => {
    await waitForRows(5);
    fireEvent.change(screen.getByLabelText(messages.contacts.searchPlaceholder), { target: { value: "atlas" } });
    await waitForRows(1);
    expect(names()).toEqual(["Daniel Chen"]);
  });

  it("shows a no-match state", async () => {
    await waitForRows(5);
    fireEvent.change(screen.getByLabelText(messages.contacts.searchPlaceholder), { target: { value: "zzz" } });
    expect(await screen.findByText(messages.contacts.noMatches, {}, { timeout: 2000 })).toBeTruthy();
  });

  it("filters with the chips", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByRole("tab", { name: /Needs follow-up/ }));
    await waitForRows(1);
    expect(names()).toEqual(["Tobias Klein"]);
    fireEvent.click(screen.getByRole("tab", { name: /My contacts/ }));
    await waitForRows(3);
  });

  it("sorts by name", async () => {
    await waitForRows(5);
    fireEvent.click(within(table()).getByRole("button", { name: /Contact/ }));
    await waitFor(() => expect(names()[0]).toBe("Daniel Chen"));
    expect(names().at(-1)).toBe("Tobias Klein");
  });

  it("validates and adds a contact", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getAllByRole("button", { name: /Add contact/ })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Add a relationship to Lulu" });
    fireEvent.change(within(dialog).getByLabelText("Work email"), { target: { value: "not-an-email" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create contact" }));
    expect(await within(dialog).findByText("Enter a name")).toBeTruthy();
    expect(within(dialog).getByText("Enter a valid email address")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/Full name/), { target: { value: "Ada Lovelace" } });
    fireEvent.change(within(dialog).getByLabelText("Work email"), { target: { value: "ada@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Tags"), { target: { value: "VIP, vip ,  Math" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create contact" }));

    expect(await screen.findByText("Contact added")).toBeTruthy();
    await waitForRows(6);
    const created = (await api.contacts.list({ q: "ada" })).data[0];
    expect(created).toMatchObject({ email: "ada@example.com", tags: ["VIP", "vip", "Math"], ownerId: "user_jamie" });
  });

  it("opens the profile drawer with tasks and timeline, and edits from it", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByText("Sophie Laurent"));
    const drawer = await screen.findByRole("dialog", { name: "Sophie Laurent" });
    expect(within(drawer).getByText("Website form")).toBeTruthy();
    expect(await within(drawer).findByText("Send proposal to Sophie Laurent")).toBeTruthy();
    expect(await within(drawer).findByText("Email received")).toBeTruthy();

    fireEvent.click(within(drawer).getByRole("button", { name: "Edit contact" }));
    const form = await screen.findByRole("dialog", { name: "Edit contact" });
    expect((within(form).getByLabelText(/Full name/) as HTMLInputElement).value).toBe("Sophie Laurent");
    fireEvent.change(within(form).getByLabelText("Role"), { target: { value: "Head of Design" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Contact saved")).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Sophie Laurent" })).getByText("Head of Design")).toBeTruthy());
  });

  it("ticking a task adds a line to the timeline", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByText("Sophie Laurent"));
    const drawer = await screen.findByRole("dialog", { name: "Sophie Laurent" });
    fireEvent.click(await within(drawer).findByRole("checkbox", { name: "Send proposal to Sophie Laurent" }));
    expect(await within(drawer).findByText("Jamie Morgan updated a follow-up.", {}, { timeout: 2000 })).toBeTruthy();
  });

  it("adds a task from the drawer", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByText("Mila Rossi"));
    const drawer = await screen.findByRole("dialog", { name: "Mila Rossi" });
    fireEvent.click(within(drawer).getAllByRole("button", { name: /Task/ })[0]);
    fireEvent.change(within(drawer).getByLabelText("What needs to happen?"), { target: { value: "Call Mila" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Add task" }));
    expect(await within(drawer).findByText("Call Mila")).toBeTruthy();
  });

  it("converts a lead to a customer", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByText("Mila Rossi"));
    const drawer = await screen.findByRole("dialog", { name: "Mila Rossi" });
    fireEvent.click(within(drawer).getByRole("button", { name: "Convert to customer" }));
    expect(await screen.findByText("Converted to customer")).toBeTruthy();
    expect(within(drawer).queryByRole("button", { name: "Convert to customer" })).toBeNull();
  });

  it("deletes a contact after confirming, and Escape only closes the top dialog", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByText("Elena Schmidt"));
    const drawer = await screen.findByRole("dialog", { name: "Elena Schmidt" });
    fireEvent.click(within(drawer).getByRole("button", { name: "Delete contact" }));
    expect(await screen.findByRole("dialog", { name: "Delete contact?" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete contact?" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Elena Schmidt" })).toBeTruthy();

    fireEvent.click(within(screen.getByRole("dialog", { name: "Elena Schmidt" })).getByRole("button", { name: "Delete contact" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete contact?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Contact deleted")).toBeTruthy();
    await waitForRows(4);
    expect(names()).not.toContain("Elena Schmidt");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("deletes selected contacts in bulk", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByLabelText("Select Mila Rossi"));
    fireEvent.click(screen.getByLabelText("Select Tobias Klein"));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete 2 contacts?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitForRows(3);
    expect(screen.getByText("2 contacts deleted")).toBeTruthy();
  });

  it("opens the profile from the row menu", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByRole("button", { name: "Open Daniel Chen" }));
    expect(await screen.findByRole("dialog", { name: "Daniel Chen" })).toBeTruthy();
  });

  it("filters by status and owner from + Filter, and the chip removes it", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByRole("button", { name: /Filter/ }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "qualified" } });
    await waitForRows(2);
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "user_alex" } });
    await waitForRows(1);
    expect(names()).toEqual(["Elena Schmidt"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Qualified" }));
    await waitForRows(2);
  });

  it("shows an error with a retry", async () => {
    await waitForRows(5);
    vi.spyOn(api.contacts, "list").mockRejectedValue(new Error("down"));
    fireEvent.change(screen.getByLabelText(messages.contacts.searchPlaceholder), { target: { value: "x" } });
    expect(await screen.findByText(messages.errors.UNKNOWN_ERROR, {}, { timeout: 2000 })).toBeTruthy();
    vi.mocked(api.contacts.list).mockRestore();
    fireEvent.change(screen.getByLabelText(messages.contacts.searchPlaceholder), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitForRows(5);
  });
});
