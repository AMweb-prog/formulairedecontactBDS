# Déploiement Vercel + Supabase Postgres

Le frontend est statique; les routes du dossier `api/` sont des fonctions Vercel Node.js. Les données du formulaire sont envoyées au projet Supabase Postgres choisi par le club. Le fichier SQLite local n'est jamais téléversé.

## 1. Créer le projet de données

1. Créez un projet Supabase et choisissez une région dans l'UE.
2. Dans **SQL Editor**, exécutez tout le fichier `supabase/schema.sql`.
3. Dans les paramètres API du projet, récupérez l'URL du projet et la clé `service_role`.
4. Gardez cette clé strictement côté serveur. Ne la mettez jamais dans le HTML, le JavaScript du navigateur, un dépôt Git ou une capture d'écran.

La table `members` a RLS activé et aucune politique d'accès public. Seules les fonctions serveur utilisent la clé `service_role`. Un index unique sur l'e-mail empêche les doublons même si deux formulaires sont envoyés presque simultanément. La fonction SQL limite les tentatives de connexion admin à huit par adresse réseau sur quinze minutes, et les envois de formulaire à 120 par adresse réseau par heure. L'identifiant réseau est haché avant stockage et les anciennes limites sont nettoyées. Ajustez la limite d'inscription si le campus utilise une adresse IP partagée par de nombreux étudiants.

## 2. Configurer les secrets Vercel

Importez ce dépôt comme projet Vercel, en gardant la racine du projet par défaut. Dans **Settings → Environment Variables**, créez ces variables pour **Production** :

- `SUPABASE_URL`: URL du projet Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clé secrète `service_role` (jamais `NEXT_PUBLIC_*`).
- `BDS_ADMIN_PASSWORD`: nouveau mot de passe admin aléatoire. Le mot de passe affiché précédemment dans une capture d'écran doit être remplacé.
- `SESSION_SECRET`: secret aléatoire d'au moins 32 caractères, utilisé pour signer les cookies admin.

Générez un secret dans PowerShell avec :

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Ne réutilisez pas les secrets présents dans les captures ou dans l'historique du terminal. Pour les déploiements Preview, laissez ces variables absentes ou créez un projet Supabase séparé et vide, afin que les previews ne lisent pas les données de production.

## 3. Vérifier avant le lancement public

1. Déployez d'abord un aperçu avec une base Supabase de test.
2. Vérifiez l'inscription, le doublon d'e-mail, la validation des champs et du consentement.
3. Vérifiez la connexion, le verrouillage après tentatives répétées, les filtres, l'ajout manuel, la modification, l'exclusion, l'inclusion, la suppression et l'export CSV.
4. Contrôlez la sauvegarde et la restauration du projet Supabase.
5. Avant Production, faites valider la notice (responsable du traitement, contact, durée de conservation, prestataires, région d'hébergement et droits) par l'établissement. Vérifiez les formalités CNDP applicables au traitement et à l'hébergement dans l'UE.

## 4. Données locales existantes

La base SQLite locale contient actuellement une inscription. Elle est exclue du déploiement et aucune migration automatique n'est prévue. Avant de la copier dans Supabase, déterminez si c'est une fiche de test ou une véritable inscription et vérifiez que la personne a reçu une notice adaptée à l'hébergement chez Vercel et Supabase.

## 5. Ce qu'il reste à faire dans les comptes

La base doit être créée dans le compte Supabase du club et reliée au projet Vercel du club. Ce dépôt ne contient volontairement aucune clé d'accès; le propriétaire du compte saisit les clés dans les paramètres sécurisés Vercel.


