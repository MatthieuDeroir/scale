'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNodes } from '@/features/fleets';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui';
import { createKey, type NewAccessKey } from '../api';

const OTHER_TAG = '__other__';
const DEFAULT_EXPIRATION_DAYS = 30;

function defaultExpiration(): string {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_EXPIRATION_DAYS);
  return date.toISOString().slice(0, 10);
}

function inputClass() {
  return 'h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
}

/** Headscale exige un tag en minuscules, sans espace (`tag.go` côté fork). */
function resolveTag(internal: boolean, tagChoice: string, customTag: string): string {
  if (internal) return 'tag:interne';
  if (tagChoice !== OTHER_TAG) return tagChoice;
  const slug = customTag.trim().toLowerCase().replace(/\s+/g, '-');
  return slug.startsWith('tag:flotte-') ? slug : `tag:flotte-${slug}`;
}

export function KeyIssuanceForm({ onIssued }: { onIssued: (key: NewAccessKey) => void }) {
  const t = useTranslations('keys');
  const queryClient = useQueryClient();
  const { data: nodes } = useQuery({ queryKey: ['fleets', 'nodes'], queryFn: fetchNodes });

  const knownFleetTags = Array.from(
    new Set(
      (nodes ?? [])
        .map((node) => node.tags[0])
        .filter((tag): tag is string => Boolean(tag) && tag !== 'tag:interne')
    )
  );

  const [tagChoice, setTagChoice] = useState(knownFleetTags[0] ?? OTHER_TAG);
  const [customTag, setCustomTag] = useState('');
  const [internal, setInternal] = useState(false);
  const [reusable, setReusable] = useState(false);
  const [expiration, setExpiration] = useState(defaultExpiration());

  const canSubmit = internal || tagChoice !== OTHER_TAG || customTag.trim().length > 0;

  const mutation = useMutation({
    mutationFn: () =>
      createKey({
        tags: [resolveTag(internal, tagChoice, customTag)],
        reusable,
        expiration: new Date(expiration).toISOString(),
      }),
    onSuccess: async (key) => {
      await queryClient.invalidateQueries({ queryKey: ['keys'] });
      onIssued(key);
      setCustomTag('');
      toast.success(t('issued'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('issueTitle')}</CardTitle>
        <CardDescription>{t('issueDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={internal}
            onChange={(event) => setInternal(event.target.checked)}
          />
          {t('internal')}
        </label>

        {!internal && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="key-fleet">
              {t('fleet')}
            </label>
            <select
              id="key-fleet"
              className={inputClass()}
              value={tagChoice}
              onChange={(event) => setTagChoice(event.target.value)}
            >
              {knownFleetTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
              <option value={OTHER_TAG}>{t('newFleet')}</option>
            </select>
            {tagChoice === OTHER_TAG && (
              <input
                className={inputClass()}
                placeholder="nouveauclient"
                value={customTag}
                onChange={(event) => setCustomTag(event.target.value)}
              />
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={reusable}
            onChange={(event) => setReusable(event.target.checked)}
          />
          {t('reusable')}
        </label>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="key-expiration">
            {t('expiration')}
          </label>
          <input
            id="key-expiration"
            type="date"
            className={inputClass()}
            value={expiration}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setExpiration(event.target.value)}
          />
        </div>

        <Button
          variant="brand"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t('issuing') : t('issue')}
        </Button>
      </CardContent>
    </Card>
  );
}
