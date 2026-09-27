'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  usePermissions,
} from '@/shared/ui';
import { fetchProducts, setMachineProduct, type MachineDetail } from '../api';

const NONE = 'none';

/** Produit d'une machine (gamme ou sur mesure) et n° d'affaire, modifiable sur place. */
export function ProductField({ machine }: { machine: MachineDetail }) {
  const t = useTranslations('parc.product');
  const tp = useTranslations('parc.plan');
  const tc = useTranslations('parc.catalog');
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(String(machine.product?.id ?? NONE));
  const [reference, setReference] = useState(machine.product?.reference ?? '');
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts, enabled: open });

  const mutation = useMutation({
    mutationFn: () =>
      setMachineProduct(machine.id, { productId: productId === NONE ? null : Number(productId), reference }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['machines', machine.id] }),
        queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
      toast.success(t('saved'));
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function start() {
    setProductId(String(machine.product?.id ?? NONE));
    setReference(machine.product?.reference ?? '');
    setOpen(true);
  }

  return (
    <span className="flex items-center gap-2">
      <span>
        {machine.product ? (
          <>
            {machine.product.name}
            {machine.product.reference && (
              <span className="text-muted-foreground"> · {machine.product.reference}</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">{t('none')}</span>
        )}
      </span>
      {operate && (
        <Button variant="ghost" size="icon" className="size-7" aria-label={t('edit')} title={t('edit')} onClick={start}>
          <Pencil aria-hidden />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t('label')}</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger aria-label={t('label')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('noneOption')}</SelectItem>
                  {(products.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-reference">{tp('reference')}</Label>
              <Input
                id="product-reference"
                value={reference}
                disabled={productId === NONE}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="brand" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
