'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

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
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <h1 className="text-xl font-bold mb-6 text-center">track0</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Dashboard token"
            autoFocus
            className="w-full bg-transparent border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-foreground text-background rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Verifying...' : 'Log in'}
          </button>
        </form>
      </div>
    </main>
  );
}
