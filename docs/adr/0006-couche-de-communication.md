# ADR 0006 — Trois transports, un seul invariant

**Statut** : accepté · **Date** : 2026-09-08

## Contexte

Un produit Stramatel communique par trois voies, et les trois existent déjà dans la gamme —
mais chacune avec un défaut que l'autre ne fait pas.

| Voie | Où elle vit | Ce qui manque |
|---|---|---|
| Série | G552 (`SerialPortConnection.js`) | terminateur `0x0D` **jamais vérifié** ; une trame tronquée est livrée telle quelle |
| UDP | SL MEDIA `udp-listener.service.mjs` · ServeurTemps `udp-listener.js` + `udp-broadcaster.js` | SL MEDIA sait écouter mais pas émettre ; **ServeurTemps ouvre deux sockets sur le même port** |
| WebSocket | SL MEDIA, ServeurTemps | **poignée de main non authentifiée** — constat B3 de l'audit SL MEDIA, toujours ouvert |

Le troisième point mérite d'être isolé, parce qu'il se reproduit à chaque projet : **une socket
n'hérite pas du middleware HTTP.** Une application dont toutes les routes sont protégées peut
avoir un WebSocket complètement ouvert, et rien dans le code ne le signale.

## Décision

Une couche `server/transport/` unique, trois transports, un invariant commun.

```
frame-codec.mjs   découpage, validation, journalisation, recul — PUR
serial.mjs        flux d'octets : réassemblage, dispatch par type de trame
udp.mjs           datagrammes : dispatch par octet de tête, émission incluse
realtime.mjs      Socket.io authentifié
```

### L'invariant : un port, une socket

Le transport possède le port et redistribue aux abonnés. Aucun module n'ouvre le sien.

La raison est écrite en commentaire dans le listener UDP de SL MEDIA et vaut pour les deux
transports : en unicast, un datagramme n'est remis qu'à **une** socket. Si chaque module lie la
sienne, le dernier lié reçoit tout et les autres sont sourds. La même chose vaut pour un port
série, où l'ouverture concurrente échoue franchement.

**Généralisation apportée ici** : la socket qui écoute est aussi celle qui émet. ServeurTemps
en ouvre deux sur le port 9761 — un `UdpListener` et un `UdpBroadcaster` — ce qui expose
exactement au problème décrit ci-dessus dès qu'une horloge répond en unicast.

### Le codec est pur, donc testé

`extractFrames` et `validateFrame` ne connaissent ni socket, ni port, ni horloge : des octets
en entrée, des trames en sortie. C'est la partie la plus piégeuse du produit et la seule qu'on
puisse couvrir intégralement sans matériel — 14 tests, dont la resynchronisation après
troncature que le G552 ne fait pas.

### Le protocole n'est jamais supposé

`subscribeSerial` et `subscribeUdp` **refusent de démarrer** sans un `protocol
{ startByte, frameSize, endByte? }` déclaré par le module. Un défaut RSCOM dans le socle
imposerait `0xF8` / 54 octets à tout projet Stramatel, y compris à ceux qui ne parlent pas au
pupitre.

### La poignée de main WebSocket vérifie la session

Si la fonctionnalité `auth` est active, `setupRealtime` lit le cookie de session dans les
en-têtes de la poignée de main et refuse la connexion sans session valide. La session est
attachée à `socket.data`, ce qui permet à `emitToRole` de restreindre une diffusion sans
requête supplémentaire.

Si `auth` est inactive, la socket accepte tout **et le démarrage l'écrit dans le journal** :
c'est alors une décision à documenter dans l'analyse de risques du produit (profil P3 de la
baseline), pas un oubli.

## Conséquences

- `server/socket/` disparaît ; `setupSocket` devient `setupRealtime` et prend un troisième
  argument, la configuration d'authentification.
- Un produit qui n'utilise aucun transport matériel supprime `server/transport/serial.mjs` et
  la dépendance `serialport` ; `udp.mjs` et `realtime.mjs` n'ont aucune dépendance externe
  au-delà de Socket.io.
- Un émetteur qui a besoin d'écrire vers l'équipement dispose de `sendSerial` et `sendUdp` sur
  la socket déjà ouverte, sans en créer une seconde.

## Vérifié le 2026-09-08

| | |
|---|---|
| Codec | 14 tests — extraction, concaténation, bruit, reliquat, **resynchronisation après terminateur faux** |
| UDP | deux abonnés sur le même port, dispatch par octet de tête ; trames invalides et types inconnus **non livrés** ; émission depuis la socket du port |
| WebSocket | sans cookie **refusé** · cookie invalide **refusé** · session valide **connecté** |
