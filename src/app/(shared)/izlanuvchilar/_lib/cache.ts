import type { Izlanuvchi, IzlanuvchiTuri } from "@/types/db";

const registryCache: Record<IzlanuvchiTuri, Izlanuvchi[] | null> = {
  doktorant: null,
  mustaqil: null,
};

export function getIzlanuvchilarCache(turi: IzlanuvchiTuri) {
  return registryCache[turi];
}

export function setIzlanuvchilarCache(
  turi: IzlanuvchiTuri,
  rows: Izlanuvchi[]
) {
  registryCache[turi] = rows;
}

export function invalidateIzlanuvchilarCache(turi?: IzlanuvchiTuri) {
  if (turi) {
    registryCache[turi] = null;
    return;
  }
  registryCache.doktorant = null;
  registryCache.mustaqil = null;
}
