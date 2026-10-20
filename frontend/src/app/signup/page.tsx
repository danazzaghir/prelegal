import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import SignUpForm from "@/components/SignUpForm";

export const metadata: Metadata = {
  title: "Create an account · Prelegal",
};

export default function SignUpPage() {
  return (
    <AuthShell title="Create your account">
      <SignUpForm />
    </AuthShell>
  );
}
