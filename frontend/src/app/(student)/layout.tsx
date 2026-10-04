import AppShell from "@/components/AppShell";

export default function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}