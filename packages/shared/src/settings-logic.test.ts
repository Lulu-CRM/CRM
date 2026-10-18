import { describe, expect, it } from "vitest";
import {
  consentSettingsSchema,
  customFieldCreateSchema,
  notificationSettingsSchema,
  rolePermissionsSchema,
  stageUpdateSchema,
} from "./settings";
import { can, defaultConsentSettings, defaultNotificationSettings, defaultPermissions, fieldKeyFromLabel } from "./settings-logic";

describe("defaults", () => {
  it("match the schemas", () => {
    expect(() => rolePermissionsSchema.parse(defaultPermissions)).not.toThrow();
    expect(() => consentSettingsSchema.parse(defaultConsentSettings)).not.toThrow();
    expect(() => notificationSettingsSchema.parse(defaultNotificationSettings)).not.toThrow();
  });

  it("import contacts without marketing consent", () => {
    expect(defaultConsentSettings.importedContactsConsent).toBe("not_granted");
  });
});

describe("can", () => {
  it("lets owners do everything", () => {
    expect(can(defaultPermissions, "owner", "settings", "delete")).toBe(true);
  });

  it("stops members from deleting and from changing settings", () => {
    expect(can(defaultPermissions, "member", "contacts", "edit")).toBe(true);
    expect(can(defaultPermissions, "member", "contacts", "delete")).toBe(false);
    expect(can(defaultPermissions, "member", "settings", "view")).toBe(false);
  });

  it("treats anything missing as not allowed", () => {
    expect(can({ admin: {}, member: {} } as never, "admin", "deals", "view")).toBe(false);
  });
});

describe("custom field schemas", () => {
  it("need options for a select field", () => {
    expect(customFieldCreateSchema.safeParse({ key: "tier", label: "Tier", type: "select" }).success).toBe(false);
    expect(customFieldCreateSchema.safeParse({ key: "tier", label: "Tier", type: "select", options: ["Gold"] }).success).toBe(true);
  });

  it("accept only simple lowercase keys", () => {
    expect(customFieldCreateSchema.safeParse({ key: "Preferred Language", label: "x", type: "text" }).success).toBe(false);
    expect(customFieldCreateSchema.safeParse({ key: "preferred_language", label: "x", type: "text" }).data?.options).toEqual([]);
  });

  it("do not let an edit change the key or the type", () => {
    expect(stageUpdateSchema.parse({ name: "Demo", key: "x" })).toEqual({ name: "Demo" });
  });
});

describe("fieldKeyFromLabel", () => {
  it("turns a label into a key", () => {
    expect(fieldKeyFromLabel("Preferred language", [])).toBe("preferred_language");
    expect(fieldKeyFromLabel("Größe der Firma", [])).toBe("grosse_der_firma");
    expect(fieldKeyFromLabel("2026 renewal", [])).toBe("f_2026_renewal");
    // Labels with no Latin letters get a neutral key; the label itself stays as typed.
    expect(fieldKeyFromLabel("客户等级", [])).toBe("field");
  });

  it("keeps keys unique", () => {
    expect(fieldKeyFromLabel("Tier", ["tier", "tier_2"])).toBe("tier_3");
  });
});
