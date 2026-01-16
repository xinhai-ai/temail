import { ForwardRuleBuilderPage } from "@/app/(dashboard)/forwards/new/page";

export default async function EditForwardRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ForwardRuleBuilderPage mode="edit" ruleId={id} />;
}

