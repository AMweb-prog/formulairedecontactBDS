# Club des Sports — BDS EST Salé

Formulaire public et interface d’administration pour l’année 2026/2027.

## Déploiement Vercel

Le projet inclut des fonctions API Vercel et se connecte à Supabase Postgres. Suivez [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md) dans l’ordre : créer la base Supabase en région UE, exécuter `supabase/schema.sql`, configurer les secrets du projet Vercel, puis valider un aperçu avant Production.

Aucune clé de base ne doit être ajoutée au code ou au JavaScript du navigateur. `SUPABASE_SECRET_KEY` et les secrets admin se configurent uniquement dans l’environnement serveur Vercel. La base SQLite locale et les scripts de démarrage local sont exclus du déploiement.

## Utilisation locale

Pour le prototype local uniquement, exécutez `.\start.ps1` dans PowerShell puis ouvrez `http://127.0.0.1:8000`. Cette variante utilise le fichier `data/bds.sqlite3`; elle n’est pas la base de production.

## Confidentialité et mise en production

La notice publique indique maintenant que Vercel et Supabase hébergent le service et que la base Supabase est configurée dans l’UE. Avant de recueillir des données, complétez avec l’établissement l’identité et le contact du responsable de traitement, la durée de conservation, les droits, et les formalités CNDP applicables à l’hébergement/transfert international. Voir [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

