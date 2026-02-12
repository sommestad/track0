'use client';

import { useCallback, useRef, useState, useTransition } from 'react';
import { tellIssue } from '@/app/issue/[id]/actions';
import { Button } from '@/components/ui/button';
import { ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TellInputProps {
  issueId: string;
}

export function TellInput({ issueId }: TellInputProps) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = value.trim();
    if (!message) return;
    startTransition(async () => {
      await tellIssue(issueId, message);
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      textareaRef.current?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-2xl bg-muted/60 p-4 pb-3"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          resize();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Tell track0 something about this..."
        disabled={isPending}
        rows={2}
        className="w-full resize-none overflow-hidden bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
      />
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending || !value.trim()}
          className="flex size-8 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-30"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>
    </form>
  );
}
