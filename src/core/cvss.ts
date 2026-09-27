/**
 * Score de base CVSS 3.0 / 3.1 depuis son vecteur, selon la formule de la
 * spécification FIRST (section 7). `null` si le vecteur est incomplet.
 */
const WEIGHTS = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 },
} as const;

/** Arrondi supérieur à une décimale, sans les erreurs de flottant (annexe A). */
function roundUp(value: number): number {
  const integer = Math.round(value * 100000);
  return integer % 10000 === 0 ? integer / 100000 : (Math.floor(integer / 10000) + 1) / 10;
}

export function cvss3BaseScore(vector: string): number | null {
  if (!/^CVSS:3\.[01]\//.test(vector)) return null;
  const metrics = Object.fromEntries(
    vector
      .split('/')
      .slice(1)
      .map((part) => part.split(':') as [string, string])
  );
  const { AV, AC, PR, UI, S, C, I, A } = metrics;
  const av = WEIGHTS.AV[AV as keyof typeof WEIGHTS.AV];
  const ac = WEIGHTS.AC[AC as keyof typeof WEIGHTS.AC];
  const ui = WEIGHTS.UI[UI as keyof typeof WEIGHTS.UI];
  const [c, i, a] = [C, I, A].map((value) => WEIGHTS.CIA[value as keyof typeof WEIGHTS.CIA]);
  const changed = S === 'C';
  const pr = { N: 0.85, L: changed ? 0.68 : 0.62, H: changed ? 0.5 : 0.27 }[PR as 'N' | 'L' | 'H'];
  if ([av, ac, ui, c, i, a, pr].some((value) => value === undefined) || (S !== 'U' && S !== 'C')) return null;

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  const exploitability = 8.22 * av * ac * pr * ui;
  if (impact <= 0) return 0;
  return roundUp(Math.min((changed ? 1.08 : 1) * (impact + exploitability), 10));
}
