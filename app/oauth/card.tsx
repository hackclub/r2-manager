import { PlugsConnectedIcon } from "@phosphor-icons/react/dist/ssr";

export function OAuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex justify-center px-6 py-12 lg:py-20">
      <section className="w-full max-w-md rounded-xl border border-kumo-line bg-kumo-elevated p-6 shadow-sm">
        <span className="flex size-10 items-center justify-center rounded-lg border border-kumo-line bg-kumo-tint">
          <PlugsConnectedIcon size={20} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-lg font-semibold text-kumo-strong">{title}</h1>
        {description && <div className="mt-2 text-sm text-kumo-subtle">{description}</div>}
        {children && <div className="mt-6">{children}</div>}
      </section>
    </main>
  );
}
