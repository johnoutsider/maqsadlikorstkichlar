import type { Izlanuvchi, IzlanuvchiTuri } from "@/types/db";
import { buildFullName, splitFullName } from "@/lib/doktorant-profile";
import { genderLabel } from "@/app/(shared)/izlanuvchilar/_lib/options";

export type IzlanuvchiMetadata = {
  birth_date?: string;
  nationality?: string;
  citizenship?: string;
  country?: string;
  region?: string;
  address?: string;
};

export type IzlanuvchiFormState = {
  turi: IzlanuvchiTuri;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  age: string;
  gender: string;
  nationality: string;
  citizenship: string;
  pinfl: string;
  phone: string;
  educationStage: string;
  specialtyName: string;
  specialtyCode: string;
  admissionYear: string;
  submissionDate: string;
  course: string;
  talimTili: string;
  chorak: string;
  status: string;
  himoyaHolati: string;
  monitoring1: string;
  monitoring2: string;
  monitoring3: string;
  district: string;
  researchTopic: string;
  supervisorName: string;
  country: string;
  region: string;
  address: string;
};

export function emptyIzlanuvchiForm(turi: IzlanuvchiTuri): IzlanuvchiFormState {
  return {
    turi,
    lastName: "",
    firstName: "",
    middleName: "",
    birthDate: "",
    age: "",
    gender: "Erkak",
    nationality: "O'zbek",
    citizenship: "O'zbekiston Respublikasi",
    pinfl: "",
    phone: "",
    educationStage:
      turi === "mustaqil"
        ? "Mustaqil tadqiqotchi, PhD"
        : "Tayanch doktorantura, PhD",
    specialtyName: "",
    specialtyCode: "",
    admissionYear: new Date().getFullYear().toString(),
    submissionDate: "",
    course: "",
    talimTili: "",
    chorak: "",
    status: "Talabgor o'qishga qabul qilingan",
    himoyaHolati: "",
    monitoring1: "",
    monitoring2: "",
    monitoring3: "",
    district: "",
    researchTopic: "",
    supervisorName: "",
    country: "O'zbekiston",
    region: "",
    address: "",
  };
}

export function formFromIzlanuvchi(row: Izlanuvchi): IzlanuvchiFormState {
  const name = splitFullName(row.full_name);
  const metadata = (row.metadata ?? {}) as IzlanuvchiMetadata;

  return {
    ...emptyIzlanuvchiForm(row.turi),
    turi: row.turi,
    lastName: name.lastName,
    firstName: name.firstName,
    middleName: name.middleName,
    birthDate: metadata.birth_date ?? "",
    age: row.age?.toString() ?? "",
    gender: genderLabel(row.gender) || "Erkak",
    nationality: metadata.nationality ?? "O'zbek",
    citizenship: metadata.citizenship ?? "O'zbekiston Respublikasi",
    pinfl: row.pinfl ?? "",
    phone: row.phone ?? "",
    educationStage: row.education_stage ?? "",
    specialtyName: row.specialty_name ?? "",
    specialtyCode: row.specialty_code ?? "",
    admissionYear: row.admission_year ?? "",
    submissionDate: row.submission_date ?? "",
    course: row.course ?? "",
    talimTili: row.talim_tili ?? "",
    chorak: row.chorak ?? "",
    status: row.status ?? "",
    himoyaHolati: row.himoya_holati ?? "",
    monitoring1: row.monitoring_1 ?? "",
    monitoring2: row.monitoring_2 ?? "",
    monitoring3: row.monitoring_3 ?? "",
    district: row.district ?? "",
    researchTopic: row.research_topic ?? "",
    supervisorName: row.supervisor_name ?? "",
    country: metadata.country ?? "O'zbekiston",
    region: metadata.region ?? "",
    address: metadata.address ?? "",
  };
}

export function buildIzlanuvchiPayload(form: IzlanuvchiFormState) {
  const age = form.age.trim() ? Number.parseInt(form.age, 10) : null;

  return {
    turi: form.turi,
    full_name: buildFullName(form.lastName, form.firstName, form.middleName),
    specialty_name: form.specialtyName.trim() || null,
    specialty_code: form.specialtyCode.trim() || null,
    education_stage: form.educationStage.trim() || null,
    admission_year: form.admissionYear.trim() || null,
    age: Number.isFinite(age) ? age : null,
    gender: form.gender === "Ayol" ? "ayol" : "erkak",
    pinfl: form.pinfl.trim().replace(/\s+/g, "") || null,
    submission_date: form.submissionDate || null,
    course: form.course.trim() || null,
    monitoring_1: form.monitoring1.trim() || null,
    monitoring_2: form.monitoring2.trim() || null,
    monitoring_3: form.monitoring3.trim() || null,
    district: form.district.trim() || null,
    research_topic: form.researchTopic.trim() || null,
    supervisor_name: form.supervisorName.trim() || null,
    status: form.status.trim() || null,
    talim_tili: form.talimTili.trim() || null,
    chorak: form.chorak.trim() || null,
    phone: form.phone.trim() || null,
    himoya_holati: form.himoyaHolati.trim() || null,
    metadata: {
      birth_date: form.birthDate || "",
      nationality: form.nationality.trim(),
      citizenship: form.citizenship.trim(),
      country: form.country.trim(),
      region: form.region.trim(),
      address: form.address.trim(),
    } satisfies IzlanuvchiMetadata,
  };
}
