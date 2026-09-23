#!/usr/bin/env bash
# =============================================================================
# Audit de durcissement Linux — timeserver (STRAMATEL)
# Lecture seule : ne modifie RIEN sur le système. Référentiel : ANSSI / CIS.
#
# Usage (sur la machine) :   bash hardening-check.sh | tee hardening-report.txt
# Usage (à distance)      :   ssh stramatel@timeserver 'bash -s' < hardening-check.sh | tee hardening-report.txt
#
# Certains contrôles nécessitent root pour être complets (sudo bash ...).
# =============================================================================
set -u
C_OK=$'\e[32m'; C_WARN=$'\e[33m'; C_BAD=$'\e[31m'; C_HDR=$'\e[1;36m'; C_0=$'\e[0m'
sec(){ printf '\n%s===== %s =====%s\n' "$C_HDR" "$1" "$C_0"; }
note(){ printf '  %s\n' "$1"; }

printf '%s' "Audit durcissement — $(hostname) — $(date -Is)"
[ "$(id -u)" -ne 0 ] && printf '  %s(exécuté sans root : certains contrôles seront partiels)%s' "$C_WARN" "$C_0"
echo

sec "1. Système & mises à jour"
. /etc/os-release 2>/dev/null; note "OS    : ${PRETTY_NAME:-?}"
note "Noyau : $(uname -r)"
note "Uptime: $(uptime -p 2>/dev/null)"
if command -v apt >/dev/null; then
  upd=$(apt-get -s upgrade 2>/dev/null | grep -c '^Inst')
  sec_upd=$(apt-get -s upgrade 2>/dev/null | grep -i secur | grep -c '^Inst')
  note "Paquets à mettre à jour : ${upd:-?} (dont sécurité : ${sec_upd:-?})"
  dpkg -l unattended-upgrades 2>/dev/null | grep -q '^ii' \
    && note "${C_OK}unattended-upgrades installé${C_0}" \
    || note "${C_WARN}unattended-upgrades absent (pas de MAJ auto de sécurité)${C_0}"
fi

sec "2. Comptes & authentification"
note "Comptes UID 0 (doivent se limiter à root) :"
awk -F: '$3==0{print "   - "$1}' /etc/passwd
note "Comptes avec shell de connexion :"
awk -F: '$7 ~ /(bash|sh|zsh)$/ {print "   - "$1" ("$7")"}' /etc/passwd
note "Comptes SANS mot de passe (vide) :"
empty=$(sudo awk -F: '($2==""){print $1}' /etc/shadow 2>/dev/null)
[ -n "$empty" ] && note "${C_BAD}   $empty${C_0}" || note "${C_OK}   aucun${C_0}"
note "Politique d'expiration des mots de passe (/etc/login.defs) :"
grep -E '^(PASS_MAX_DAYS|PASS_MIN_DAYS|PASS_WARN_AGE)' /etc/login.defs 2>/dev/null | sed 's/^/   /'
note "Robustesse mot de passe (pam_pwquality/cracklib) :"
grep -rlE 'pam_(pwquality|cracklib)' /etc/pam.d/ 2>/dev/null | sed 's/^/   /' || note "${C_WARN}   non configuré${C_0}"

sec "3. SSH (/etc/ssh/sshd_config)"
if [ -r /etc/ssh/sshd_config ]; then
  eff(){ sudo sshd -T 2>/dev/null | grep -i "^$1 " || grep -iE "^\s*$1" /etc/ssh/sshd_config 2>/dev/null; }
  for k in permitrootlogin passwordauthentication pubkeyauthentication \
           x11forwarding permitemptypasswords maxauthtries port \
           allowtcpforwarding clientaliveinterval; do
    note "$(eff "$k" | head -1 | sed 's/^ *//')"
  done
  note "→ Cible durcie : PermitRootLogin no · PasswordAuthentication no · PermitEmptyPasswords no · MaxAuthTries 3-4"
else
  note "${C_WARN}sshd_config illisible sans root${C_0}"
fi

sec "4. Pare-feu & ports en écoute"
if command -v ufw >/dev/null; then note "UFW : $(sudo ufw status 2>/dev/null | head -1)"; fi
if command -v nft >/dev/null; then n=$(sudo nft list ruleset 2>/dev/null | wc -l); note "nftables : $n lignes de règles"; fi
command -v firewall-cmd >/dev/null && note "firewalld : $(sudo firewall-cmd --state 2>/dev/null)"
note "Ports en écoute (TCP/UDP) :"
(sudo ss -tulpnH 2>/dev/null || ss -tulnH) | awk '{print "   "$1" "$5"  "$7}' | sort -u

sec "5. Sudo"
note "Règles NOPASSWD (élargissent la surface d'attaque) :"
sudo grep -rEh 'NOPASSWD' /etc/sudoers /etc/sudoers.d/ 2>/dev/null | sed 's/^/   /' || note "   (lecture nécessite root)"
note "Wildcards dangereux dans sudoers (ALL / *) :"
sudo grep -rEh '\bALL\b.*\bALL\b|\*' /etc/sudoers.d/ 2>/dev/null | sed 's/^/   /'

sec "6. Services & exposition"
note "Services systemd actifs (extrait) :"
systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null | awk '{print "   "$1}' | head -40
note "Services activés au boot avec sockets réseau :"
note "(rapprocher de la section 4 ; désactiver tout service non nécessaire)"

sec "7. Durcissement noyau (sysctl)"
for k in net.ipv4.ip_forward net.ipv4.conf.all.rp_filter \
         net.ipv4.conf.all.accept_redirects net.ipv4.tcp_syncookies \
         kernel.randomize_va_space kernel.kptr_restrict kernel.dmesg_restrict \
         net.ipv4.conf.all.accept_source_route; do
  note "$k = $(sysctl -n $k 2>/dev/null)"
done
note "→ Attendu : rp_filter=1, accept_redirects=0, tcp_syncookies=1, randomize_va_space=2, kptr_restrict>=1, ip_forward=0 (sauf si routeur DHCP)"

sec "8. MAC (SELinux / AppArmor)"
command -v getenforce >/dev/null && note "SELinux : $(getenforce)"
if command -v aa-status >/dev/null; then
  note "AppArmor : $(sudo aa-status 2>/dev/null | head -1)"
else note "${C_WARN}AppArmor/SELinux non détecté (pas de MAC)${C_0}"; fi

sec "9. Fichiers sensibles & SUID"
note "Permissions de fichiers critiques :"
for f in /etc/shadow /etc/passwd /etc/ssh/sshd_config /etc/sudoers; do
  note "   $(stat -c '%A %U:%G %n' "$f" 2>/dev/null)"
done
note "Secret applicatif / .env sur disque :"
sudo find /opt /home /etc -maxdepth 4 -name '.env*' -o -name 'secret*' 2>/dev/null | grep -vi example | sed 's/^/   /' | head -20
note "Binaires SUID inhabituels (hors liste standard) :"
sudo find / -xdev -perm -4000 -type f 2>/dev/null \
  | grep -vE '/(sudo|su|mount|umount|passwd|chsh|chfn|newgrp|gpasswd|pkexec|ping|fusermount[0-9]*|ssh-keysign|dbus-daemon-launch-helper|polkit-agent-helper-1|unix_chkpwd)$' \
  | sed 's/^/   /' | head -20

sec "10. Horodatage / NTP / journaux"
note "Synchro temps : $(timedatectl show -p NTPSynchronized --value 2>/dev/null)"
note "chrony/ntp actif : $(systemctl is-active chrony chronyd ntp 2>/dev/null | tr '\n' ' ')"
note "Persistance des journaux (journald) :"
note "   Storage=$(grep -E '^\s*Storage' /etc/systemd/journald.conf 2>/dev/null | awk -F= '{print $2}' | tr -d ' ' || echo 'défaut(auto)')"
command -v auditctl >/dev/null && note "auditd : $(systemctl is-active auditd 2>/dev/null)" || note "${C_WARN}auditd absent (pas d'audit système)${C_0}"

sec "11. Application ServeurTemps"
note "Service applicatif :"
systemctl status stramatel-serveur-temps.service --no-pager 2>/dev/null | grep -E 'Loaded|Active|Main PID' | sed 's/^/   /'
note "Utilisateur d'exécution du service (root = à éviter) :"
ps -o user= -C node 2>/dev/null | sort -u | sed 's/^/   /'
note "Options de durcissement systemd du service :"
systemctl show stramatel-serveur-temps.service 2>/dev/null \
  | grep -E '^(User|NoNewPrivileges|ProtectSystem|ProtectHome|PrivateTmp|CapabilityBoundingSet)=' | sed 's/^/   /'

echo; printf '%s===== Fin de l’audit =====%s\n' "$C_HDR" "$C_0"
