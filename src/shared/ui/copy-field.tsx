'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';

/** Valeur à copier en un clic (clé, commande) — affichée en monospace, jamais tronquée. */
export function CopyField({
  label,
  value,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs leading-5">
          {value}
        </code>
        <Button
          size="sm"
          variant="outline"
          aria-label={`${copyLabel} — ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
    </div>
  );
}
