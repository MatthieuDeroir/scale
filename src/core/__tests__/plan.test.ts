import { describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({ prisma: {} }));

const { numberedLabels, planToTemplateItems, tagsFor } = await import('../plan');
const { slotHostname } = await import('../hostname');

describe('plan de flotte', () => {
  it('numérote les emplacements identiques sans reprendre un libellé pris', () => {
    expect(numberedLabels('SL TEMPO', 1, [])).toEqual(['SL TEMPO']);
    expect(numberedLabels('SL MEDIA REPLICA', 3, [])).toEqual(['SL MEDIA REPLICA 1', 'SL MEDIA REPLICA 2', 'SL MEDIA REPLICA 3']);
    expect(numberedLabels('SL MEDIA REPLICA', 2, ['SL MEDIA REPLICA 1', 'SL MEDIA REPLICA 3'])).toEqual([
      'SL MEDIA REPLICA 2',
      'SL MEDIA REPLICA 4',
    ]);
    // Un seul emplacement mais libellé déjà pris : numéroté aussi.
    expect(numberedLabels('SL TEMPO', 1, ['SL TEMPO'])).toEqual(['SL TEMPO 1']);
  });

  it('pose la flotte et le rôle, retire l’ancienne flotte et l’ancien rôle', () => {
    expect(tagsFor(['tag:a-assigner', 'tag:ssh'], 'tag:flotte-b', { hypervision: false, master: true })).toEqual([
      'tag:flotte-b',
      'tag:serveur',
      'tag:ssh',
    ]);
    expect(tagsFor(['tag:flotte-a', 'tag:serveur'], 'tag:flotte-b', { hypervision: false, master: false })).toEqual([
      'tag:flotte-b',
    ]);
  });

  it('regroupe le plan en éléments de modèle : serveurs avec leurs REPLICA, numéros retirés', () => {
    expect(
      planToTemplateItems([
        { id: 1, kind: 'equipment', productId: 2, label: 'SL TEMPO', parentSlotId: null },
        { id: 2, kind: 'equipment', productId: 1, label: 'SL MEDIA', parentSlotId: null },
        { id: 3, kind: 'equipment', productId: 1, label: 'SL MEDIA REPLICA 1', parentSlotId: 2 },
        { id: 4, kind: 'equipment', productId: 1, label: 'SL MEDIA REPLICA 2', parentSlotId: 2 },
        { id: 5, kind: 'hypervision', productId: null, label: "Poste d'hypervision", parentSlotId: null },
      ])
    ).toEqual([
      { kind: 'equipment', productId: 2, count: 1, label: 'SL TEMPO' },
      { kind: 'equipment', productId: 1, count: 1, label: 'SL MEDIA', slaves: 2 },
      { kind: 'hypervision', productId: null, count: 1, label: "Poste d'hypervision" },
    ]);
  });

  it('préfixe le nom réseau par la flotte : un SL MEDIA par flotte, des noms uniques dans le VPN', () => {
    expect(slotHostname('tag:flotte-piscine', 'SL MEDIA')).toBe('piscine-sl-media');
    expect(slotHostname('tag:flotte-cinema', "Poste d'hypervision")).toBe('cinema-poste-d-hypervision');
    expect(slotHostname('tag:interne', 'SL MEDIA REPLICA 1')).toBe('interne-sl-media-replica-1');
  });
});
