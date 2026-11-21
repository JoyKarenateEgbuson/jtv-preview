import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import Logo from "@/components/Logo";
import { isAdmin } from "@/lib/session";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Logo height={84} />
      <LoginForm />
    </main>
  );
}
