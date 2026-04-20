export const STATUS_LABELS: Record<string, string> = {
  draft: "Qoralama",
  pending: "Ko'rib chiqilmoqda",
  pending_dean: "Dekan tasdiqlashi kutilmoqda",
  pending_science: "Ilmiy bo'lim tasdiqlashi kutilmoqda",
  needs_revision: "Qayta ko'rib chiqish kerak",
  approved: "Tasdiqlangan",
  rejected: "Qaytarilgan"
};

export const QUARTER_LABELS: Record<string, string> = {
  Q1: "1-chorak",
  Q2: "2-chorak",
  Q3: "3-chorak",
  Q4: "4-chorak"
};

export const ACCEPTED_FILE_TYPES = [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".xlsx"];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const INDICATOR_IDS_ORDERED = [
  "ind1", "ind2", "ind3", "ind4", "ind5", "ind6", "ind7", "ind8", 
  "ind9", "ind10", "ind11", "ind12a", "ind12b", "ind12c", "ind12d", 
  "ind13", "ind14", "ind15", "ind16", "ind17", "ind18", "ind19"
];

export const ERROR_MESSAGES = {
  invalidLogin: "Email yoki parol noto'g'ri",
  fileTooLarge: "Fayl hajmi 10MB dan oshmasligi kerak",
  invalidFileType: "Noto'g'ri fayl formati",
  unknownError: "Noma'lum xatolik yuz berdi"
};

export const THEME_STORAGE_KEY = "ikt-theme";

export const FACULTIES = [
  { id: "ENG1",   name: "Ingliz tili № 1 fakulteti",      shortCode: "ENG1"   },
  { id: "ENG2",   name: "Ingliz tili № 2 fakulteti",      shortCode: "ENG2"   },
  { id: "ENG3",   name: "Ingliz tili № 3 fakulteti",      shortCode: "ENG3"   },
  { id: "RUS",    name: "Rus filologiyasi fakulteti",      shortCode: "RUS"    },
  { id: "JUR",    name: "Xalqaro jurnalistika fakulteti",  shortCode: "JUR"    },
  { id: "TAR",    name: "Tarjimonlik fakulteti",           shortCode: "TAR"    },
  { id: "ENGFIL", name: "Ingliz filologiyasi fakulteti",   shortCode: "ENGFIL" },
  { id: "SHARQ",  name: "Sharq filologiyasi fakulteti",    shortCode: "SHARQ"  },
  { id: "ROMGER", name: "Roman-german fakulteti",          shortCode: "ROMGER" },
];

export const DEPARTMENTS = [
  // Ingliz 1
  { id: "ENG1_AF1",   name: "Ingliz tili amaliy fanlar №1",                    facultyId: "ENG1", shortCode: "AF1" },
  { id: "ENG1_IK1",   name: "Ingliz tili integrallashgan kurs №1",             facultyId: "ENG1", shortCode: "IK1" },
  { id: "ENG1_NA1",   name: "Ingliz tili nazariy aspektlari №1",               facultyId: "ENG1", shortCode: "NA1" },
  { id: "ENG1_BTM1",  name: "Ingliz tilni o'qitish metodikasi №1",             facultyId: "ENG1", shortCode: "BTM1" },
  { id: "ENG1_LING",  name: "Lingvistika va ingliz adabiyoti",                 facultyId: "ENG1", shortCode: "LING" },
  { id: "ENG1_UT",    name: "Umumiy tilshunoslik",                             facultyId: "ENG1", shortCode: "UT" },
  { id: "ENG1_PP",    name: "Pedagogika va psixologiya",                       facultyId: "ENG1", shortCode: "PP" },
  // Ingliz 2
  { id: "ENG2_AF2",   name: "Ingliz tili amaliy fanlar №2",                    facultyId: "ENG2", shortCode: "AF2" },
  { id: "ENG2_IK2",   name: "Ingliz tili integrallashgan kurs №2",             facultyId: "ENG2", shortCode: "IK2" },
  { id: "ENG2_NA2",   name: "Ingliz tili nazariy aspektlari №2",               facultyId: "ENG2", shortCode: "NA2" },
  { id: "ENG2_BTM2",  name: "Ingliz tilni o'qitish metodikasi №2",             facultyId: "ENG2", shortCode: "BTM2" },
  { id: "ENG2_JT",    name: "Jismoniy tarbiya va sport",                       facultyId: "ENG2", shortCode: "JT" },
  // Ingliz 3
  { id: "ENG3_AF3",   name: "Ingliz tili amaliy fanlar №3",                    facultyId: "ENG3", shortCode: "AF3" },
  { id: "ENG3_IK3",   name: "Ingliz tili integrallashgan kurs №3",             facultyId: "ENG3", shortCode: "IK3" },
  { id: "ENG3_NA3",   name: "Ingliz tili nazariy aspektlari №3",               facultyId: "ENG3", shortCode: "NA3" },
  { id: "ENG3_BTM3",  name: "Ingliz tilni o'qitish metodikasi №3",             facultyId: "ENG3", shortCode: "BTM3" },
  { id: "ENG3_BIT",   name: "Boshlang'ich ta'limda ingliz tili",               facultyId: "ENG3", shortCode: "BIT" },
  // Ingliz filologiyasi
  { id: "ENGFIL_FL",  name: "Ingliz funksional leksika",                       facultyId: "ENGFIL", shortCode: "FL" },
  { id: "ENGFIL_BTM", name: "Ingliz tilni o'qitish metodikasi va ta'lim",      facultyId: "ENGFIL", shortCode: "BTM" },
  { id: "ENGFIL_NF",  name: "Ingliz tili nazariy fanlar",                      facultyId: "ENGFIL", shortCode: "NF" },
  // Sharq filologiyasi
  { id: "SHARQ_KNA",  name: "Koreys tili nazariyasi va amaliyoti",             facultyId: "SHARQ", shortCode: "KNA" },
  { id: "SHARQ_YNA",  name: "Yapon tili nazariyasi va amaliyoti",              facultyId: "SHARQ", shortCode: "YNA" },
  { id: "SHARQ_ANA",  name: "Arab tili nazariyasi va amaliyoti",               facultyId: "SHARQ", shortCode: "ANA" },
  { id: "SHARQ_OVA",  name: "O'zbek tili va adabiyoti",                        facultyId: "SHARQ", shortCode: "OVA" },
  { id: "SHARQ_JA",   name: "Jahon adabiyoti",                                 facultyId: "SHARQ", shortCode: "JA" },
  // Roman-german filologiyasi
  { id: "ROMGER_NAF", name: "Nemis tili amaliy fanlar",                        facultyId: "ROMGER", shortCode: "NAF" },
  { id: "ROMGER_NNF", name: "Nemis tili nazariy fanlar",                       facultyId: "ROMGER", shortCode: "NNF" },
  { id: "ROMGER_FAF", name: "Fransuz tili amaliy fanlar",                      facultyId: "ROMGER", shortCode: "FAF" },
  { id: "ROMGER_FNF", name: "Fransuz tili nazariy fanlar",                     facultyId: "ROMGER", shortCode: "FNF" },
  // Rus filologiyasi
  { id: "RUS_RAF",    name: "Rus tili amaliy fanlar",                          facultyId: "RUS", shortCode: "RAF" },
  { id: "RUS_RNF",    name: "Ispaniya tili nazariy fanlar",                    facultyId: "RUS", shortCode: "RNF" },
  { id: "RUS_RTM",    name: "Rus tilni o'qitish metodikasi",                   facultyId: "RUS", shortCode: "RTM" },
  { id: "RUS_RAM",    name: "Rus adabiyoti va qiyosiy metodikasi",             facultyId: "RUS", shortCode: "RAM" },
  { id: "RUS_KZT",    name: "Xorijiy zamonaviy tillar",                        facultyId: "RUS", shortCode: "KZT" },
  // Tarjimonlik
  { id: "TAR_TAF",    name: "Ingliz tili amaliy tarjima",                      facultyId: "TAR", shortCode: "TAF" },
  { id: "TAR_TNF",    name: "Ingliz tili tarjima nazariyasi",                  facultyId: "TAR", shortCode: "TNF" },
  { id: "TAR_KGT",    name: "Koman german tillar tarjimashunoslik",            facultyId: "TAR", shortCode: "KGT" },
  { id: "TAR_ANA",    name: "Arab tili tarjima nazariyasi va amaliyoti",        facultyId: "TAR", shortCode: "ANA" },
  { id: "TAR_OT",     name: "O'zbekiston tarixi",                              facultyId: "TAR", shortCode: "OT" },
  { id: "TAR_TF",     name: "Tabiiy fanlar",                                   facultyId: "TAR", shortCode: "TF" },
  { id: "TAR_ITN",    name: "Italyan tili tarjima nazariyasi",                 facultyId: "TAR", shortCode: "ITN" },
  // Xalqaro jurnalistika
  { id: "JUR_AXJ",    name: "Axborot huquqi va jurnalistika",                  facultyId: "JUR", shortCode: "AXJ" },
  { id: "JUR_MKI",    name: "Madaniyatlararo kommunikatsiyaning lingvistik tamoyillari", facultyId: "JUR", shortCode: "MKI" },
  { id: "JUR_JF",     name: "Jismoniy fanlar",                                 facultyId: "JUR", shortCode: "JF" },
  { id: "JUR_ICT",    name: "Ikkinchi chet tili",                              facultyId: "JUR", shortCode: "ICT" },
  { id: "JUR_ZAT",    name: "Zamonaviy axborot texnologiyalari",               facultyId: "JUR", shortCode: "ZAT" },
];

export const INDICATORS = [
  { id: "ind1",  no: "1",   name: "Ilmiy darajaga ega bo'lgan professor-o'qituvchilar ulushi",                              unit: "%",        order: 1,  isSubIndicator: false },
  { id: "ind2",  no: "2",   name: "Dissertatsiya himoyalari soni",                                                           unit: "nafar",    order: 2,  isSubIndicator: false },
  { id: "ind3",  no: "3",   name: "Ilmiy unvonga ega professor-o'qituvchilar soni",                                          unit: "nafar",    order: 3,  isSubIndicator: false },
  { id: "ind4",  no: "4",   name: "Ilmiy faoliyatga oid mahalliy grantlar uchun loyihalar",                                  unit: "dona",     order: 4,  isSubIndicator: false },
  { id: "ind5",  no: "5",   name: "Ilmiy faoliyatga oid xorijiy grantlar uchun loyihalar",                                   unit: "dona",     order: 5,  isSubIndicator: false },
  { id: "ind6",  no: "6",   name: "OAK ro'yxatiga kirgan ilmiy jurnallardagi maqolalar",                                     unit: "dona",     order: 6,  isSubIndicator: false },
  { id: "ind7",  no: "7",   name: "Xorijiy ilmiy jurnallarda chop qilingan maqolalar",                                       unit: "dona",     order: 7,  isSubIndicator: false },
  { id: "ind8",  no: "8",   name: "Scopus, Science Direct, Web of Science va boshqa xalqaro bazalardagi maqolalar",          unit: "dona",     order: 8,  isSubIndicator: false },
  { id: "ind9",  no: "9",   name: "Xalqaro ilmiy-amaliy konferensiyalarda tezislar",                                         unit: "dona",     order: 9,  isSubIndicator: false },
  { id: "ind10", no: "10",  name: "Respublika ilmiy-amaliy konferensiyalarda tezislar",                                      unit: "dona",     order: 10, isSubIndicator: false },
  { id: "ind11", no: "11",  name: "Xalqaro hammualliflar bilan birgalikda chop etiladigan maqolalar",                        unit: "dona",     order: 11, isSubIndicator: false },
  { id: "ind12a",no: "12a", name: "H-indeks ≥5 (umumiy) bo'lgan professor-o'qituvchilar soni",                               unit: "nafar",    order: 12, isSubIndicator: true  },
  { id: "ind12b",no: "12b", name: "Scopus bazasida H-indeks ≥2 bo'lgan professor-o'qituvchilar soni",                        unit: "nafar",    order: 13, isSubIndicator: true  },
  { id: "ind12c",no: "12c", name: "Web of Science bazasida H-indeks ≥2 bo'lgan professor-o'qituvchilar soni",                unit: "nafar",    order: 14, isSubIndicator: true  },
  { id: "ind12d",no: "12d", name: "Google Scholar bazasida H-indeks ≥5 bo'lgan professor-o'qituvchilar soni",                unit: "nafar",    order: 15, isSubIndicator: true  },
  { id: "ind13", no: "13",  name: "Xalqaro va Respublika miqyosida monografiyalar soni",                                     unit: "dona",     order: 16, isSubIndicator: false },
  { id: "ind14", no: "14",  name: "Ixtiro, foydali model uchun patent",                                                      unit: "dona",     order: 17, isSubIndicator: false },
  { id: "ind15", no: "15",  name: "Dasturiy mahsulotlar uchun guvohnoma",                                                    unit: "dona",     order: 18, isSubIndicator: false },
  { id: "ind16", no: "16",  name: "Yosh tadqiqotchilar uchun ilmiy va startap loyihalar",                                    unit: "dona",     order: 19, isSubIndicator: false },
  { id: "ind17", no: "17",  name: "Olimpiada va nufuzli tanlovlarda sovrinli o'rinlarni qo'lga kiritgan talabalar soni",     unit: "nafar",    order: 20, isSubIndicator: false },
  { id: "ind18", no: "18",  name: "Sohalar buyurtmasi asosida bajarilgan xizmat ko'rsatish shartnomalari soni",              unit: "dona",     order: 21, isSubIndicator: false },
  { id: "ind19", no: "19",  name: "Sohalar buyurtmasi asosida o'tkazilgan ilmiy tadqiqotlardan olingan mablag'lar",          unit: "mln. so'm",order: 22, isSubIndicator: false },
];
