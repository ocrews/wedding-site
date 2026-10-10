// v0.1 placeholder. Real content comes from the DB via the API in v0.2 — never from repo files.
export default function Home() {
  const build = process.env.NEXT_PUBLIC_BUILD_LABEL ?? 'local';

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div
        aria-hidden
        className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-accent bg-surface shadow-[0_0_40px_-8px_var(--color-accent)]"
      >
        <span className="h-3 w-3 rounded-full bg-accent" />
      </div>
      <h1 className="font-display text-4xl tracking-tight">Something’s brewing under the tent</h1>
      <p className="text-muted">The lanterns are going up. Check back soon.</p>
      <p className="font-mono text-xs text-muted/70">build: {build}</p>
    </main>
  );
}
