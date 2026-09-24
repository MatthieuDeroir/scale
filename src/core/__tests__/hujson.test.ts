import { describe, expect, it } from 'vitest';
import { hujsonToJson } from '../hujson';

describe('hujsonToJson', () => {
  it('retire les commentaires de ligne et les virgules finales', () => {
    const source = `{
      // commentaire
      "tagOwners": {
        "tag:interne": ["stramatel@"],
      },
      "acls": [
        {"action": "accept", "src": ["tag:interne"], "dst": ["*:*"]},
      ],
    }`;

    expect(JSON.parse(hujsonToJson(source))).toEqual({
      tagOwners: { 'tag:interne': ['stramatel@'] },
      acls: [{ action: 'accept', src: ['tag:interne'], dst: ['*:*'] }],
    });
  });

  it('retire les commentaires bloc', () => {
    const source = '{ /* bloc\nsur plusieurs lignes */ "a": 1 }';
    expect(JSON.parse(hujsonToJson(source))).toEqual({ a: 1 });
  });

  it('ne touche pas à un « // » ou une virgule à l’intérieur d’une chaîne', () => {
    const source = '{ "url": "https://example.com", "note": "un, deux," }';
    expect(JSON.parse(hujsonToJson(source))).toEqual({
      url: 'https://example.com',
      note: 'un, deux,',
    });
  });

  it('gère les guillemets échappés dans une chaîne', () => {
    const source = String.raw`{ "a": "il a dit \"salut\"" }`;
    expect(JSON.parse(hujsonToJson(source))).toEqual({ a: 'il a dit "salut"' });
  });

  it('analyse la politique réelle de dev-local', () => {
    const source = `{
  // Qui a le droit de créer des machines avec quel tag (sans ça, une clé
  // taguée est refusée à l'enregistrement).
  "tagOwners": {
    "tag:interne": ["stramatel@"],
    "tag:flotte-clienta": ["stramatel@"],
    "tag:flotte-clientb": ["stramatel@"],
  },

  // F3 : cloisonnement strict flotte/flotte, accès total pour l'interne.
  "acls": [
    // L'interne Stramatel (support, pipelines) voit tout le parc.
    {
      "action": "accept",
      "src": ["tag:interne"],
      "dst": ["*:*"],
    },
    // Chaque flotte ne voit qu'elle-même.
    {
      "action": "accept",
      "src": ["tag:flotte-clienta"],
      "dst": ["tag:flotte-clienta:*"],
    },
    {
      "action": "accept",
      "src": ["tag:flotte-clientb"],
      "dst": ["tag:flotte-clientb:*"],
    },
  ],
}`;

    const parsed = JSON.parse(hujsonToJson(source));
    expect(Object.keys(parsed.tagOwners)).toEqual([
      'tag:interne',
      'tag:flotte-clienta',
      'tag:flotte-clientb',
    ]);
    expect(parsed.acls).toHaveLength(3);
  });
});
