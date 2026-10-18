// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
let ImportPage: typeof import("./ImportPage").ImportPage;
let ToastProvider: typeof import("@/components/ui").ToastProvider;
let api: typeof import("@/lib/api").api;

beforeEach(async () => {
  vi.resetModules();
  ({ ImportPage } = await import("./ImportPage"));
  ({ ToastProvider } = await import("@/components/ui"));
  ({ api } = await import("@/lib/api"));
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <ImportPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  await screen.findByRole("button", { name: "Choose file" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// One duplicate of Sophie (same email), one row without a name, two new people.
const CSV = [
  "full_name,work_email,company,job_title",
  "Sophie Laurent,SOPHIE@northstar.studio,Northstar Studio,Creative Director",
  "Ada Lovelace,ada@example.com,Analytical Engines,Founder",
  ",nobody@example.com,,",
  "Grace Hopper,grace@example.com,Navy,Admiral",
].join("\n");

const uploadFile = (name: string, content: string) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File([content], name, { type: "text/csv" })] } });
};

describe("Import Contacts page", () => {
  it("runs the whole wizard: upload, map, check, import, then review held duplicates", async () => {
    fireEvent.change(screen.getByLabelText("Apply tag"), { target: { value: "Imported 2026" } });
    uploadFile("contacts-northstar.csv", CSV);

    // Map: columns are recognised, with an example from the first row.
    expect(await screen.findByText("contacts-northstar.csv")).toBeTruthy();
    expect(screen.getByText("4 rows · 4 fields recognised")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Lulu field for work_email" }) as HTMLSelectElement).value).toBe("email");
    expect(screen.getByText("SOPHIE@northstar.studio")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check quality" }));

    // Check: counts for the whole file and what each row will become.
    await screen.findByText("1 possible duplicate will be held");
    const tile = (label: string) => screen.getByText(label).closest("div")!;
    expect(within(tile("New contacts")).getByText("2")).toBeTruthy();
    expect(within(tile("Possible duplicates")).getByText("1")).toBeTruthy();
    expect(within(tile("Rows with problems")).getByText("1")).toBeTruthy();
    expect(screen.getByText("Same email")).toBeTruthy();
    expect(screen.getByText("No name")).toBeTruthy();
    expect(screen.getByText("2 new contacts will be added.")).toBeTruthy();

    // Confirm: the background job runs, then the result shows.
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
    await screen.findByText(/Importing 4 rows/);
    await screen.findByText("Import finished.", undefined, { timeout: 4000 });
    const count = (label: string) => within(screen.getByText(label).closest("div")!).getByRole("definition").textContent;
    expect(count("Added")).toBe("2");
    expect(count("Held for review")).toBe("1");
    expect(count("Skipped")).toBe("1");

    // The new contacts exist, with the tag and the default source.
    const ada = (await api.contacts.list({ q: "ada@example.com" })).data[0];
    expect(ada).toMatchObject({ name: "Ada Lovelace", source: "import", tags: ["Imported 2026"] });

    // Held duplicates: side by side, and nothing changes until a choice is made.
    fireEvent.click(screen.getByRole("button", { name: "Review 1 held duplicate" }));
    const row = await screen.findByRole("listitem", { name: "Row 1: Sophie Laurent" });
    expect(within(row).getByText("Same email as an existing contact")).toBeTruthy();
    expect(within(row).getByText("Already in Lulu")).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: "Merge into existing" }));
    expect(await screen.findByText("All held duplicates are resolved.")).toBeTruthy();
    expect(screen.getByText("Merged into the existing contact")).toBeTruthy();

    // Merge fills gaps and adds tags; it never overwrites what Sophie already has.
    const sophie = await api.contacts.get("contact_sophie");
    expect(sophie.jobRole).toBe("Creative Director");
    expect(sophie.tags).toContain("Imported 2026");
  });

  it("blocks the next step until a name column is mapped", async () => {
    uploadFile("people.csv", CSV);
    const select = await screen.findByRole("combobox", { name: "Lulu field for full_name" });
    fireEvent.change(select, { target: { value: "ignore" } });
    expect(screen.getByRole("alert").textContent).toBe("Map a column to Full name, or to First name and Last name.");
    expect((screen.getByRole("button", { name: "Check quality" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("explains why a file cannot be read", async () => {
    uploadFile("empty.csv", "full_name,email\n");
    expect(await screen.findByText("The file has no rows to import")).toBeTruthy();
    uploadFile("sheet.xlsx", "binary");
    expect(await screen.findByText("Excel files are read by the server. In mock mode, save the sheet as CSV first.")).toBeTruthy();
  });

  it("can skip duplicates instead of holding them", async () => {
    fireEvent.change(screen.getByLabelText("Duplicate handling"), { target: { value: "skip" } });
    uploadFile("contacts.csv", CSV);
    fireEvent.click(await screen.findByRole("button", { name: "Check quality" }));
    expect(await screen.findByText("1 possible duplicate will be skipped")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
    await screen.findByText("Import finished.", undefined, { timeout: 4000 });
    expect(within(screen.getByText("Skipped").closest("div")!).getByRole("definition").textContent).toBe("2");
    expect(screen.queryByRole("button", { name: /Review/ })).toBeNull();
  });
});
