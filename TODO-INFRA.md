# TODO infra

## Cron de sync portfolio.json sur VPS Ubuntu (à venir, ~48h)

**Contexte** : le sync Airtable → `portfolio.json` tourne actuellement via GitHub Actions
(`.github/workflows/sync-portfolio.yml`), cron `*/5 * * * *`. En pratique, GitHub throttle
fortement les workflows planifiés sur les repos à faible trafic — les runs observés tournent
toutes les 2 à 8h réellement, pas toutes les 5 min comme configuré. C'est une limite de la
plateforme GitHub Actions, pas un bug du workflow (voir Handoff 47/49, et la discussion du
2026-10-05).

**Action** : une fois le VPS Ubuntu disponible, remplacer (ou doubler) le déclenchement par
un vrai cron système sur le serveur, qui appelle le même script d'export et pousse le commit :

```
*/5 * * * * cd /path/to/portfolio && AIRTABLE_TOKEN=xxxx node scripts/export-airtable.mjs && git add portfolio.json && git diff --staged --quiet || (git commit -m "sync: portfolio.json depuis Airtable" && git push)
```

Points à régler à ce moment-là :
- Stocker `AIRTABLE_TOKEN` hors du crontab en clair (fichier `.env` chargé par le script, perms restreintes).
- Auth git en push depuis le VPS (clé SSH déploiement, ou PAT avec scope repo minimal).
- Décider si le workflow GitHub Actions reste en filet de secours (déclenchement manuel encore utile) ou est désactivé une fois le cron VPS fiable.
- Reprendre la logique de retry/rebase + verrou (flock côté VPS, équivalent au `concurrency` GitHub Actions) pour éviter qu'un cron qui traîne ne percute le suivant.
