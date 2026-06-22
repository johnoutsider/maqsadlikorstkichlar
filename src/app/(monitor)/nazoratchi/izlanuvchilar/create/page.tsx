import { IzlanuvchiForm } from "@/app/(shared)/izlanuvchilar/_components/IzlanuvchiForm";
import type { IzlanuvchiTuri } from "@/types/db";

export default async function MonitorCreateIzlanuvchiPage({
  searchParams,
}: {
  searchParams: Promise<{ turi?: string }>;
}) {
  const params = await searchParams;
  const turi: IzlanuvchiTuri =
    params.turi === "mustaqil" ? "mustaqil" : "doktorant";

  return (
    <IzlanuvchiForm
      initialTuri={turi}
      basePath="/nazoratchi/izlanuvchilar"
    />
  );
}
