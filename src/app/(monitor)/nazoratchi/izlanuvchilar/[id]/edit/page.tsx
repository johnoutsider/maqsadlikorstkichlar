import { IzlanuvchiForm } from "@/app/(shared)/izlanuvchilar/_components/IzlanuvchiForm";

export default async function MonitorEditIzlanuvchiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <IzlanuvchiForm
      initialTuri="mustaqil"
      recordId={id}
      basePath="/nazoratchi/izlanuvchilar"
    />
  );
}
