// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import { ToastProvider } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { DealsView } from "./DealsView";

// These tests run against the mock API (the design's sample data). Its data lives for the whole file,
// so each test checks changes relative to what it sees rather than fixed totals.

// Undo any API failure a test set up, so the next test talks to the mock again.
beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(cleanup);

const renderPage = async () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <DealsView />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  await screen.findByRole("region", { name: "Proposal" });
};

const column = (stage: string) => screen.getByRole("region", { name: stage });
const openValue = () => screen.getByTestId("summary-openValue").textContent;
const euros = (text: string | null) => Number(text?.replace(/[^\d]/g, ""));

const openMenu = (dealName: string) =>
  fireEvent.click(screen.getByRole("button", { name: `Actions for ${dealName}` }));

describe("Deals & Pipeline page", () => {
  it("shows the design's pipeline: stages, cards and totals", async () => {
    await renderPage();
    for (const stage of ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]) {
      expect(column(stage)).toBeTruthy();
    }
    expect(within(column("Proposal")).getByText("Northstar annual workspace")).toBeTruthy();
    expect(within(column("Negotiation")).getByText("Atlas operations rollout")).toBeTruthy();
    expect(openValue()).toBe("€97,900");
    expect(screen.getByTestId("summary-weightedValue").textContent).toBe("€61,765");
    expect(screen.getByTestId("summary-activeDeals").textContent).toBe("4");
    expect(within(column("Proposal")).getByText("70% likely")).toBeTruthy();
    expect(within(column("Proposal")).getByText("Close Oct 28")).toBeTruthy();
  });

  it("moving a deal from the card menu updates the board and the totals at once", async () => {
    await renderPage();
    const before = euros(openValue());

    openMenu("Atlas operations rollout");
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Won" }));

    // Optimistic: the card and the totals change before the API answers.
    expect(within(column("Won")).getByText("Atlas operations rollout")).toBeTruthy();
    expect(euros(openValue())).toBe(before - 42500);
    expect(screen.getByTestId("summary-winRate").textContent).toBe("100%");

    // And they stay that way once the server's numbers arrive.
    await waitFor(() => expect(euros(openValue())).toBe(before - 42500));
  });

  it("puts the deal back and shows an error when the API refuses the move", async () => {
    vi.spyOn(api.deals, "move").mockRejectedValue(new ApiError("FORBIDDEN", 403));
    await renderPage();
    const before = openValue();

    openMenu("Roam & Root launch");
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Lost" }));

    expect(await screen.findByText("You don't have permission to do this")).toBeTruthy();
    expect(within(column("Qualified")).getByText("Roam & Root launch")).toBeTruthy();
    expect(within(column("Lost")).queryByText("Roam & Root launch")).toBeNull();
    await waitFor(() => expect(openValue()).toBe(before));
  });

  it("adds a deal to the column it was started from", async () => {
    await renderPage();
    const before = euros(openValue());

    fireEvent.click(screen.getByRole("button", { name: "Add deal to Proposal" }));
    const dialog = screen.getByRole("dialog", { name: "Add an opportunity" });

    // Validation first: nothing is sent without a name and a value.
    fireEvent.click(within(dialog).getByRole("button", { name: "Create deal" }));
    expect(within(dialog).getByText("Give the deal a name")).toBeTruthy();
    expect(within(dialog).getByText("Enter a value of 0 or more")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Deal name"), { target: { value: "Haus am Fluss renewal" } });
    fireEvent.change(within(dialog).getByLabelText("Value"), { target: { value: "8000" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create deal" }));
    });

    expect(await within(column("Proposal")).findByText("Haus am Fluss renewal")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Deal added to the pipeline.")).toBeTruthy();
    expect(euros(openValue())).toBe(before + 8000);
  });

  it("edits a deal from its card", async () => {
    await renderPage();
    fireEvent.click(within(column("New")).getByRole("button", { name: "Klarwerk finance workspace" }));
    const dialog = screen.getByRole("dialog", { name: "Update this opportunity" });
    expect((within(dialog).getByLabelText("Deal name") as HTMLInputElement).value).toBe("Klarwerk finance workspace");

    fireEvent.change(within(dialog).getByLabelText("Deal name"), { target: { value: "Klarwerk finance suite" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    });
    expect(await within(column("New")).findByText("Klarwerk finance suite")).toBeTruthy();
  });

  it("deletes a deal after confirmation", async () => {
    await renderPage();
    openMenu("Northstar annual workspace");
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete Northstar annual workspace?" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete deal" }));
    });
    await waitFor(() => expect(screen.queryByText("Northstar annual workspace")).toBeNull());
    expect(screen.getByText("Deal deleted.")).toBeTruthy();
  });

  it("switches to the table view", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Table view" }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Expected close/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Board view" })).toBeTruthy();
  });

  it("shows an error with a retry when the pipeline cannot load", async () => {
    vi.spyOn(api, "pipelines").mockRejectedValueOnce(new ApiError("NETWORK_ERROR", 0));
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <ToastProvider>
          <DealsView />
        </ToastProvider>
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText("Can't reach the server. Check your connection.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Proposal" })).toBeTruthy();
  });
});
