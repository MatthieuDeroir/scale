'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fleetTagOf, isMaster } from '@/features/fleets';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
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
import { cn } from '@/shared/lib';
import { fetchProducts, setMachineProduct, type MachineDetail } from '../api';
import { useNodes } from '../lib';

const NO_SERVER = 'none';

/**
 * Produit d'une machine (gamme ou produit spécifique) et n° d'affaire. Pour
 * un SL MEDIA : serveur, ou SLAVE rattaché à un serveur de la flotte.
 */
export function ProductField({ machine }: { machine: MachineDetail }) {
  const t = useTranslations('parc.product');
  const tp = useTranslations('parc.plan');
  const tc = useTranslations('parc.catalog');
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const nodes = useNodes().data ?? [];
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [reference, setReference] = useState('');
  const [role, setRole] = useState<'server' | 'slave'>('server');
  const [server, setServer] = useState(NO_SERVER);
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts, enabled: open });
  const product = products.data?.find((item) => String(item.id) === productId);

  const fleet = fleetTagOf(machine.tags);
  const servers = nodes.filter(
    (node) =>
      node.id !== machine.id &&
      fleet &&
      node.tags.includes(fleet) &&
      isMaster(node.tags) &&
      node.product?.id === Number(productId)
  );
  const currentServer = machine.product?.masterNodeId
    ? nodes.find((node) => node.id === machine.product!.masterNodeId)
    : undefined;

  const mutation = useMutation({
    mutationFn: () =>
      setMachineProduct(machine.id, {
        productId: Number(productId),
        reference,
        ...(product?.slaves ? { role, masterNodeId: role === 'slave' && server !== NO_SERVER ? server : null } : {}),
      }),
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
    setProductId(machine.product ? String(machine.product.id) : '');
    setReference(machine.product?.reference ?? '');
    setRole(machine.product?.slaves && !isMaster(machine.tags) ? 'slave' : 'server');
    setServer(machine.product?.masterNodeId ?? NO_SERVER);
    setOpen(true);
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      {machine.product ? (
        <span>
          {machine.product.name}
          {machine.product.slaves && (
            <span className="text-muted-foreground">
              {' '}
              ·{' '}
              {isMaster(machine.tags)
                ? t('server')
                : currentServer
                  ? t('slaveOf', { name: currentServer.givenName || currentServer.name })
                  : t('slaveOrphan')}
            </span>
          )}
          {machine.product.reference && <span className="text-muted-foreground"> · {machine.product.reference}</span>}
        </span>
      ) : (
        <Badge variant="warning">{t('missing')}</Badge>
      )}
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
                  <SelectValue placeholder={tp('chooseProduct')} />
                </SelectTrigger>
                <SelectContent>
                  {(products.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {product?.slaves && (
              <div className="flex flex-col gap-2">
                <Label>{t('role')}</Label>
                <div role="radiogroup" aria-label={t('role')} className="flex gap-1 rounded-lg bg-muted p-1">
                  {(['server', 'slave'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={role === value}
                      onClick={() => setRole(value)}
                      className={cn(
                        'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                        role === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {value === 'server' ? t('server') : 'SLAVE'}
                    </button>
                  ))}
                </div>
                {role === 'slave' && (
                  <Select value={server} onValueChange={setServer}>
                    <SelectTrigger aria-label={t('serverOf')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SERVER}>{t('noServer')}</SelectItem>
                      {servers.map((node) => (
                        <SelectItem key={node.id} value={node.id}>
                          {node.givenName || node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-reference">{tp('reference')}</Label>
              <Input id="product-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="brand" disabled={!productId || mutation.isPending} onClick={() => mutation.mutate()}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
