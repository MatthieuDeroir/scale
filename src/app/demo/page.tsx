'use client';

import {
  Activity,
  ArrowRight,
  BellRing,
  Boxes,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  HardDrive,
  Layers,
  Laptop,
  MapPin,
  MonitorSmartphone,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  ShieldAlert,
  UserRoundCheck,
  Wifi,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { cn } from '@/shared/lib';

type FleetId = 'windows' | 'media' | 'piscine';

const FLEETS: Record<FleetId, { name: string; city: string; customer: string; machines: number; online: number; status: 'ok' | 'warning' }> = {
  windows: { name: 'Banc Windows', city: 'Laboratoire', customer: 'Équipe Stramatel', machines: 2, online: 2, status: 'ok' },
  media: { name: 'Pilote SL MEDIA', city: 'Laboratoire', customer: 'Équipe Stramatel', machines: 2, online: 2, status: 'ok' },
  piscine: { name: 'Banc piscine', city: 'Laboratoire', customer: 'Équipe Stramatel', machines: 3, online: 2, status: 'warning' },
};

const MACHINES: Record<FleetId, Array<{ name: string; product: string; role: string; version: string; lastSeen: string; state: 'online' | 'maintenance' | 'offline'; issue?: string }>> = {
  windows: [
    { name: 'SL VIDEO SYSTEM 3', product: 'SL VIDEO SYSTEM 3', role: 'Équipement Windows', version: '3.11.0', lastSeen: 'À l’instant', state: 'online' },
    { name: 'POSTE HYPERVISION CLIENT', product: 'Poste hypervision', role: 'Client support', version: '2.8.0', lastSeen: 'À l’instant', state: 'online' },
  ],
  media: [
    { name: 'SL MEDIA 01', product: 'SL MEDIA', role: 'Serveur média', version: '5.4.2', lastSeen: 'À l’instant', state: 'online' },
    { name: 'SL MEDIA REPLICA 01', product: 'SL MEDIA', role: 'Réplica', version: '5.4.2', lastSeen: 'À l’instant', state: 'online' },
  ],
  piscine: [
    { name: 'SL TEMPO 01', product: 'SL TEMPO', role: 'Serveur', version: '4.6.0', lastSeen: 'Il y a 22 min', state: 'offline', issue: 'Connexion à vérifier' },
    { name: 'SL MEDIA', product: 'SL MEDIA', role: 'Serveur média', version: '5.4.2', lastSeen: 'À l’instant', state: 'online' },
    { name: 'POSTE HYPERVISION', product: 'Poste hypervision', role: 'Client support', version: '2.8.0', lastSeen: 'À l’instant', state: 'online' },
  ],
};

function StateBadge({ state }: { state: 'online' | 'maintenance' | 'offline' }) {
  const labels = { online: 'En ligne', maintenance: 'À mettre à jour', offline: 'Hors ligne' };
  const variants = { online: 'ok', maintenance: 'warning', offline: 'critical' } as const;
  return <Badge variant={variants[state]}><span className={cn('size-1.5 rounded-full', state === 'online' ? 'bg-emerald-500' : state === 'maintenance' ? 'bg-amber-500' : 'bg-destructive')} />{labels[state]}</Badge>;
}

export default function DemoPage() {
  const [fleetId, setFleetId] = useState<FleetId>('windows');
  const [notice, setNotice] = useState('Aucune action en cours');
  const fleet = FLEETS[fleetId];
  const machines = useMemo(() => MACHINES[fleetId], [fleetId]);
  const machinesShown = machines.slice(0, 4);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="border-b border-amber-300 bg-amber-50 px-5 py-2 text-center text-sm text-amber-950">
        <strong>Vitrine Stramscale</strong> — données fictives, sans connexion à une machine ni appel au backend.
      </div>
      <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8">
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-slate-950 text-white shadow-sm"><Network className="size-5" /></div>
            <div>
              <p className="text-xl font-bold tracking-tight">stramscale</p>
              <p className="text-sm text-slate-500">Pilotage du parc Stramatel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900"><CircleHelp className="size-3.5" /> Mode démonstration</Badge>
            <Button variant="outline" size="sm" onClick={() => setNotice('Tableau actualisé à partir des données de démonstration.')}><RefreshCw /> Actualiser</Button>
          </div>
        </header>

        <section className="mt-7 grid gap-5 lg:grid-cols-[15rem_1fr]">
          <aside className="rounded-xl bg-slate-950 p-4 text-slate-100">
            <p className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Parc Stramatel</p>
            <nav className="space-y-1" aria-label="Navigation de démonstration">
              {[
                [Layers, 'Tableau de bord'], [Server, 'Flottes'], [MonitorSmartphone, 'Machines'], [ShieldCheck, 'Cybersécurité'], [UserRoundCheck, 'Support'], [Boxes, 'Produits'],
              ].map(([Icon, label], index) => {
                const IconComponent = Icon as typeof Layers;
                return <button key={String(label)} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm', index === 0 ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10')} onClick={() => setNotice(`${label} : aperçu disponible dans la démo.`)}><IconComponent className="size-4" />{String(label)}</button>;
              })}
            </nav>
            <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-300">
              <Cloud className="mb-2 size-4 text-slate-400" />
              Hébergement cible : VPS administré par Stramatel. Les fonctions locales des produits restent indépendantes de ce portail.
            </div>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-brand">Vue direction · exploitation · support</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight">Un parc lisible, actionnable et cloisonné.</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Une même vue pour suivre les équipements, donner les bons accès au support et préparer les actions de maintenance.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm"><Activity className="mr-2 inline size-4 text-emerald-600" />{notice}</div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={Wifi} label="Machines connectées" value="17 / 18" detail="3 flottes suivies" tone="ok" />
              <Metric icon={ShieldAlert} label="Points à traiter" value="2" detail="1 mise à jour, 1 connexion" tone="warning" />
              <Metric icon={Wrench} label="Actions récentes" value="12" detail="sur les 7 derniers jours" tone="default" />
              <Metric icon={HardDrive} label="Versions suivies" value="6" detail="images et applications" tone="default" />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
              <Card>
                <CardHeader className="px-5 pb-3 pt-5">
                  <CardTitle className="flex items-center gap-2 text-base"><Layers className="size-4 text-slate-500" />Flottes clients</CardTitle>
                  <CardDescription>Chaque client ne voit que sa propre flotte.</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-1">
                    {(Object.entries(FLEETS) as Array<[FleetId, typeof fleet]>).map(([id, item]) => (
                      <button key={id} onClick={() => { setFleetId(id); setNotice(`Flotte « ${item.name} » sélectionnée.`); }} className={cn('grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors', id === fleetId ? 'bg-slate-100' : 'hover:bg-slate-50')}>
                        <span className="min-w-0"><span className="flex items-center gap-2 font-medium"><MapPin className="size-4 shrink-0 text-slate-500" />{item.name}</span><span className="ml-6 mt-1 block truncate text-xs text-slate-500">{item.customer} · {item.city}</span></span>
                        <span className="flex items-center gap-3"><span className="text-right text-xs text-slate-500"><strong className="block text-sm text-slate-800">{item.online}/{item.machines}</strong>en ligne</span><span className={cn('size-2 rounded-full', item.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500')} /><ChevronRight className="size-4 text-slate-400" /></span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-5 pb-3 pt-5"><CardTitle className="flex items-center gap-2 text-base"><BellRing className="size-4 text-slate-500" />À suivre</CardTitle><CardDescription>Les éléments qui appellent une décision ou une vérification.</CardDescription></CardHeader>
                <CardContent className="space-y-3 px-5 pb-5">
                  <Alert title="Mise à jour disponible" text="SL VIDEO SYSTEM 3 peut être mis à jour après validation." variant="warning" />
                  <Alert title="Connexion à vérifier" text="SL TEMPO 01 est indisponible depuis 22 minutes." variant="critical" />
                  <Alert title="Support prêt" text="Les droits de support sont limités à chaque flotte et journalisés." variant="ok" />
                </CardContent>
              </Card>
            </div>

            <Card className="mt-5">
              <CardHeader className="flex flex-col gap-3 px-5 pb-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div><CardTitle className="flex items-center gap-2 text-base"><Server className="size-4 text-slate-500" />{fleet.name}</CardTitle><CardDescription>{fleet.customer} · {fleet.city} · {fleet.machines} machines</CardDescription></div>
                <Button size="sm" variant="brand" onClick={() => setNotice('Action simulée : ouverture d’une demande de support pour cette flotte.')}><Wrench />Ouvrir le support</Button>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3 font-medium">Machine</th><th className="pb-3 font-medium">Produit / rôle</th><th className="pb-3 font-medium">Version</th><th className="pb-3 font-medium">Dernière activité</th><th className="pb-3 font-medium">État</th></tr></thead><tbody>{machinesShown.map((machine) => <tr key={machine.name} className="border-b border-slate-100 last:border-0"><td className="py-3 font-medium text-slate-900">{machine.name}</td><td className="py-3"><span className="block">{machine.product}</span><span className="text-xs text-slate-500">{machine.role}</span></td><td className="py-3 font-mono text-xs">v{machine.version}</td><td className="py-3 text-slate-600">{machine.lastSeen}</td><td className="py-3"><StateBadge state={machine.state} />{machine.issue && <span className="mt-1 block text-xs text-slate-500">{machine.issue}</span>}</td></tr>)}</tbody></table></div>
              </CardContent>
            </Card>

            <section className="mt-5 grid gap-4 md:grid-cols-3">
              <Feature icon={UserRoundCheck} title="Support cadré" text="Des responsables produit associés aux accès utiles, sans accès global au parc." />
              <Feature icon={ShieldCheck} title="Suivi sécurité" text="Versions, alertes et corrections suivies par produit et par machine." />
              <Feature icon={Check} title="Déploiements maîtrisés" text="Actions préparées, validées et tracées avant leur diffusion sur une flotte." />
            </section>
          </div>
        </section>
        <footer className="mt-8 border-t border-slate-200 py-5 text-xs text-slate-500">Stramscale · aperçu de démonstration · aucune donnée client, aucun accès réseau, aucune action réelle.</footer>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Wifi; label: string; value: string; detail: string; tone: 'ok' | 'warning' | 'default' }) {
  const colors = { ok: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-700', default: 'bg-slate-100 text-slate-700' };
  return <Card><CardContent className="flex items-start gap-3 p-4"><span className={cn('grid size-9 place-items-center rounded-lg', colors[tone])}><Icon className="size-4" /></span><span><span className="block text-xs text-slate-500">{label}</span><strong className="mt-0.5 block text-xl leading-6">{value}</strong><span className="block text-xs text-slate-500">{detail}</span></span></CardContent></Card>;
}

function Alert({ title, text, variant }: { title: string; text: string; variant: 'ok' | 'warning' | 'critical' }) {
  const colors = { ok: 'border-emerald-200 bg-emerald-50', warning: 'border-amber-200 bg-amber-50', critical: 'border-red-200 bg-red-50' };
  const icons = { ok: Check, warning: ShieldAlert, critical: BellRing };
  const Icon = icons[variant];
  return <div className={cn('flex gap-3 rounded-lg border p-3', colors[variant])}><Icon className="mt-0.5 size-4 shrink-0" /><div><p className="text-sm font-medium">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-600">{text}</p></div></div>;
}

function Feature({ icon: Icon, title, text }: { icon: typeof Wifi; title: string; text: string }) {
  return <Card><CardContent className="p-4"><Icon className="size-5 text-brand" /><h2 className="mt-3 text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-700">Voir le principe <ArrowRight className="size-3" /></span></CardContent></Card>;
}
