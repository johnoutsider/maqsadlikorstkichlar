import { IzlanuvchilarTable } from "@/app/(shared)/izlanuvchilar/_components/IzlanuvchilarTable";

export default function MonitorDoktorantlarPage() {
  return (
    <IzlanuvchilarTable
      turi="doktorant"
      title="Doktorant va stajor-tadqiqotchilar"
      basePath="/nazoratchi/izlanuvchilar"
    />
  );
}
