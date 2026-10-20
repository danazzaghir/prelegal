import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "My agreements · Prelegal",
};

export default function DashboardPage() {
  return <Dashboard />;
}
