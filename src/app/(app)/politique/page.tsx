import { getTranslations } from "next-intl/server";
import { RawPolicyEditor } from "@/features/acl";
import { PageHeader } from "@/shared/ui";
import { guard } from "../_components/guard";

export const metadata = { title: "Politique ACL" };

export default async function PolitiquePage() {
  await guard("OPERATOR");
  const t = await getTranslations("acl");
  return (
    <>
      <PageHeader title={t("rawTitle")} description={t("rawDescription")} />
      <RawPolicyEditor />
    </>
  );
}
