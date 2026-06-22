import type { RoleName } from "@/types/db";

export function roleHome(role?: RoleName | string): string {
  if (role === "super_admin") return "/universities";
  if (role === "staff_manager") return "/form";
  if (role === "university_admin") return "/users";
  if (role === "science_department") return "/targets";
  if (role === "monitor") return "/nazoratchi/natijalar";
  if (role === "vice_rector" || role === "dean") return "/targets";
  if (role === "oquv_bolimi") return "/overview";
  if (role === "supervisor") return "/doktorantura/mening-talabalarim";
  if (role === "doktorant") return "/doktorantura/mening-profilim";
  return "/login";
}
