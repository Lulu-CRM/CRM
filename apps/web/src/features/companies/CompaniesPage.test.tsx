// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

// Each test gets a fresh copy of the mock data.
let CompaniesPage: typeof import("./CompaniesPage").CompaniesPage;
let ToastProvider: typeof import("@/components/ui").ToastProvider;
let api: typeof import("@/lib/api").api;

beforeEach(async () => {
  vi.resetModules();
  ({ CompaniesPage } = await import("./CompaniesPage"));
  ({ ToastProvider } = await import("@/components/ui"));
  ({ api } = await import("@/lib/api"));
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <CompaniesPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const names = () =>
  within(screen.getByRole("list", { name: messages.companies.eyebrow }))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("strong")?.textContent);
const slow = { timeout: 3000 };
const waitForRows = (count: number) => waitFor(() => expect(names()).toHaveLength(count), slow);

describe("Companies page", () => {
  it("lists the sample companies by pipeline value, with values computed from the data", async () => {
    await waitForRows(5);
    expect(names().slice(0, 2)).toEqual(["Atlas Logistics", "Northstar Studio"]);
    const atlas = screen.getByRole("button", { name: "Open Atlas Logistics" });
    expect(atlas.textContent).toContain("1 contact · Logistics");
    expect(atlas.textContent).toContain("€42,500");
    expect(atlas.textContent).toContain("Strong");
    expect(screen.getByRole("button", { name: "Open Roam & Root" }).textContent).toContain("Watch");
    expect(screen.getByRole("button", { name: "Open Klarwerk GmbH" }).textContent).toContain("New");
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /All companies/ }).textContent).toContain("5");
      expect(screen.getByRole("tab", { name: /My companies/ }).textContent).toContain("3");
    });
    expect(screen.getByText("Showing 5 of 5 companies")).toBeTruthy();
  });

  it("searches by domain and industry, and filters to my companies", async () => {
    await waitForRows(5);
    fireEvent.change(screen.getByLabelText(messages.companies.searchPlaceholder), { target: { value: "klarwerk.de" } });
    await waitForRows(1);
    expect(names()).toEqual(["Klarwerk GmbH"]);
    fireEvent.change(screen.getByLabelText(messages.companies.searchPlaceholder), { target: { value: "zzz" } });
    expect(await screen.findByText(messages.companies.noMatches, {}, { timeout: 2000 })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(messages.companies.searchPlaceholder), { target: { value: "" } });
    fireEvent.click(screen.getByRole("tab", { name: /My companies/ }));
    await waitForRows(3);
  });

  it("sorts by name", async () => {
    await waitForRows(5);
    fireEvent.change(screen.getByLabelText(messages.companies.sortLabel), { target: { value: "name" } });
    await waitFor(() => expect(names()[1]).toBe("Haus am Fluss"));
    expect(names()[0]).toBe("Atlas Logistics");
  });

  it("validates and creates a company", async () => {
    await waitForRows(5);
    const create = vi.spyOn(api.companies, "create");
    fireEvent.click(screen.getByRole("button", { name: /Add company/ }));
    const dialog = await screen.findByRole("dialog", { name: "Add an account" }, slow);
    fireEvent.change(within(dialog).getByLabelText("Domain"), { target: { value: "not a domain" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create company" }));
    expect(await within(dialog).findByText("Enter a company name", {}, slow)).toBeTruthy();
    expect(within(dialog).getByText("Enter a domain like company.com")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/Company name/), { target: { value: "Acme" } });
    fireEvent.change(within(dialog).getByLabelText("Domain"), { target: { value: "https://www.Acme.com/about" } });
    fireEvent.change(within(dialog).getByLabelText("Company size"), { target: { value: "11-50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create company" }));
    expect(await screen.findByText("Company added", {}, slow)).toBeTruthy();
    expect(create.mock.calls[0][0]).toEqual({ name: "Acme", domain: "acme.com", industry: null, size: "11-50", ownerId: "user_jamie" });
    await waitForRows(6);
  });

  it("opens a company with its people and deals, and edits it", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByRole("button", { name: "Open Northstar Studio" }));
    const drawer = await screen.findByRole("dialog", { name: "Northstar Studio" }, slow);
    expect(await within(drawer).findByText("Sophie Laurent", {}, slow)).toBeTruthy();
    expect(await within(drawer).findByText("Northstar annual workspace", {}, slow)).toBeTruthy();
    expect(within(drawer).getByText("1 open deal")).toBeTruthy();

    fireEvent.click(within(drawer).getByRole("button", { name: "Edit company" }));
    const form = await screen.findByRole("dialog", { name: "Edit company" }, slow);
    expect((within(form).getByLabelText(/Company name/) as HTMLInputElement).value).toBe("Northstar Studio");
    fireEvent.change(within(form).getByLabelText("Industry"), { target: { value: "Design" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Company saved", {}, slow)).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Northstar Studio" })).getByText("Design")).toBeTruthy(), slow);
  });

  it("deletes a company after confirming", async () => {
    await waitForRows(5);
    fireEvent.click(screen.getByRole("button", { name: "Open Haus am Fluss" }));
    const drawer = await screen.findByRole("dialog", { name: "Haus am Fluss" }, slow);
    fireEvent.click(within(drawer).getByRole("button", { name: "Delete company" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete company?" }, slow);
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Company deleted", {}, slow)).toBeTruthy();
    await waitForRows(4);
    expect(names()).not.toContain("Haus am Fluss");
  });
});
