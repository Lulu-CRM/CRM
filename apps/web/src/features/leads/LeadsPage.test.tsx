// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

// Each test gets a fresh copy of the mock data.
let LeadsPage: typeof import("./LeadsPage").LeadsPage;
let ToastProvider: typeof import("@/components/ui").ToastProvider;
let api: typeof import("@/lib/api").api;
let ApiError: typeof import("@/lib/api").ApiError;

beforeEach(async () => {
  vi.resetModules();
  ({ LeadsPage } = await import("./LeadsPage"));
  ({ ToastProvider } = await import("@/components/ui"));
  ({ api, ApiError } = await import("@/lib/api"));
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <LeadsPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  await screen.findByRole("button", { name: "Mila Rossi" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const column = (stage: string) => screen.getByRole("region", { name: stage });
// Lead names in a column: the card buttons, not the menu or "Add lead" buttons.
const namesIn = (stage: string) =>
  within(column(stage))
    .queryAllByRole("button")
    .filter((b) => b.closest("article") && !b.hasAttribute("aria-haspopup"))
    .map((b) => b.textContent);
const moveVia = (name: string, stage: string) => {
  fireEvent.click(screen.getByRole("button", { name: `Actions for ${name}` }));
  fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: stage }));
};

describe("Leads page", () => {
  it("shows the design's leads by lifecycle stage", () => {
    expect(namesIn("New")).toEqual(["Mila Rossi"]);
    expect(namesIn("Qualified")).toEqual(expect.arrayContaining(["Sophie Laurent", "Elena Schmidt"]));
    expect(namesIn("Follow-up")).toEqual(["Tobias Klein"]);
    expect(namesIn("Customer")).toEqual(["Daniel Chen"]);
    const mila = screen.getByRole("button", { name: "Mila Rossi" }).closest("article")!;
    expect(within(mila).getByText("Roam & Root")).toBeTruthy();
    expect(within(mila).getByText("Founder · Instagram")).toBeTruthy();
  });

  it("moving a lead changes its stage at once and saves it", async () => {
    moveVia("Mila Rossi", "Qualified");
    expect(namesIn("Qualified")).toContain("Mila Rossi");
    expect(namesIn("New")).toEqual([]);
    await waitFor(async () => expect((await api.contacts.get("contact_mila")).lifecycleStage).toBe("qualified"));
  });

  it("moving a lead to Customer converts it", async () => {
    const convert = vi.spyOn(api.contacts, "convert");
    moveVia("Tobias Klein", "Customer");
    expect(namesIn("Customer")).toContain("Tobias Klein");
    expect(await screen.findByText("Converted to customer")).toBeTruthy();
    expect(convert).toHaveBeenCalledWith("contact_tobias");
  });

  it("puts the lead back and shows an error when the API refuses", async () => {
    vi.spyOn(api.contacts, "update").mockRejectedValue(new ApiError("FORBIDDEN", 403));
    moveVia("Elena Schmidt", "Follow-up");
    expect(await screen.findByText("You don't have permission to do this")).toBeTruthy();
    expect(namesIn("Qualified")).toContain("Elena Schmidt");
    expect(namesIn("Follow-up")).toEqual(["Tobias Klein"]);
  });

  it("adds a lead straight into the column it was started from", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add lead to Follow-up" }));
    const dialog = screen.getByRole("dialog", { name: "Add a relationship to Lulu" });
    expect((within(dialog).getByLabelText("Lifecycle stage") as HTMLSelectElement).value).toBe("follow_up");

    fireEvent.change(within(dialog).getByLabelText(/Full name/), { target: { value: "Ada Lovelace" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create contact" }));
    });

    await waitFor(() => expect(namesIn("Follow-up")).toContain("Ada Lovelace"));
  });

  it("opens the contact profile from a card", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sophie Laurent" }));
    expect(await screen.findByRole("dialog", { name: "Sophie Laurent" })).toBeTruthy();
  });
});
