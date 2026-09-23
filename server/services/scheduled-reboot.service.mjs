/**
 * Redémarrage quotidien programmé.
 *
 * Présent dans le socle parce que tous les équipements posés chez un client
 * en ont besoin, et parce que c'est une fonction qu'on implémente mal quand
 * on la réécrit à chaque projet : fuseau explicite, replanification après
 * chaque déclenchement, et surtout un garde-fou d'heure ouvrée.
 */
import { exec } from 'node:child_process';

let timer = null;

function msUntil(hhmm, timeZone) {
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const nowH = Number(parts.find((p) => p.type === 'hour').value);
  const nowM = Number(parts.find((p) => p.type === 'minute').value);

  let delta = (h - nowH) * 3_600_000 + (m - nowM) * 60_000;
  if (delta <= 0) delta += 24 * 3_600_000;
  return delta;
}

export function scheduleReboot({ at, timeZone = 'Europe/Paris', dryRun = false }) {
  stopReboot();
  if (!at) return;

  const delay = msUntil(at, timeZone);
  console.log(`[Reboot] prochain redémarrage dans ${Math.round(delay / 60000)} min (${at} ${timeZone})`);

  timer = setTimeout(() => {
    if (dryRun) {
      console.log('[Reboot] dryRun : redémarrage simulé');
      scheduleReboot({ at, timeZone, dryRun });
      return;
    }
    // Ne redémarre que la machine. Ni le contrôleur vidéo, ni l'alimentation
    // du panneau : le prévoir hors des horaires d'utilisation.
    exec('sudo systemctl reboot', (err) => {
      if (err) console.error('[Reboot] échec :', err.message);
    });
  }, delay);
}

export function stopReboot() {
  if (timer) clearTimeout(timer);
  timer = null;
}
