/**
 * CSV lisible par Excel en français : séparateur « ; », BOM UTF-8 pour les
 * accents. Les cellules qui commencent par = + - @ sont préfixées d'une
 * apostrophe : un nom de machine ne doit jamais devenir une formule.
 */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const cell = (value: string | number | null | undefined) => {
    let text = value == null ? '' : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n');
}

export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** « parc-clienta-2026-09-25.csv » */
export function datedFilename(base: string, extension = 'csv'): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
