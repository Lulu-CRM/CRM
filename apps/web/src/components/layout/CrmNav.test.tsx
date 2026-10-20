// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/crm/overview",
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

async function renderNav() {
  vi.resetModules();
  const { CrmNav } = await import("./CrmNav");
  const { api } = await import("@/lib/api");
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <CrmNav />
    </NextIntlClientProvider>,
  );
  return api;
}

// The badge on the Contacts link (not "Import Contacts").
const badge = () =>
  screen
    .getAllByRole("link")
    .find((link) => link.getAttribute("href")?.endsWith("/contacts"))
    ?.querySelector("b")?.textContent;

describe("CRM menu contact badge", () => {
  it("updates as soon as a contact is added or deleted", async () => {
    const api = await renderNav();
    const start = (await api.contacts.list({ pageSize: 1 })).meta.total;
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
