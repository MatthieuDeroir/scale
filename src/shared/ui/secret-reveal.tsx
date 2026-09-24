'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

/**
 * Une valeur secrète qu'un backend ne renvoie qu'une fois (clé Headscale,
 * mot de passe généré) — jamais un simple affichage, toujours un
 * avertissement explicite + copie en un clic. Utilisé par `keys` (clé
 * machine) et `auth` (mot de passe de compte).
 */
export function SecretReveal({
  title,
  description,
  value,
  copyLabel,
  copiedLabel,
  dismissLabel,
  onDismiss,
}: {
  title: string;
  description: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <code className="break-all rounded-md bg-muted p-3 text-sm">{value}</code>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            }}
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? copiedLabel : copyLabel}
          </Button>
          <Button variant="brand" onClick={onDismiss}>
            {dismissLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
