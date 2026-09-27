'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, LayoutTemplate, Plus, Save, Trash2, X } from 'lucide-react';
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
  deleteProduct,
  deleteTemplate,
  fetchProducts,
  fetchTemplates,
  updateProduct,
  type Product,
  type TemplateItem,
} from '../api';

const NO_ROLE = 'none';
const HYPERVISION = 'hypervision';

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['templates'] }),
        queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] }),
      ]);
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

function RoleSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations('parc.catalog');
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={t('role')} className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_ROLE}>{t('roleNone')}</SelectItem>
        <SelectItem value="master">MASTER</SelectItem>
        <SelectItem value="slave">SLAVE</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ProductRow({ product, editable }: { product: Product; editable: boolean }) {
  const t = useTranslations('parc.catalog');
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState<string>(product.category);
  const [role, setRole] = useState(product.role ?? NO_ROLE);
  const dirty = name.trim() !== product.name || category !== product.category || role !== (product.role ?? NO_ROLE);
  const save = useCatalogMutation(
    () => updateProduct(product.id, { name: name.trim(), category, role: role === NO_ROLE ? null : role }),
    t('productSaved')
  );
  const remove = useCatalogMutation(() => deleteProduct(product.id), t('productDeleted'));

  if (!editable) {
    return (
      <TableRow>
        <TableCell className="font-medium">{product.name}</TableCell>
        <TableCell>{product.category === 'gamme' ? t('gamme') : t('surMesure')}</TableCell>
        <TableCell>{product.role?.toUpperCase() ?? '—'}</TableCell>
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
        <RoleSelect value={role} onChange={setRole} />
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
            title={t('delete')}
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
  const [category, setCategory] = useState('gamme');
  const [role, setRole] = useState(NO_ROLE);
  const add = useCatalogMutation(
    () => createProduct({ name: name.trim(), category, role: role === NO_ROLE ? null : role }),
    t('productAdded'),
    () => {
      setName('');
      setRole(NO_ROLE);
    }
  );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t('name')}</TableHead>
          <TableHead>{t('category')}</TableHead>
          <TableHead>{t('role')}</TableHead>
          <TableHead className="text-right">{t('machines')}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <ProductRow key={`${product.id}-${product.name}-${product.category}-${product.role}`} product={product} editable={editable} />
        ))}
        {editable && (
          <TableRow className="hover:bg-transparent">
            <TableCell>
              <Input
                aria-label={t('name')}
                placeholder={t('name')}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </TableCell>
            <TableCell>
              <CategorySelect value={category} onChange={setCategory} />
            </TableCell>
            <TableCell>
              <RoleSelect value={role} onChange={setRole} />
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

interface Line {
  target: string;
  count: number;
  label: string;
}

function TemplateBuilder({ products }: { products: Product[] }) {
  const t = useTranslations('parc.catalog');
  const tp = useTranslations('parc.plan');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<Line[]>([{ target: '', count: 1, label: '' }]);

  const labelOf = (line: Line) =>
    line.label.trim() ||
    (line.target === HYPERVISION ? tp('hypervision') : products.find((item) => String(item.id) === line.target)?.name) ||
    '';
  const items: TemplateItem[] = lines
    .filter((line) => line.target)
    .map((line) => ({
      kind: line.target === HYPERVISION ? 'hypervision' : 'equipment',
      productId: line.target === HYPERVISION ? null : Number(line.target),
      count: line.count,
      label: labelOf(line),
    }));
  const create = useCatalogMutation(
    () => createTemplate({ name: name.trim(), description, items }),
    t('templateCreated'),
    () => {
      setName('');
      setDescription('');
      setLines([{ target: '', count: 1, label: '' }]);
    }
  );
  const update = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

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
      <ul className="flex flex-col gap-2">
        {lines.map((line, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={tp('count')}
              type="number"
              min={1}
              max={50}
              className="w-20"
              value={line.count}
              onChange={(event) => update(index, { count: Math.min(50, Math.max(1, Number(event.target.value) || 1)) })}
            />
            <span className="text-sm text-muted-foreground">×</span>
            <Select value={line.target} onValueChange={(target) => update(index, { target })}>
              <SelectTrigger aria-label={tp('product')} className="w-56">
                <SelectValue placeholder={tp('chooseProduct')} />
              </SelectTrigger>
              <SelectContent>
                {products.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
                <SelectItem value={HYPERVISION}>{tp('hypervision')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              aria-label={tp('label')}
              className="min-w-40 flex-1"
              placeholder={labelOf({ ...line, label: '' }) || tp('label')}
              value={line.label}
              onChange={(event) => update(index, { label: event.target.value })}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('delete')}
              disabled={lines.length === 1}
              onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => setLines((current) => [...current, { target: '', count: 1, label: '' }])}>
          <Plus aria-hidden />
          {t('addLine')}
        </Button>
        <Button
          size="sm"
          variant="brand"
          disabled={!name.trim() || items.length === 0 || create.isPending}
          onClick={() => create.mutate(undefined)}
        >
          <LayoutTemplate aria-hidden />
          {t('createTemplate')}
        </Button>
      </div>
    </div>
  );
}

function Templates({ products, editable }: { products: Product[]; editable: boolean }) {
  const t = useTranslations('parc.catalog');
  const tp = useTranslations('parc.plan');
  const templates = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });
  const remove = useCatalogMutation((id: number) => deleteTemplate(id), t('templateDeleted'));
  const names = new Set(products.map((item) => item.id));

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
                      {item.count} × {item.kind === 'hypervision' ? item.label || tp('hypervision') : item.label}
                      {item.kind === 'equipment' && !names.has(item.productId ?? -1) && ` (${t('unknownProduct')})`}
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

/** Catalogue des produits posés sur les machines et modèles de flotte. */
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
          <Panel icon={LayoutTemplate} title={t('templates')} description={t('templatesHint')}>
            <Templates products={products.data ?? []} editable={operate} />
          </Panel>
        </>
      )}
    </>
  );
}
