import type { IlmiyDaraja, IlmiyUnvon, Stavka, IshTuri, FaoliyatHolati } from "@/types/db";

export const ILMIY_DARAJA_LABEL: Record<IlmiyDaraja, string> = {
  fan_doktori: "Fan doktori",
  fan_nomzodi: "Fan nomzodi",
  phd:         "PhD",
  yoq:         "Yo'q",
};

export const ILMIY_UNVON_LABEL: Record<IlmiyUnvon, string> = {
  professor:       "Professor",
  dotsent:         "Dotsent",
  katta_oqituvchi: "Katta o'qituvchi",
  oqituvchi:       "O'qituvchi",
  assistent:       "Assistent",
};

export const ISH_TURI_LABEL: Record<IshTuri, string> = {
  asosiy:   "Asosiy",
  orindosh: "O'rindosh",
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
  "Professor",
  "Dotsent",
  "Katta o'qituvchi",
  "O'qituvchi",
  "Assistent",
  "Laborant",
  "Katta laborant",
  "Kafedra mudiri",
  "Boshqa",
];

export interface TeacherFormState {
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

export const EMPTY_FORM: TeacherFormState = {
  last_name: "", first_name: "", middle_name: "",
  birth_date: "", gender: "",
  phone: "", email: "",
  ilmiy_daraja: "", ilmiy_unvon: "", lavozim: "",
  stavka: "", ish_turi: "",
  ishga_kirgan_sana: "", faoliyat_holati: "faol",
  faculty_id: "", department_id: "",
};
