export type DoktorantMetadata = {
  avatar_path?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  birth_date?: string;
  gender?: string;
  nationality?: string;
  citizenship?: string;
  country?: string;
  region?: string;
  district?: string;
  address?: string;
  category?: string;
  science_field?: string;
  specialty?: string;
  study_status?: string;
  course?: string;
  payment_type?: string;
  admission_date?: string;
  supervisor_email?: string;
  supervisor_phone?: string;
  supervisor_degree?: string;
  consultant_name?: string;
  consultant_title?: string;
  consultant_degree?: string;
};

export type DoktorantFormState = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: string;
  nationality: string;
  citizenship: string;
  category: string;
  scienceField: string;
  specialty: string;
  studyStatus: string;
  course: string;
  paymentType: string;
  department: string;
  admissionDate: string;
  researchTopic: string;
  country: string;
  region: string;
  district: string;
  address: string;
  supervisorName: string;
  supervisorTitle: string;
  supervisorDegree: string;
  supervisorOrganization: string;
  supervisorEmail: string;
  supervisorPhone: string;
  consultantName: string;
  consultantTitle: string;
  consultantDegree: string;
};

export const doktorantStatusLabels: Record<string, string> = {
  taklif: "Taklif bosqichi",
  jarayonda: "Faol jarayon",
  korib_chiqilmoqda: "Ko'rib chiqilmoqda",
  himoyalangan: "Himoyalangan",
  yakunlangan: "Yakunlangan",
};

export const doktorantProgressByStatus: Record<string, number> = {
  taklif: 20,
  jarayonda: 65,
  korib_chiqilmoqda: 82,
  himoyalangan: 95,
  yakunlangan: 100,
};

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    lastName: parts[0] ?? "",
    firstName: parts[1] ?? "",
    middleName: parts.slice(2).join(" "),
  };
}

export function buildFullName(lastName: string, firstName: string, middleName: string) {
  return [lastName, firstName, middleName].map((value) => value.trim()).filter(Boolean).join(" ");
}

export function buildDoktorantMetadata(form: DoktorantFormState): DoktorantMetadata {
  return {
    first_name: form.firstName,
    last_name: form.lastName,
    middle_name: form.middleName,
    birth_date: form.birthDate,
    gender: form.gender,
    nationality: form.nationality,
    citizenship: form.citizenship,
    category: form.category,
    science_field: form.scienceField,
    specialty: form.specialty,
    study_status: form.studyStatus,
    course: form.course,
    payment_type: form.paymentType,
    admission_date: form.admissionDate,
    country: form.country,
    region: form.region,
    district: form.district,
    address: form.address,
    supervisor_email: form.supervisorEmail,
    supervisor_phone: form.supervisorPhone,
    supervisor_degree: form.supervisorDegree,
    consultant_name: form.consultantName,
    consultant_title: form.consultantTitle,
    consultant_degree: form.consultantDegree,
  };
}
