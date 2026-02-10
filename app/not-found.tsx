import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-center">
      <h1 className="text-xl font-bold mb-4">Not found</h1>
      <p className="text-sm text-muted mb-6">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity inline-block"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
