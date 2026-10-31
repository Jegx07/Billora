import { getSessionFromRequest } from "@/server/middlewares/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSessionFromRequest();
  if (!session) {
    redirect("/login");
  }
  if (session.role === "CUSTOMER") {
    redirect("/portal");
  }
  redirect("/dashboard");
}
