// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

beforeEach(async () => {
  vi.resetModules();
  window.history.replaceState(null, "", "/en/crm/pipeline");
  const { PipelinePage } = await import("./PipelinePage");
  const { ToastProvider } = await import("@/components/ui");
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ToastProvider>
        <PipelinePage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const slow = { timeout: 3000 };

describe("Leads & Deals page", () => {
  it("starts on the lead board, with the last column called Converted", async () => {
    expect(screen.getByRole("tab", { name: /^Leads/ }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByRole("region", { name: "Converted" }, slow)).toBeTruthy();
  });

  it("switches to the deal pipeline and keeps it in the address", async () => {
    fireEvent.click(screen.getByRole("tab", { name: /^Deals & Pipeline/ }));
    expect(screen.getByRole("tab", { name: /^Deals & Pipeline/ }).getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(screen.getByText("Northstar annual workspace")).toBeTruthy(), slow);
    expect(window.location.search).toBe("?view=deals");
  });
});
