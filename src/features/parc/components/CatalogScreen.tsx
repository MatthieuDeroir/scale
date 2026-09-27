'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Boxes, LayoutTemplate, Plus, Save, Trash2, Workflow } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ComponentType, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  usePermissions,
} from '@/shared/ui';
import {
  createProduct,
  createTemplate,
  deleteLink,
  deleteProduct,
  deleteTemplate,
  fetchLinks,
  fetchProducts,
  fetchTemplates,
  saveLink,
  updateProduct,
  type Product,
  type ProductLink,
} from '../api';
import { SlotLinesEditor, describeItem, emptyLine, linesToItems, type SlotLine } from './SlotLinesEditor';

function Panel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

function useCatalogMutation<T>(fn: (input: T) => Promise<unknown>, message: string, onDone?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(
        [['products'], ['links'], ['templates'], ['fleets', 'nodes']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      );
      toast.success(message);
      onDone?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

function CategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations('parc.catalog');
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={t('category')} className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="gamme">{t('gamme')}</SelectItem>
        <SelectItem value="sur-mesure">{t('surMesure')}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ProductRow({ product, editable }: { product: Product; editable: boolean }) {
  const t = useTranslations('parc.catalog');
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState<string>(product.category);
  const [slaves, setSlaves] = useState(product.slaves);
  const dirty = name.trim() !== product.name || category !== product.category || slaves !== product.slaves;
  const save = useCatalogMutation(() => updateProduct(product.id, { name: name.trim(), category, slaves }), t('productSaved'));
  const remove = useCatalogMutation(() => deleteProduct(product.id), t('productDeleted'));

  if (!editable) {
    return (
      <TableRow>
        <TableCell className="font-medium">{product.name}</TableCell>
        <TableCell>{product.category === 'gamme' ? t('gamme') : t('surMesure')}</TableCell>
        <TableCell>{product.slaves ? t('yes') : '—'}</TableCell>
        <TableCell className="text-right tabular-nums">{product.machines}</TableCell>
        <TableCell />
      </TableRow>
    );
  }
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell>
        <Input aria-label={t('name')} value={name} onChange={(event) => setName(event.target.value)} />
      </TableCell>
      <TableCell>
        <CategorySelect value={category} onChange={setCategory} />
      </TableCell>
      <TableCell>
        <Switch aria-label={t('slaves')} checked={slaves} onCheckedChange={setSlaves} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{product.machines}</TableCell>
      <TableCell>
        <span className="flex justify-end gap-1">
          {dirty && (
            <Button size="sm" variant="brand" disabled={!name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>
              <Save aria-hidden />
              {t('save')}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label={`${t('delete')} : ${product.name}`}
            title={product.machines > 0 ? t('usedProduct') : t('delete')}
            disabled={product.machines > 0 || remove.isPending}
            onClick={() => remove.mutate(undefined)}
          >
            <Trash2 aria-hidden />
          </Button>
        </span>
      </TableCell>
    </TableRow>
  );
}

function Products({ products, editable }: { products: Product[]; editable: boolean }) {
  const t = useTranslations('parc.catalog');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('sur-mesure');
  const [slaves, setSlaves] = useState(false);
  const add = useCatalogMutation(() => createProduct({ name: name.trim(), category, slaves }), t('productAdded'), () => {
    setName('');
    setSlaves(false);
  });

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t('name')}</TableHead>
          <TableHead>{t('category')}</TableHead>
          <TableHead title={t('slavesHint')}>{t('slaves')}</TableHead>
          <TableHead className="text-right">{t('machines')}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <ProductRow
            key={`${product.id}-${product.name}-${product.category}-${product.slaves}`}
            product={product}
            editable={editable}
          />
        ))}
        {editable && (
          <TableRow className="hover:bg-transparent">
            <TableCell>
              <Input
                aria-label={t('newProductName')}
                placeholder={t('newProductName')}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </TableCell>
            <TableCell>
              <CategorySelect value={category} onChange={setCategory} />
            </TableCell>
            <TableCell>
              <Switch aria-label={t('slaves')} checked={slaves} onCheckedChange={setSlaves} />
            </TableCell>
            <TableCell />
            <TableCell className="text-right">
              <Button size="sm" variant="outline" disabled={!name.trim() || add.isPending} onClick={() => add.mutate(undefined)}>
                <Plus aria-hidden />
                {t('addProduct')}
              </Button>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/** Libellé d'un flux : « SL TEMPO → SL MEDIA », ou « SLAVE → serveur SL MEDIA ». */
export function linkLabel(link: Pick<ProductLink, 'fromId' | 'toId'>, products: Product[], serverLabel: string) {
  const name = (id: number) => products.find((item) => item.id === id)?.name ?? '?';
  if (link.fromId === link.toId) return { from: `${name(link.fromId)} SLAVE`, to: `${name(link.toId)} ${serverLabel}` };
  return { from: name(link.fromId), to: name(link.toId) };
}

function Flows({ products, editable }: { products: Product[]; editable: boolean }) {
  const t = useTranslations('parc.catalog');
  const links = useQuery({ queryKey: ['links'], queryFn: fetchLinks });
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [ports, setPorts] = useState('');
  const [note, setNote] = useState('');
  const save = useCatalogMutation(
    () => saveLink({ fromId: Number(fromId), toId: Number(toId), ports: ports || '*', note }),
    t('flowSaved'),
    () => {
      setPorts('');
      setNote('');
    }
  );
  const remove = useCatalogMutation((id: number) => deleteLink(id), t('flowDeleted'));
  const productSelect = (value: string, onChange: (value: string) => void, label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-44">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {products.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col gap-4">
      {(links.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noFlows')}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {links.data!.map((link) => {
            const { from, to } = linkLabel(link, products, t('server'));
            return (
              <li key={link.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                <span className="font-medium">{from}</span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                <span className="font-medium">{to}</span>
                <Badge variant="secondary" className="font-mono">
                  {link.ports === '*' ? t('allPorts') : link.ports}
                </Badge>
                {link.note && <span className="text-xs text-muted-foreground">{link.note}</span>}
                {editable && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto"
                    aria-label={`${t('delete')} : ${from} → ${to}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(link.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
          {productSelect(fromId, setFromId, t('flowFrom'))}
          <ArrowRight className="mb-2.5 size-4 text-muted-foreground" aria-hidden />
          {productSelect(toId, setToId, t('flowTo'))}
          <div className="flex flex-col gap-1">
            <Label htmlFor="flow-ports" className="text-xs">
              {t('ports')}
            </Label>
            <Input
              id="flow-ports"
              className="w-40 font-mono"
              placeholder="*"
              value={ports}
              onChange={(event) => setPorts(event.target.value)}
            />
          </div>
          <Input
            aria-label={t('flowNote')}
            placeholder={t('flowNote')}
            className="min-w-40 flex-1"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button size="sm" variant="outline" disabled={!fromId || !toId || save.isPending} onClick={() => save.mutate(undefined)}>
            <Plus aria-hidden />
            {t('addFlow')}
          </Button>
          <p className="basis-full text-xs text-muted-foreground">{t('flowHint')}</p>
        </div>
      )}
    </div>
  );
}

function TemplateBuilder({ products }: { products: Product[] }) {
  const t = useTranslations('parc.catalog');
  const tp = useTranslations('parc.plan');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<SlotLine[]>([emptyLine()]);
  const items = linesToItems(lines, products, tp('hypervision'));
  const create = useCatalogMutation(
    () => createTemplate({ name: name.trim(), description, items }),
    t('templateCreated'),
    () => {
      setName('');
      setDescription('');
      setLines([emptyLine()]);
    }
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
      <p className="text-sm font-medium">{t('newTemplate')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-name">{t('templateName')}</Label>
          <Input id="template-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-description">{t('templateDescription')}</Label>
          <Input id="template-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
      </div>
      <SlotLinesEditor lines={lines} onChange={setLines} products={products} />
      <Button
        size="sm"
        variant="brand"
        className="w-fit self-end"
        disabled={!name.trim() || items.length === 0 || create.isPending}
        onClick={() => create.mutate(undefined)}
      >
        <LayoutTemplate aria-hidden />
        {t('createTemplate')}
      </Button>
    </div>
  );
}

function Templates({ products, editable }: { products: Product[]; editable: boolean }) {
  const t = useTranslations('parc.catalog');
  const templates = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });
  const remove = useCatalogMutation((id: number) => deleteTemplate(id), t('templateDeleted'));
  const known = new Set(products.map((item) => item.id));

  return (
    <div className="flex flex-col gap-4">
      {(templates.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTemplates')}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {templates.data!.map((template) => (
            <li key={template.id} className="flex items-start gap-3 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium">{template.name}</span>
                {template.description && <span className="text-xs text-muted-foreground">{template.description}</span>}
                <span className="flex flex-wrap gap-1.5">
                  {template.items.map((item, index) => (
                    <Badge key={index} variant="secondary">
                      {describeItem(item)}
                      {item.kind === 'equipment' && !known.has(item.productId ?? -1) && ` (${t('unknownProduct')})`}
                    </Badge>
                  ))}
                </span>
              </span>
              {editable && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${t('delete')} : ${template.name}`}
                  title={t('delete')}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(template.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && <TemplateBuilder products={products} />}
    </div>
  );
}

/** Catalogue des produits, flux entre produits, et modèles de flotte. */
export function CatalogScreen() {
  const t = useTranslations('parc.catalog');
  const { operate } = usePermissions();
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      {products.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Panel icon={Boxes} title={t('products')} description={t('productsHint')}>
            <Products products={products.data ?? []} editable={operate} />
          </Panel>
          <Panel icon={Workflow} title={t('flows')} description={t('flowsHint')}>
            <Flows products={products.data ?? []} editable={operate} />
          </Panel>
          <Panel icon={LayoutTemplate} title={t('templates')} description={t('templatesHint')}>
            <Templates products={products.data ?? []} editable={operate} />
          </Panel>
        </>
      )}
    </>
  );
}
