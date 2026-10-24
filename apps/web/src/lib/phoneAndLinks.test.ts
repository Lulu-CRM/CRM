import { describe, expect, it } from "vitest";
import { defaultCountry, joinPhone, splitPhone } from "./phone";
import { facebookUrl, instagramUrl, whatsappUrl } from "./socialLinks";

describe("WhatsApp number", () => {
  it("joins country code and number, dropping spaces and a leading zero", () => {
    expect(joinPhone("DE", "0176 414 74606")).toBe("+4917641474606");
    expect(joinPhone("NG", "803-123-4567")).toBe("+2348031234567");
    expect(joinPhone("DE", "  ")).toBe("");
  });

  it("splits a stored number back into country and number", () => {
    expect(splitPhone("+4917641474606", "NG")).toEqual({ country: "DE", number: "17641474606" });
    expect(splitPhone("+2348031234567", "DE")).toEqual({ country: "NG", number: "8031234567" });
    // +1 is shared: the user's own country wins when it fits, else the US.
    expect(splitPhone("+12025550123", "CA")).toEqual({ country: "CA", number: "2025550123" });
    expect(splitPhone("+12025550123", "DE")).toEqual({ country: "US", number: "2025550123" });
    // Numbers typed before the picker existed, without a +, keep their digits.
    expect(splitPhone("0176 41474606", "DE")).toEqual({ country: "DE", number: "017641474606" });
  });

  it("starts with the country of the user's language, or Germany", () => {
    expect(defaultCountry("en-NG")).toBe("NG");
    expect(defaultCountry("de")).toBe("DE");
    expect(defaultCountry(undefined)).toBe("DE");
  });
});

describe("channel links", () => {
  it("opens a WhatsApp chat", () => {
    expect(whatsappUrl("+49 176 41474606")).toBe("https://wa.me/4917641474606");
    expect(whatsappUrl("12")).toBeNull();
  });

  it("opens Instagram and Facebook profiles from a handle or a link", () => {
    expect(instagramUrl("davidk1504_official")).toBe("https://instagram.com/davidk1504_official");
    expect(instagramUrl("@blueharbor")).toBe("https://instagram.com/blueharbor");
    expect(instagramUrl("https://www.instagram.com/blueharbor/")).toBe("https://instagram.com/blueharbor/");
    expect(facebookUrl("facebook.com/blueharbor")).toBe("https://facebook.com/blueharbor");
    expect(facebookUrl("Blue.Harbor")).toBe("https://facebook.com/Blue.Harbor");
    // Not a profile: shown as text, not as a link.
    expect(instagramUrl("https://example.com/x")).toBeNull();
    expect(facebookUrl("Blue Harbor Boats")).toBeNull();
  });
});
