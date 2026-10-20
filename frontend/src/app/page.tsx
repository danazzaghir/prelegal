import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Prelegal",
};

export default function SignInPage() {
  return (
    <AuthShell title="Sign in">
      <LoginForm />
    </AuthShell>
  );
}
