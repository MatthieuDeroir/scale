import { getTranslations } from "next-intl/server";
import { ActivityLog } from "@/features/activity";
import { PageHeader } from "@/shared/ui";
import { guard } from "../_components/guard";

export const metadata = { title: "Journal" };

export default async function ActivitePage() {
  await guard("ADMIN");
  const t = await getTranslations("activity");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ActivityLog />
    </>
  );
}
