"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { clearVolatile } from "@/lib/cache";
import { isValidTimeZone } from "@/lib/dates";

export async function setTimeZone(formData: FormData) {
  const tz = String(formData.get("tz") ?? "");
  if (!isValidTimeZone(tz)) return;
  (await cookies()).set("tz", tz, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** Descarta lo que caduca (en vivo, clasificación) y vuelve a pedirlo. Lo ya finalizado se conserva. */
export async function refreshData() {
  clearVolatile();
  revalidatePath("/", "layout");
}
