/**
 * Registre des services côté serveur des data-modules.
 *
 * Un data-module n'est pas seulement de l'affichage : il peut posséder un
 * service serveur qui parle au matériel. C'est le quatrième axe du socle.
 *
 * Contrat attendu de src/data-modules/<id>/services/<id>.service.mjs :
 *   initialize(io, prisma) : Promise<void>   démarrage
 *   stop()                 : void            arrêt propre        (optionnel)
 *   getConnectionData()    : {event, data}   état à la connexion (optionnel)
 *   handleDataChange(data) : Promise<void>   réaction aux changements (optionnel)
 */
import { activeModuleIds } from './.generated/active-modules.mjs';

let cached = null;

export async function getActiveServices() {
  const services = [];
  for (const id of activeModuleIds) {
    try {
      const mod = await import(`../src/data-modules/${id}/services/${id}.service.mjs`);
      services.push({ name: id, ...mod });
    } catch {
      // Un module sans service serveur, c'est le cas normal.
    }
  }
  cached = services;
  return services;
}

export async function getServiceByName(name) {
  const services = cached || (await getActiveServices());
  return services.find((s) => s.name === name) || null;
}
