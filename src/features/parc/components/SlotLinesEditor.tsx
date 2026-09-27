'use client';

import { CornerDownRight, Monitor, Plus, Server, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui';
import type { Product, SupportPost, TemplateItem } from '../api';

const HYPERVISION = 'hypervision';
/** Valeur d'une ligne support dans le choix : `support:<tag>`. */
const SUPPORT = 'support:';

/** Une ligne de composition : un produit (ou un poste d'hypervision), et ses REPLICA pour un SL MEDIA. */
export interface SlotLine {
  target: string;
  count: number;
  label: string;
  slaves: number;
}

export const emptyLine = (): SlotLine => ({ target: '', count: 1, label: '', slaves: 0 });

/** Produit choisi sur la ligne, s'il accepte des REPLICA. */
function productOf(line: SlotLine, products: Product[]) {
  return products.find((item) => String(item.id) === line.target);
}

/** Libellé effectif : saisi, sinon le nom du produit. */
export function lineLabel(line: SlotLine, products: Product[], hypervisionLabel: string): string {
  if (line.target.startsWith(SUPPORT)) return line.target.slice(SUPPORT.length).replace(/^tag:support-/, '');
  return (
    line.label.trim() || (line.target === HYPERVISION ? hypervisionLabel : (productOf(line, products)?.name ?? ''))
  );
}

export function linesToItems(lines: SlotLine[], products: Product[], hypervisionLabel: string): TemplateItem[] {
  return lines
    .filter((line) => line.target)
    .map((line): TemplateItem => {
      if (line.target.startsWith(SUPPORT)) {
        const supportTag = line.target.slice(SUPPORT.length);
        return {
          kind: 'support',
          productId: null,
          count: 1,
          label: supportTag.replace(/^tag:support-/, ''),
          supportTag,
        };
      }
      const product = productOf(line, products);
      return {
        kind: line.target === HYPERVISION ? ('hypervision' as const) : ('equipment' as const),
        productId: line.target === HYPERVISION ? null : Number(line.target),
        count: product?.slaves ? 1 : line.count,
        label: lineLabel(line, products, hypervisionLabel),
        ...(product?.slaves && line.slaves > 0 ? { slaves: line.slaves } : {}),
      };
    });
}

/**
 * Composition d'une flotte, ligne par ligne. Un SL MEDIA (produit à REPLICA)
 * est une ligne à lui seul, avec la liste de ses REPLICA en dessous : « + »
 * pour en ajouter, « × » pour en retirer.
 */
export function SlotLinesEditor({
  lines,
  onChange,
  products,
  supportPosts,
}: {
  lines: SlotLine[];
  onChange: (lines: SlotLine[]) => void;
  products: Product[];
  /** Pour un modèle : les postes support qui prendront en charge la flotte. */
  supportPosts?: SupportPost[];
}) {
  const t = useTranslations('parc.plan');
  const update = (index: number, patch: Partial<SlotLine>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const product = productOf(line, products);
          const support = line.target.startsWith(SUPPORT);
          const label = lineLabel(line, products, t('hypervision'));
          return (
            <li key={index} className="flex flex-col gap-1.5 rounded-lg border p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {!product?.slaves && !support && (
                  <>
                    <Input
                      aria-label={t('count')}
                      type="number"
                      min={1}
                      max={50}
                      className="w-16"
                      value={line.count}
                      onChange={(event) =>
                        update(index, { count: Math.min(50, Math.max(1, Number(event.target.value) || 1)) })
                      }
                    />
                    <span className="text-sm text-muted-foreground">×</span>
                  </>
                )}
                <Select value={line.target} onValueChange={(target) => update(index, { target, slaves: 0, count: 1 })}>
                  <SelectTrigger aria-label={t('product')} className="w-44">
                    <SelectValue placeholder={t('chooseProduct')} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={HYPERVISION}>{t('hypervision')}</SelectItem>
                    {(supportPosts ?? []).map((post) => (
                      <SelectItem key={post.tag} value={`${SUPPORT}${post.tag}`}>
                        {t('supportOption', { name: post.name })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {support ? (
                  <span className="min-w-32 flex-1 text-xs text-muted-foreground">{t('supportLineHint')}</span>
                ) : (
                  <Input
                    aria-label={t('label')}
                    className="min-w-32 flex-1"
                    placeholder={lineLabel({ ...line, label: '' }, products, t('hypervision')) || t('label')}
                    value={line.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                  />
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('removeLine')}
                  title={t('removeLine')}
                  disabled={lines.length === 1}
                  onClick={() => onChange(lines.filter((_, i) => i !== index))}
                >
                  <X aria-hidden />
                </Button>
              </div>
              {product?.slaves && (
                <ul className="ml-3 flex flex-col gap-1 border-l pl-3" aria-label={t('slavesOf', { label })}>
                  {Array.from({ length: line.slaves }, (_, slave) => (
                    <li key={slave} className="flex items-center gap-2 text-sm">
                      <CornerDownRight className="size-3.5 text-muted-foreground" aria-hidden />
                      <span className="flex-1">
                        {label} REPLICA {slave + 1}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label={t('removeSlave', { number: slave + 1 })}
                        title={t('removeSlave', { number: slave + 1 })}
                        onClick={() => update(index, { slaves: line.slaves - 1 })}
                      >
                        <X aria-hidden />
                      </Button>
                    </li>
                  ))}
                  <li>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={line.slaves >= 50}
                      onClick={() => update(index, { slaves: line.slaves + 1 })}
                    >
                      <Plus aria-hidden />
                      {t('addSlave')}
                    </Button>
                  </li>
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <Button size="sm" variant="outline" className="w-fit" onClick={() => onChange([...lines, emptyLine()])}>
        <Plus aria-hidden />
        {t('addLine')}
      </Button>
    </div>
  );
}

/** Icône d'un emplacement ou d'une ligne. */
export function slotIcon(kind: string) {
  return kind === 'hypervision' ? Monitor : Server;
}

/** Résumé d'un élément de modèle : « 1 × SL TEMPO », « SL MEDIA + 3 REPLICA ». */
export function describeItem(item: TemplateItem): string {
  if (item.kind === 'support') return `Support : ${item.label}`;
  const head = item.count > 1 ? `${item.count} × ${item.label}` : item.label;
  return item.slaves ? `${head} + ${item.slaves} REPLICA` : head;
}
