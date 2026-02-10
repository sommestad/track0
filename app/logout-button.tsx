'use client';

export function LogoutButton() {
  return (
    <button
      type="button"
      className="text-xs text-muted hover:text-foreground transition-colors"
      onClick={() => {
        fetch('/api/auth', { method: 'DELETE' })
          .catch(() => {})
          .finally(() => {
            window.location.href = '/login';
          });
      }}
    >
      logout
    </button>
  );
}
