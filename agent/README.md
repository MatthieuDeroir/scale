# Agent Stramscale

Script unique installé dans l'image dorée des NUC et Raspberry Pi. Il enrôle la machine au
premier démarrage, envoie son inventaire (matériel, OS, paquets) et exécute les mises à
jour demandées depuis Stramscale.

**Principes** : l'agent tire ses ordres (aucun port ouvert, pas de SSH) ; il n'accepte que
deux actions, « mettre à jour le paquet X » et « mettre à jour le système » (`apt-get
upgrade`, jamais `dist-upgrade` ni changement de version de l'OS) ; il revalide le nom de
paquet lui-même. Son jeton, propre à la machine, est remis une seule fois à l'enrôlement.

Dépendances : `bash`, `curl`, `python3`, `apt`, `tailscale`.

## Installation dans l'image dorée

```bash
install -m 755 stramscale-agent.sh /usr/local/bin/stramscale-agent
install -d -m 700 /etc/stramscale && install -m 600 agent.conf.example /etc/stramscale/agent.conf
# renseigner STRAMSCALE_URL et PROVISIONING_SECRET, puis :
install -m 644 systemd/* /etc/systemd/system/
systemctl enable stramscale-agent-enroll.service stramscale-agent-poll.timer stramscale-agent-report.timer
```

Ne **pas** démarrer l'enrôlement dans l'image elle-même : il doit tourner au premier
démarrage de chaque clone (d'où `ConditionPathExists=!/var/lib/stramscale/agent-token`).

## Ce que Stramscale reçoit

Nom d'hôte, OS et version, noyau, architecture, processeur, cœurs, mémoire, disque (total et
libre), durée de fonctionnement, liste des paquets installés et de ceux qui ont une mise à
jour, n° de série et modèle.
