import { z } from "zod";
import { DIAL_CODES, joinPhone, splitPhone } from "@/lib/phone";
import { companySchema, companySizeSchema, lifecycleStageSchema, type Company, type CompanyCreateInput } from "@lulu/shared";

// "https://www.Acme.com/about" -> "acme.com", so people can paste a link.
export function cleanDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
}

const domainField = companySchema.shape.domain.unwrap();

// The form works with plain strings. Messages are translation keys under companies.form.errors.
export const companyFormSchema = z.object({
  name: z.string().trim().min(1, "nameRequired"),
  domain: z.string().refine((value) => value.trim() === "" || domainField.safeParse(cleanDomain(value)).success, "domainInvalid"),
  industry: z.string(),
  size: z.union([z.literal(""), companySizeSchema]),
  ownerId: z.string().min(1, "ownerRequired"),
  // Added at Dave's request (Oct 23, 2026).
  leadStatus: z.union([z.literal(""), lifecycleStageSchema]),
  // WhatsApp as a country (its calling code) plus the number (Dave, Oct 24, 2026).
  whatsappCountry: z.string().refine((code) => code in DIAL_CODES, "countryInvalid"),
  whatsappNumber: z.string().refine((value) => value.replace(/\D/g, "").length <= 15, "tooLong"),
  instagram: z.string().max(200, "tooLong"),
  facebook: z.string().max(200, "tooLong"),
  productService: z.string().max(200, "tooLong"),
  // A first note, saved as a shared note on the new company (only when adding).
  note: z.string().max(10000, "tooLong"),
  // Existing contacts who work at this company (Dave, Oct 24, 2026). Saved as each contact's company.
  contactIds: z.array(z.string()),
});

export type CompanyFormValues = z.infer<typeof companyFormSchema>;

export function toFormValues(
  company: Company | null,
  defaultOwnerId: string,
  defaultCountry = "DE",
  contactIds: string[] = [],
): CompanyFormValues {
  const whatsapp = splitPhone(company?.whatsapp, defaultCountry);
  return {
    name: company?.name ?? "",
    domain: company?.domain ?? "",
    industry: company?.industry ?? "",
    size: company?.size ?? "",
    ownerId: company?.ownerId ?? defaultOwnerId,
    leadStatus: company?.leadStatus ?? "",
    whatsappCountry: whatsapp.country,
    whatsappNumber: whatsapp.number,
    instagram: company?.instagram ?? "",
    facebook: company?.facebook ?? "",
    productService: company?.productService ?? "",
    note: "",
    contactIds,
  };
}

// Empty fields become null, so clearing a field in edit mode clears it on the server too.
export function toCompanyInput(values: CompanyFormValues): CompanyCreateInput {
  const orNull = (value: string) => (value.trim() === "" ? null : value.trim());
  return {
    name: values.name.trim(),
    domain: orNull(cleanDomain(values.domain)),
    industry: orNull(values.industry),
    size: values.size === "" ? null : values.size,
    ownerId: values.ownerId,
    leadStatus: values.leadStatus === "" ? null : values.leadStatus,
    whatsapp: orNull(joinPhone(values.whatsappCountry, values.whatsappNumber)),
    instagram: orNull(values.instagram),
    facebook: orNull(values.facebook),
    productService: orNull(values.productService),
  };
}

/** The note typed in the form, as a shared note on the company: its first line is the title. */
export function toFirstNote(values: CompanyFormValues, companyId: string) {
  const body = values.note.trim();
  if (body === "") return null;
  const firstLine = body.split("\n", 1)[0]!.trim();
  const title = firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
  return { title, body, visibility: "shared" as const, recordType: "company" as const, recordId: companyId };
}
