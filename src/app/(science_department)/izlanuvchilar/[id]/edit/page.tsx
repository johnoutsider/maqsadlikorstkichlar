import { IzlanuvchiForm } from "@/app/(shared)/izlanuvchilar/_components/IzlanuvchiForm";

export default async function EditIzlanuvchiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IzlanuvchiForm initialTuri="doktorant" recordId={id} />;
}
