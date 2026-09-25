'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  usePermissions,
} from '@/shared/ui';
import { saveProfile, type FleetProfile, type FleetProfileInput } from '../api';

const FIELDS = ['displayName', 'sector', 'reference', 'contact', 'phone', 'email', 'site'] as const;
type Field = (typeof FIELDS)[number] | 'notes';

function ProfileDialog({
  tag,
  profile,
  open,
  onOpenChange,
}: {
  tag: string;
  profile: FleetProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('parc');
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<Field, string>>(() => ({
    displayName: profile?.displayName ?? '',
    sector: profile?.sector ?? '',
    reference: profile?.reference ?? '',
    contact: profile?.contact ?? '',
    phone: profile?.phone ?? '',
    email: profile?.email ?? '',
    site: profile?.site ?? '',
    notes: profile?.notes ?? '',
  }));

  const mutation = useMutation({
    mutationFn: () => saveProfile(tag, values as FleetProfileInput),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fleets', 'profiles'] });
      toast.success(t('profile.saved'));
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('profile.editTitle')}</DialogTitle>
          <DialogDescription>{t('profile.editDescription', { tag })}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {FIELDS.map((field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <Label htmlFor={`profile-${field}`}>{t(`profile.${field}`)}</Label>
              <Input
                id={`profile-${field}`}
                type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                value={values[field]}
                placeholder={t(`profile.${field}Placeholder`)}
                onChange={(event) => setValues({ ...values, [field]: event.target.value })}
              />
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-notes">{t('profile.notes')}</Label>
            <textarea
              id="profile-notes"
              rows={4}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={values.notes}
              placeholder={t('profile.notesPlaceholder')}
              onChange={(event) => setValues({ ...values, notes: event.target.value })}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="brand" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? t('profile.saving') : t('profile.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ce qu'on cherche quand un client appelle : qui, où, quel dossier. */
export function FleetProfileCard({ tag, profile }: { tag: string; profile: FleetProfile | null }) {
  const t = useTranslations('parc');
  const { operate } = usePermissions();
  const [editing, setEditing] = useState(false);

  const rows = (
    [
      ['contact', profile?.contact],
      ['phone', profile?.phone],
      ['email', profile?.email],
      ['site', profile?.site],
      ['reference', profile?.reference],
      ['sector', profile?.sector],
    ] as const
  ).filter(([, value]) => Boolean(value));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 pt-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 text-muted-foreground" aria-hidden />
          {t('profile.title')}
        </CardTitle>
        {operate && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            {t('profile.edit')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {rows.length === 0 && !profile?.notes ? (
          <p className="text-sm text-muted-foreground">{t('profile.empty')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
              {rows.map(([field, value]) => (
                <div key={field} className="flex gap-2">
                  <dt className="w-24 shrink-0 text-muted-foreground">{t(`profile.${field}`)}</dt>
                  <dd className="min-w-0 break-words">
                    {field === 'phone' ? (
                      <a className="hover:underline" href={`tel:${value}`}>
                        {value}
                      </a>
                    ) : field === 'email' ? (
                      <a className="hover:underline" href={`mailto:${value}`}>
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {profile?.notes && (
              <p className="whitespace-pre-line rounded-md bg-muted/40 px-3 py-2 text-sm">
                {profile.notes}
              </p>
            )}
          </div>
        )}
      </CardContent>
      {editing && (
        <ProfileDialog tag={tag} profile={profile} open onOpenChange={setEditing} />
      )}
    </Card>
  );
}
