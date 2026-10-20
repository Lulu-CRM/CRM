import { afterEach, describe, expect, it, vi } from "vitest";
import { apiAreas, chooseApi } from "./index";
import { mockApi } from "./mock";
import { realApi } from "./real";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chooseApi", () => {
  it("uses sample data everywhere by default", () => {
    const { api, realAreas } = chooseApi(undefined, undefined);
    expect(realAreas).toEqual([]);
    for (const area of apiAreas) expect(api[area]).toBe(mockApi[area]);
  });

  it("uses the real API everywhere when mock mode is off", () => {
    const { api, realAreas } = chooseApi("false", "contacts");
    expect(realAreas).toEqual(apiAreas);
    expect(api).toBe(realApi);
  });

  it("switches only the listed areas to the real API", () => {
    const { api, realAreas } = chooseApi("true", " me, users ,contacts,companies,");
    expect(realAreas.sort()).toEqual(["auth", "companies", "contacts", "me", "users"]);
    // Sign-in follows any real area, so login gets a real token.
    expect(api.auth).toBe(realApi.auth);
    expect(api.contacts).toBe(realApi.contacts);
    expect(api.me).toBe(realApi.me);
    expect(api.deals).toBe(mockApi.deals);
    expect(api.segments).toBe(mockApi.segments);
  });

  it("ignores and reports unknown areas", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { realAreas } = chooseApi(undefined, "contacts,dealz");
    expect(realAreas.sort()).toEqual(["auth", "contacts"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("dealz"));
  });

  it("covers every area of the real API in the mock too", () => {
    for (const area of apiAreas) expect(mockApi[area as keyof typeof mockApi]).toBeDefined();
  });
});
