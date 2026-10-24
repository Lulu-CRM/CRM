// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

let pathname = "/crm/directory";
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderRail(path = "/crm/directory") {
  pathname = path;
  vi.resetModules();
  const { Rail } = await import("./Rail");
  const { api } = await import("@/lib/api");
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <Rail />
    </NextIntlClientProvider>,
  );
  return api;
}

const crmMenu = () => screen.getByRole("navigation", { name: "CRM" });
const badge = () => within(crmMenu()).getByRole("link", { name: /Contacts & Companies/ }).querySelector("b")?.textContent;

describe("Rail CRM menu", () => {
  it("shows the menu pages; Import Contacts is a pop-up, not a menu item (Dave, Oct 24)", async () => {
    await renderRail();
    expect(within(crmMenu()).getAllByRole("link").map((link) => link.textContent?.replace(/\d+$/, ""))).toEqual([
      "♙Contacts & Companies",
      "◈Leads & Deals",
      "▤Notes",
    ]);
  });

  it("highlights the menu item an older page belongs to", async () => {
    await renderRail("/crm/deals");
    expect(within(crmMenu()).getByRole("link", { name: /Leads & Deals/ }).getAttribute("aria-current")).toBe("page");
  });

  it("folds the CRM menu away", async () => {
    await renderRail();
    fireEvent.click(screen.getByRole("button", { name: /CRM/ }));
    expect(screen.queryByRole("navigation", { name: "CRM" })).toBeNull();
  });

  it("shows the signed-in user, with language in the profile menu", async () => {
    await renderRail();
    const profile = await screen.findByRole("button", { name: messages.layout.profileMenu });
    await waitFor(() => expect(profile.textContent).toContain("Jamie Morgan"));
    expect(profile.textContent).toContain(messages.layout.role.owner);
    fireEvent.click(profile);
    const menu = screen.getByRole("group", { name: messages.layout.profileMenu });
    expect(within(menu).getByRole("combobox", { name: messages.common.language })).toBeTruthy();
  });

  it("counts contacts and companies, and updates as soon as a contact is added or deleted", async () => {
    const api = await renderRail();
    const [contacts, companies] = await Promise.all([api.contacts.list({ pageSize: 1 }), api.companies.list({ pageSize: 1 })]);
    const start = contacts.meta.total + companies.meta.total;
    await waitFor(() => expect(badge()).toBe(String(start)));

    let created: { id: string } | undefined;
    await act(async () => {
      created = await api.contacts.create({ name: "Badge Test" });
    });
    await waitFor(() => expect(badge()).toBe(String(start + 1)));

    await act(async () => {
      await api.contacts.remove(created!.id);
    });
    await waitFor(() => expect(badge()).toBe(String(start)));
  });
});
