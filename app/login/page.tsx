'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        router.push('/');
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid token');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-xs">
        <h1 className="text-base font-bold mb-4 text-center">track0</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="token" className="text-muted-foreground mb-1">
              Dashboard token
            </Label>
            <Input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter token"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-xs text-[var(--red)]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading || !token} className="w-full">
            {loading ? 'Verifying...' : 'Log in'}
          </Button>
        </form>
      </div>
    </main>
  );
}
