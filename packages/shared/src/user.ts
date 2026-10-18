import { z } from "zod";
import { baseRecordSchema } from "./common";

export const roleSchema = z.enum(["owner", "admin", "member"]);

// GET /users and GET /me (the user part).
export const userSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  email: z.email(),
  role: roleSchema,
  language: z.string().min(2),
});

export type Role = z.infer<typeof roleSchema>;
export type User = z.infer<typeof userSchema>;
