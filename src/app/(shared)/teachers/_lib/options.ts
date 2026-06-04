import type { IlmiyDaraja, IlmiyUnvon, Stavka, IshTuri, FaoliyatHolati } from "@/types/db";

export const ILMIY_DARAJA_LABEL: Record<IlmiyDaraja, string> = {
  phd:       "PhD",
  dsc:       "DSc",
  darajasiz: "Darajasiz",
};

export const ILMIY_UNVON_LABEL: Record<IlmiyUnvon, string> = {
  professor: "Professor",
  dotsent:   "Dotsent",
  unvonsiz:  "Unvonsiz",
};

export const ISH_TURI_LABEL: Record<IshTuri, string> = {
  asosiy:                    "Asosiy",
  doktorant:                 "Doktorant",
  doktorant_shartnoma:       "Doktorant (shartnoma muddatli)",
  doktorant_ichki_orindosh:  "Doktorant/ichki o'rindosh",
  ichki_orindosh:            "Ichki o'rindosh",
  magistrant:                "Magistrant",
  shartnoma_muddatli:        "Shartnoma muddatli",
  tashqi_orindosh:           "Tashqi o'rindosh",
};

export const FAOLIYAT_LABEL: Record<FaoliyatHolati, string> = {
  faol:          "Faol",
  ishdan_ketgan: "Ishdan ketgan",
  tatilda:       "Ta'tilda",
};

export const FAOLIYAT_COLOR: Record<FaoliyatHolati, string> = {
  faol:          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  ishdan_ketgan: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  tatilda:       "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
};

export const STAVKA_OPTIONS: Stavka[] = ["0.25", "0.5", "0.75", "1.0", "1.25", "1.5"];

export const LAVOZIM_OPTIONS = [
  "Dotsent",
  "Dotsent v.b.",
  "Kafedra mudiri",
  "Katta o'qituvchi",
  "O'qituvchi",
  "O'qituvchi-stajyor",
  "Professor",
  "Professor v.b.",
];

export interface TeacherFormState {
  full_name: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  birth_date: string;
  gender: string;
  phone: string;
  email: string;

  ilmiy_daraja: string;
  ilmiy_unvon: string;
  lavozim: string;
  stavka: string;
  ish_turi: string;
  ishga_kirgan_sana: string;
  faoliyat_holati: string;
  faculty_id: string;
  department_id: string;
}

// Case/apostrophe-insensitive slug resolver — safe to import in server routes
const normLabel = (s: string) => s.trim().toLowerCase().replace(/[''ʼ`]/g, "'");
export function labelToSlug<T extends string>(map: Record<T, string>, value: string): T | null {
  const n = normLabel(value);
  for (const [k, v] of Object.entries(map) as [T, string][]) {
    if (normLabel(v) === n || normLabel(k) === n) return k;
  }
  return null;
}

export const EMPTY_FORM: TeacherFormState = {
  full_name: "", last_name: "", first_name: "", middle_name: "",
  birth_date: "", gender: "",
  phone: "", email: "",
  ilmiy_daraja: "", ilmiy_unvon: "", lavozim: "",
  stavka: "", ish_turi: "",
  ishga_kirgan_sana: "", faoliyat_holati: "faol",
  faculty_id: "", department_id: "",
};
