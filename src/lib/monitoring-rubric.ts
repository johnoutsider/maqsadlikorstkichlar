export type MonitoringRubricItem = {
  key: string;
  label: string;
  maxScore: number;
  dscOnly?: boolean;
};

export type MonitoringRubricSection = {
  id: number;
  title: string;
  max: number;
  items: MonitoringRubricItem[];
};

export const MONITORING_RUBRIC: MonitoringRubricSection[] = [
  {
    id: 1,
    title: "Shaxsiy ish rejasi va hujjatlar",
    max: 15,
    items: [
      {
        key: "1_1",
        label: "Tasdiqlangan 3-yillik shaxsiy ish rejasi mavjud (imzo va muhr bilan)",
        maxScore: 5,
      },
      {
        key: "1_2",
        label: "Tasdiqlangan 3-yillik shaxsiy ish rejasi bandlarining bajarilish holati",
        maxScore: 5,
      },
      {
        key: "1_3",
        label: "Chorak bo'yicha hisobot kafedrada topshirilgan (bayonnoma raqami va sanasi ko'rsatilgan)",
        maxScore: 5,
      },
      {
        key: "1_4",
        label: "Nazariy-metodologik dastur bajarilgan: mavzular o'zlashtirilib, rahbar imzo qo'ygan",
        maxScore: 5,
      },
    ],
  },
  {
    id: 2,
    title: "Ilmiy nashr faoliyati",
    max: 25,
    items: [
      {
        key: "2_1",
        label: "Scopus / Web of Science / ScienceDirect jurnalida maqola (reja asosida)",
        maxScore: 5,
      },
      {
        key: "2_2",
        label: "OAK ro'yxatidagi xorijiy jurnalda maqola (reja asosida)",
        maxScore: 5,
      },
      {
        key: "2_3",
        label: "OAK ro'yxatidagi respublika jurnalida maqola (reja asosida)",
        maxScore: 5,
      },
      {
        key: "2_4",
        label: "Xalqaro anjumanda tezis (reja asosida)",
        maxScore: 5,
      },
      {
        key: "2_5",
        label: "Respublika anjumanida tezis (reja asosida)",
        maxScore: 5,
      },
      {
        key: "2_6",
        label: "OTM miqyosidagi anjumanda tezis (reja asosida)",
        maxScore: 5,
      },
      {
        key: "2_7",
        label: "Monografiya nashr etilgan (reja asosida)",
        maxScore: 5,
      },
    ],
  },
  {
    id: 3,
    title: "Malakaviy imtihonlar",
    max: 25,
    items: [
      {
        key: "3_1",
        label: "Mutaxassislik bo'yicha malakaviy imtihon",
        maxScore: 5,
      },
      {
        key: "3_2",
        label: "Chet tili bo'yicha malakaviy imtihon",
        maxScore: 5,
      },
    ],
  },
  {
    id: 4,
    title: "Dissertatsiya tayyorligi",
    max: 20,
    items: [
      {
        key: "4_1",
        label: "1-bob (1.1-§, 1.2-§, 1.3-§)",
        maxScore: 5,
      },
      {
        key: "4_2",
        label: "2-bob (2.1-§, 2.2-§, 2.3-§)",
        maxScore: 5,
      },
      {
        key: "4_3",
        label: "3-bob (3.1-§, 3.2-§, 3.3-§)",
        maxScore: 5,
      },
      {
        key: "4_4",
        label: "4-bob - faqat DSc izlanuvchilari uchun (4.1-§, 4.2-§, 4.3-§)",
        maxScore: 5,
        dscOnly: true,
      },
    ],
  },
  {
    id: 5,
    title: "Ilmiy seminar va muhokamalar",
    max: 10,
    items: [
      {
        key: "5_1",
        label: "Dissertatsiya mavzusi bo'yicha tahliliy ma'ruza qilgan - bayonnoma raqami va sanasi ko'rsatilgan",
        maxScore: 5,
      },
      {
        key: "5_2",
        label: "Doktorantlar uyushmasida ma'ruza qilganligi bayonnomasi",
        maxScore: 5,
      },
      {
        key: "5_3",
        label: "Muhokama jarayonlari (kafedra, ilmiy seminar va himoya) bayonnomasi raqami va sanasi",
        maxScore: 5,
      },
    ],
  },
  {
    id: 6,
    title: "Faollik va intizom",
    max: 5,
    items: [
      {
        key: "6_1",
        label: "Universitetdagi davomati, jamoat ishlarida ishtiroki va tadbirlardagi faolligi",
        maxScore: 5,
      },
      {
        key: "6_2",
        label: "Kutubxonada ilmiy-tadqiqot olib borish",
        maxScore: 5,
      },
    ],
  },
];
