import { IzlanuvchilarTable } from "@/app/(shared)/izlanuvchilar/_components/IzlanuvchilarTable";

export default function MonitorMustaqilIzlanuvchilarPage() {
  return (
    <IzlanuvchilarTable
      turi="mustaqil"
      title="Mustaqil izlanuvchilar"
      basePath="/nazoratchi/izlanuvchilar"
    />
  );
}
