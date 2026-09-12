import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env") });
let session: Promise<string> | undefined;
export function adminToken(base: string) {
  session ??= (async () => {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)
      throw new Error(
        "Configure ADMIN_EMAIL and ADMIN_PASSWORD for integration tests",
      );
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      }),
    });
    if (!response.ok) throw new Error("Test administrator login failed");
    const result = (await response.json()) as { token: string };
    return result.token;
  })();
  return session;
}
export async function activateTestTeacher(base: string, email: string) {
  const token = await adminToken(base);
  const headers = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };
  const response = await fetch(
    base + "/api/admin/teachers?search=" + encodeURIComponent(email),
    { headers },
  );
  const result = (await response.json()) as {
    teachers: { id: number; email: string }[];
  };
  const teacher = result.teachers.find((t) => t.email === email);
  if (!teacher) throw new Error("Test teacher missing");
  const activated = await fetch(base + "/api/admin/teachers/" + teacher.id, {
    method: "PUT",
    headers,
    body: JSON.stringify({ isActive: true }),
  });
  if (!activated.ok) throw new Error("Test activation failed");
}
