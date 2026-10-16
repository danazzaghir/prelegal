import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Prelegal",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-[#032147]">
            Pre<span className="text-[#ecad0a]">legal</span>
          </h1>
          <p className="mt-2 text-sm text-[#888888]">Draft legal agreements from standard templates.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#032147]">Sign in</h2>
          <LoginForm />
          <p className="mt-4 text-xs text-[#888888]">
            Preview: sign-in is not checked yet. Any email and password will do.
          </p>
        </div>
      </div>
    </main>
  );
}
