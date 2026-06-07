import { TopNav } from "@/components/TopNav";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function DashboardPage() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopNav />
      <Dashboard />
    </div>
  );
}
