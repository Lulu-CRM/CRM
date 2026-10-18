import { describe, expect, it } from "vitest";
import { noteCreateSchema } from "./note";

describe("noteCreateSchema", () => {
    it("accepts a note linked to a record", () => {
        const result = noteCreateSchema.safeParse({
        title: "Call notes",
        body: "Prefers mornings",
        recordType: "contact",
        recordId: "c1",
        });
        expect(result.success).toBe(true);
    });

    it("accepts a note with no link", () => {
        expect(noteCreateSchema.safeParse({ title: "Idea", body: "" }).success).toBe(true);
    });

    it("rejects a half link", () => {
        const result = noteCreateSchema.safeParse({ title: "Idea", body: "", recordType: "deal" });
        expect(result.success).toBe(false);
    });
});