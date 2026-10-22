import { CRM_HOME } from "@/config/navigation";
import { redirect } from "@/i18n/navigation";

export default async function CrmIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: CRM_HOME, locale });
}
