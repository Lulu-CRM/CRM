// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

let pathname = "/crm/directory";
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname,
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
  it("shows the four pages of the new design", async () => {
    await renderRail();
    expect(within(crmMenu()).getAllByRole("link").map((link) => link.textContent?.replace(/\d+$/, ""))).toEqual([
      "♙Contacts & Companies",
      "◈Leads & Deals",
      "▤Notes",
      "⇧Import Contacts",
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
