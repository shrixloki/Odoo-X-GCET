import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  children: React.ReactNode;
  role: "employee" | "admin";
  userName?: string;
  onRefresh?: () => void;
}

export function AppLayout({ children, role, userName = "John Doe", onRefresh }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar role={role} />
      <div className="pl-60">
        <AppHeader userName={userName} role={role} onRefresh={onRefresh} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
