'use client';

import { useState } from 'react';
import type { NewAccessKey } from '../api';
import { KeyIssuanceForm } from './KeyIssuanceForm';
import { KeyList } from './KeyList';
import { NewKeyReveal } from './NewKeyReveal';

export function KeysScreen() {
  const [revealedKey, setRevealedKey] = useState<NewAccessKey | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {revealedKey && (
        <NewKeyReveal accessKey={revealedKey} onDismiss={() => setRevealedKey(null)} />
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <KeyIssuanceForm onIssued={setRevealedKey} />
        <KeyList />
      </div>
    </div>
  );
}
