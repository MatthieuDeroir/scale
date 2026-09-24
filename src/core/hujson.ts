/**
 * Convertit du HuJSON (JSON + commentaires `//` et `/* *\/`, virgules
 * finales acceptées) en JSON strict, pour pouvoir parser la politique que
 * Headscale renvoie en texte brut (`GET /api/v1/policy`).
 *
 * Écriture asymétrique et volontaire : on ne réécrit jamais du HuJSON à la
 * main, `PUT /api/v1/policy` reçoit du `JSON.stringify` — du JSON strict
 * est du HuJSON valide (sous-ensemble), donc aucune conversion inverse n'est
 * nécessaire. Contrepartie assumée : les commentaires d'une politique éditée
 * à la main sont perdus au premier passage dans l'éditeur guidé.
 */
export function hujsonToJson(source: string): string {
  return stripTrailingCommas(stripComments(source));
}

function stripComments(source: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (inString) {
      out += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
      continue;
    }

    if (char === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++; // sur le '*' de fermeture ; la boucle avance encore d'un cran sur '/'
      continue;
    }

    out += char;
  }

  return out;
}

function stripTrailingCommas(source: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      out += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }

    if (char === ',') {
      let j = i + 1;
      while (j < source.length && /\s/.test(source[j])) j++;
      if (source[j] === '}' || source[j] === ']') {
        continue; // virgule finale — on ne l'émet pas
      }
    }

    out += char;
  }

  return out;
}
