import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-center">
      <h1 className="text-xl font-bold mb-4">Not found</h1>
      <p className="text-sm text-muted-foreground mb-6">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </main>
  );
}
