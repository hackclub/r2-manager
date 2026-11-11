import { AdminNavigation } from "./navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold text-kumo-strong">Administration</h1>
      <p className="mt-2 text-sm text-kumo-subtle">Manage workspace access and bucket ownership.</p>
      <AdminNavigation />
      {children}
    </main>
  );
}
