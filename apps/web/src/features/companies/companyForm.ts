import { z } from "zod";
import { companySchema, companySizeSchema, type Company, type CompanyCreateInput } from "@lulu/shared";

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
});

export type CompanyFormValues = z.infer<typeof companyFormSchema>;

export function toFormValues(company: Company | null, defaultOwnerId: string): CompanyFormValues {
  return {
    name: company?.name ?? "",
    domain: company?.domain ?? "",
    industry: company?.industry ?? "",
    size: company?.size ?? "",
    ownerId: company?.ownerId ?? defaultOwnerId,
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
  };
}
