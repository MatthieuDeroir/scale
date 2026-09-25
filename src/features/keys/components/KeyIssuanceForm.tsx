'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fleetTagFromName } from '@/core';
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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/shared/ui';
import { createKey, type NewAccessKey } from '../api';

const OTHER_TAG = '__other__';
const DEFAULT_EXPIRATION_DAYS = 30;

function defaultExpiration(): string {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_EXPIRATION_DAYS);
  return date.toISOString().slice(0, 10);
}

function resolveTag(internal: boolean, tagChoice: string, customTag: string): string {
  if (internal) return 'tag:interne';
  if (tagChoice !== OTHER_TAG) return tagChoice;
  return fleetTagFromName(customTag);
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
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <Label htmlFor="key-internal">{t('internal')}</Label>
          <Switch id="key-internal" checked={internal} onCheckedChange={setInternal} />
        </div>

        {!internal && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="key-fleet">{t('fleet')}</Label>
            <Select value={tagChoice} onValueChange={setTagChoice}>
              <SelectTrigger id="key-fleet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {knownFleetTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_TAG}>{t('newFleet')}</SelectItem>
              </SelectContent>
            </Select>
            {tagChoice === OTHER_TAG && (
              <Input
                placeholder="nouveauclient"
                value={customTag}
                onChange={(event) => setCustomTag(event.target.value)}
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="key-reusable">{t('reusable')}</Label>
          <Switch id="key-reusable" checked={reusable} onCheckedChange={setReusable} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="key-expiration">{t('expiration')}</Label>
          <Input
            id="key-expiration"
            type="date"
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
