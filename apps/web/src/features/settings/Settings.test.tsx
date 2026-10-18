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
let settings: typeof import("./SettingsPage") & typeof import("./CustomFieldsSettings") & typeof import("./PipelineSettings") & typeof import("./FormSettings");
let ToastProvider: typeof import("@/components/ui").ToastProvider;
let api: typeof import("@/lib/api").api;

beforeEach(async () => {
  vi.resetModules();
  settings = {
    ...(await import("./SettingsPage")),
    ...(await import("./CustomFieldsSettings")),
    ...(await import("./PipelineSettings")),
    ...(await import("./FormSettings")),
  };
  ({ ToastProvider } = await import("@/components/ui"));
  ({ api } = await import("@/lib/api"));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const show = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>,
  );

const click = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

describe("Settings list", () => {
  it("opens a real screen from every row", () => {
    show(<settings.SettingsPage />);
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toEqual([
      "/crm/settings/fields",
      "/crm/settings/pipelines",
      "/crm/settings/roles",
      "/crm/settings/consent",
      "/crm/settings/notifications",
    ]);
    expect(screen.getByText("Workspace protected")).toBeTruthy();
  });
});

describe("Custom contact fields", () => {
  it("adds, edits and deletes a field", async () => {
    show(<settings.CustomFieldsSettings />);
    await click(await screen.findByRole("button", { name: /Add field/ }));
    let dialog = screen.getByRole("dialog", { name: "Add a contact field" });

    // A choice list needs choices.
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "Customer tier" } });
    fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: "select" } });
    await click(within(dialog).getByRole("button", { name: "Add field" }));
    expect(within(dialog).getByText("Add at least one choice")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Choices"), { target: { value: "Gold\nSilver\nGold" } });
    await click(within(dialog).getByRole("button", { name: "Add field" }));
    const row = (await screen.findByText("Customer tier")).closest("li")!;
    expect(within(row).getByText("customer_tier · Gold, Silver")).toBeTruthy();
    expect(within(row).getByText("Choice list")).toBeTruthy();

    // Editing keeps the key and type.
    await click(within(row).getByRole("button", { name: "Edit Customer tier" }));
    dialog = screen.getByRole("dialog", { name: "Edit field" });
    expect((within(dialog).getByLabelText("Type") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "Tier" } });
    await click(within(dialog).getByRole("button", { name: "Save" }));
    await screen.findByText("Tier");

    await click(screen.getByRole("button", { name: "Delete Tier" }));
    await click(within(screen.getByRole("dialog", { name: "Delete Tier?" })).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("No custom fields yet")).toBeTruthy();
  });
});

describe("Statuses and pipelines", () => {
  const stageNames = () => screen.getAllByRole("textbox", { name: /^Name of / }).map((i) => (i as HTMLInputElement).value);

  it("renames, adds, reorders and protects stages", async () => {
    show(<settings.PipelineSettings />);
    await screen.findByDisplayValue("Proposal");
    expect(stageNames()).toEqual(["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]);

    // Rename a default stage.
    fireEvent.change(screen.getByRole("textbox", { name: "Name of Proposal" }), { target: { value: "Offer sent" } });
    await click(screen.getByRole("button", { name: "Save" }));
    await screen.findByDisplayValue("Offer sent");
    const renamed = (await api.pipelines())[0].stages.find((s) => s.id === "stage_proposal")!;
    expect(renamed).toMatchObject({ name: "Offer sent", key: null });

    // New stages go after the open stages, before Won and Lost.
    fireEvent.change(screen.getByLabelText("New stage"), { target: { value: "Demo booked" } });
    fireEvent.change(screen.getByLabelText("Probability %"), { target: { value: "55" } });
    await click(screen.getByRole("button", { name: "Add stage" }));
    await screen.findByRole("textbox", { name: "Name of Demo booked" });
    expect(stageNames()).toEqual(["New", "Qualified", "Offer sent", "Negotiation", "Demo booked", "Won", "Lost"]);

    await click(screen.getByRole("button", { name: "Move Demo booked up" }));
    await waitFor(() => expect(stageNames()).toEqual(["New", "Qualified", "Offer sent", "Demo booked", "Negotiation", "Won", "Lost"]));

    // A stage with deals cannot be deleted; Won and Lost have no delete button.
    await click(screen.getByRole("button", { name: "Delete Negotiation" }));
    expect(await screen.findByText("Move the deals out of this stage before deleting it")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete Won" })).toBeNull();

    await click(screen.getByRole("button", { name: "Delete Demo booked" }));
    await waitFor(() => expect(stageNames()).not.toContain("Demo booked"));
  });
});

describe("Roles, consent and notifications", () => {
  it("saves role permissions", async () => {
    show(<settings.RolesSettings />);
    const cell = await screen.findByRole("checkbox", { name: "Member can Delete Contacts" });
    expect((cell as HTMLInputElement).checked).toBe(false);
    fireEvent.click(cell);
    await click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Settings saved");
    expect((await api.settings.roles.get()).member.contacts).toContain("delete");
  });

  it("saves consent rules and can undo unsaved changes", async () => {
    show(<settings.ConsentSettings />);
    const marketing = await screen.findByRole("switch", { name: /Marketing needs consent/ });
    fireEvent.click(marketing);
    expect(screen.getByText("You have unsaved changes")).toBeTruthy();
    await click(screen.getByRole("button", { name: "Cancel" }));
    expect((marketing as HTMLInputElement).checked).toBe(true);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "granted" } });
    await click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Settings saved");
    expect((await api.settings.consent.get()).importedContactsConsent).toBe("granted");
  });

  it("saves notification channels", async () => {
    show(<settings.NotificationSettings />);
    const email = await screen.findByRole("checkbox", { name: "One of my tasks is due: Email" });
    fireEvent.click(email);
    await click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Settings saved");
    expect((await api.settings.notifications.get()).taskDue.email).toBe(true);
  });

  it("is read-only for members", async () => {
    const me = await api.me();
    vi.spyOn(api, "me").mockResolvedValue({ ...me, role: "member" });
    show(<settings.NotificationSettings />);
    expect(await screen.findByText(/Only owners and admins can change these settings/)).toBeTruthy();
    expect(((await screen.findByRole("checkbox", { name: "One of my tasks is due: Email" })) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
