# ProAvenir

Plateforme de stages et d'emplois pour la Guinée : les candidats consultent les offres et
postulent, les entreprises publient leurs offres et suivent les candidatures, l'administration
valide les entreprises.

> **État du projet** : en développement. Les pages publiques (accueil, liste et détail des offres)
> lisent les vraies données de PostgreSQL via l'API. L'inscription, la connexion et l'accès aux
> espaces candidat, entreprise et administration sont réels (sessions sécurisées). Le **contenu**
> de ces espaces utilise encore des données fictives ; il sera branché progressivement (offres des
> entreprises, candidatures, administration…).

## Sommaire

- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation depuis zéro](#installation-depuis-zéro)
- [Variables d'environnement](#variables-denvironnement)
- [Docker et PostgreSQL](#docker-et-postgresql)
- [Migrations Prisma](#migrations-prisma)
- [Données de départ](#données-de-départ)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Authentification et sécurité](#authentification-et-sécurité)
- [Démarrer les serveurs](#démarrer-les-serveurs)
- [Tests et vérifications](#tests-et-vérifications)
- [Figma Make](#figma-make)
- [Dépannage](#dépannage)

## Architecture

```
 Navigateur
     │  http://localhost:8443
     ▼
┌─────────────────────────┐   HTTP + JSON    ┌─────────────────────────┐    SQL     ┌──────────────────────┐
│ Frontend                │ ───────────────► │ Backend (API REST)      │ ─────────► │ PostgreSQL 17        │
│ React 19 · Vite 8       │  /api/offers…    │ NestJS 12 · Prisma 7    │  (Prisma)  │ conteneur Docker     │
│ TypeScript · Tailwind 4 │                  │ http://localhost:3001   │            │ 127.0.0.1:5434       │
└─────────────────────────┘                  └─────────────────────────┘            └──────────────────────┘
   dossier frontend/                            dossier backend/                     volume proavenir-pgdata
```

```
ProAvenir/
├── frontend/          application React (src/, public/, index.html, configs Vite/TS/Vitest, .env)
├── backend/           API NestJS (src/, prisma/, test/, docker-compose.yml, .env)
├── .figma/            outils Figma Make (laissés à la racine, voir « Figma Make »)
├── .vscode/           réglages partagés de l'éditeur
├── package.json       raccourcis de commandes (aucune dépendance)
├── README.md · AGENTS.md · CLAUDE.md
└── .gitattributes · .gitignore · .mise.toml
```

| Partie          | Dossier           | Rôle                                                                         |
| --------------- | ----------------- | ---------------------------------------------------------------------------- |
| Frontend        | `frontend/`       | Interface (pages, composants). Appelle l'API via `frontend/src/services/`.   |
| Backend         | `backend/`        | API REST sous `/api` : règles métier, validation, sécurité, accès à la base. |
| Base de données | `backend/prisma/` | Modèle (`schema.prisma`), migrations SQL versionnées, données de départ.     |

Le frontend et le backend sont **deux applications indépendantes** : chacune a son
`package.json`, son `package-lock.json`, son `node_modules` et son `.env`, et s'installe, se lance,
se teste et se compile séparément. Elles ne communiquent que par HTTP. Le `package.json` de la
racine ne contient **aucune dépendance** : seulement des raccourcis qui appellent l'une ou l'autre.
La documentation détaillée se trouve dans :

- [`backend/README.md`](backend/README.md) : API, base de données, commandes du backend ;
- [`AGENTS.md`](AGENTS.md), [`frontend/AGENTS.md`](frontend/AGENTS.md) et
  [`backend/AGENTS.md`](backend/AGENTS.md) : structure du code et conventions.

### API disponible

| Route                          | Description                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `GET /api/health`              | État de l'API et de la connexion à la base                                                            |
| `GET /api/cities`              | Villes (ordre alphabétique)                                                                           |
| `GET /api/domains`             | Domaines professionnels (ordre alphabétique)                                                          |
| `GET /api/offers`              | Offres publiques, filtrables par `city`, `domain`, `type` (`JOB` / `INTERNSHIP`) et `q` (recherche)   |
| `POST /api/auth/register`      | Inscription d'un candidat ou d'une entreprise (jamais d'administrateur)                               |
| `POST /api/auth/login`         | Connexion (5 tentatives par minute et par adresse IP)                                                 |
| `POST /api/auth/refresh`       | Renouvelle la session à partir du cookie                                                              |
| `POST /api/auth/logout`        | Déconnexion : révoque la session                                                                      |
| `GET /api/auth/me`             | Utilisateur connecté (jeton d'accès obligatoire)                                                      |
| `GET /api/companies/me/offers` | Offres de l'entreprise connectée, tous statuts, avec le nombre réel de candidatures (rôle entreprise) |

Une offre n'est publique que si elle est publiée, que sa date limite n'est pas dépassée (le
jour même reste valable) et que son entreprise est validée.

## Prérequis

| Outil                                                             | Version                         | Vérifier                 |
| ----------------------------------------------------------------- | ------------------------------- | ------------------------ |
| [Node.js](https://nodejs.org)                                     | 24.15 ou plus récent (série 24) | `node -v`                |
| npm (fourni avec Node.js)                                         | 11 ou plus récent               | `npm -v`                 |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | récent, **démarré**             | `docker compose version` |
| Git                                                               | récent                          | `git --version`          |

Le projet utilise **npm** (pas pnpm ni yarn). Si vous utilisez [mise](https://mise.jdx.dev),
`.mise.toml` installe la bonne version de Node.js.

Ports utilisés : **8443** (frontend), **3001** (API), **5434** (PostgreSQL, uniquement sur la
machine locale).

## Installation depuis zéro

Toutes les commandes partent du **dossier racine** du projet, sauf indication contraire.

```bash
# 1. Récupérer le projet
git clone <adresse-du-dépôt> ProAvenir
cd ProAvenir

# 2. Installer les dépendances de chaque application (rien à installer à la racine)
npm --prefix frontend install
npm --prefix backend install
#    (raccourci équivalent : npm run install:all)

# 3. Créer les fichiers de configuration locaux (jamais versionnés)
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
#    puis, dans backend/.env, remplacer :
#    - les deux « change-me » de la base par un même mot de passe ;
#    - JWT_ACCESS_SECRET par un secret aléatoire (commande ci-dessous).

# 4. Démarrer PostgreSQL (Docker Desktop doit être lancé)
npm run db:up

# 5. Préparer la base : client Prisma, tables, données de départ
npm --prefix backend run db:generate
npm --prefix backend run db:migrate
npm --prefix backend run db:seed

# 6. Vérifier que tout fonctionne
npm run check
```

> Sous Windows (PowerShell), `cp` fonctionne. Vous pouvez aussi utiliser
> `Copy-Item frontend/.env.example frontend/.env`.

Pour générer un mot de passe solide pour la base, puis un secret pour `JWT_ACCESS_SECRET` :

```bash
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

## Variables d'environnement

Deux fichiers `.env`, un par application, **jamais envoyés dans Git** (seuls les modèles
`.env.example` le sont). Il n'y a **pas de `.env` à la racine**. Les secrets (base, JWT) ne
vont que dans `backend/.env`.

### Frontend : `frontend/.env`

| Variable       | Exemple                     | Rôle                                       |
| -------------- | --------------------------- | ------------------------------------------ |
| `VITE_API_URL` | `http://localhost:3001/api` | Adresse de l'API appelée par le navigateur |

⚠️ Toute variable `VITE_…` est incluse dans le code envoyé au navigateur : n'y mettez jamais de
secret. Après une modification, redémarrez `npm run dev`.

### Backend : `backend/.env`

| Variable                 | Exemple                                                                        | Rôle                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`               | `development`                                                                  | Mode d'exécution                                                                                               |
| `PORT`                   | `3001`                                                                         | Port de l'API                                                                                                  |
| `CORS_ORIGIN`            | `http://localhost:8443,http://localhost:5173`                                  | Adresses du frontend autorisées à appeler l'API (`*` est refusé)                                               |
| `POSTGRES_USER`          | `proavenir`                                                                    | Utilisateur créé dans PostgreSQL                                                                               |
| `POSTGRES_PASSWORD`      | _(secret)_                                                                     | Mot de passe de la base                                                                                        |
| `POSTGRES_DB`            | `proavenir`                                                                    | Nom de la base                                                                                                 |
| `POSTGRES_PORT`          | `5434`                                                                         | Port publié sur la machine                                                                                     |
| `DATABASE_URL`           | `postgresql://proavenir:<mot-de-passe>@127.0.0.1:5434/proavenir?schema=public` | Connexion utilisée par Prisma                                                                                  |
| `JWT_ACCESS_SECRET`      | _(secret, 32 caractères minimum)_                                              | Signature des jetons d'accès. « change-me » est refusé ; une valeur de démonstration est refusée en production |
| `ACCESS_TOKEN_TTL`       | `15m`                                                                          | Durée de vie d'un jeton d'accès (entre `1m` et `1h`)                                                           |
| `REFRESH_TOKEN_TTL_DAYS` | `30`                                                                           | Durée maximale d'une session « Se souvenir de moi » (1 à 90 jours)                                             |

Le mot de passe doit être **identique** dans `POSTGRES_PASSWORD` et dans `DATABASE_URL`. Ces
variables sont vérifiées au démarrage de l'API : une valeur manquante ou invalide l'empêche de
démarrer, avec un message explicite.

## Docker et PostgreSQL

La base tourne dans le conteneur `proavenir-postgres`, défini dans
`backend/docker-compose.yml`. Les données sont conservées dans le volume `proavenir-pgdata` :
elles survivent à l'arrêt du conteneur et au redémarrage de l'ordinateur.

| Commande                                           | Effet                                        |
| -------------------------------------------------- | -------------------------------------------- |
| `npm run db:up` _(racine)_                         | Démarre PostgreSQL et attend qu'il soit prêt |
| `docker compose ps` _(dans `backend/`)_            | Affiche l'état (`healthy` = prêt)            |
| `docker compose stop` _(dans `backend/`)_          | Arrête la base, **sans perte de données**    |
| `docker compose logs postgres` _(dans `backend/`)_ | Affiche les journaux de PostgreSQL           |

⚠️ **Ne jamais lancer `docker compose down -v`** : l'option `-v` supprime le volume, donc
toutes les données. Le port n'est ouvert que sur `127.0.0.1` : la base n'est pas accessible
depuis le réseau.

## Migrations Prisma

Le modèle de données est décrit dans `backend/prisma/schema.prisma`. Chaque évolution produit
une **migration SQL versionnée** dans `backend/prisma/migrations/`. Les migrations complètent
parfois le schéma avec des contraintes `CHECK` écrites à la main.

| Commande (racine)                      | Effet                                                               |
| -------------------------------------- | ------------------------------------------------------------------- |
| `npm --prefix backend run db:status`   | Indique si toutes les migrations sont appliquées                    |
| `npm --prefix backend run db:migrate`  | Applique les migrations en attente (sans jamais effacer de données) |
| `npm --prefix backend run db:generate` | Régénère le client Prisma après une modification du schéma          |

Pour modifier le modèle, voir la procédure dans [`backend/README.md`](backend/README.md).
Une migration déjà appliquée ne doit jamais être modifiée. ⚠️ `prisma migrate reset` efface
toute la base : ne l'utilisez pas.

## Données de départ

`npm --prefix backend run db:seed` insère les données de démonstration de
`backend/prisma/seed-data.ts` : 4 villes, 6 domaines, 9 entreprises (6 validées, 3 en attente),
6 offres publiées, 2 candidats, 4 candidatures, 1 administrateur.

- **Relançable sans risque** : les identifiants sont fixes, la commande met à jour les mêmes
  lignes, sans doublon ni suppression.
- **Aucun mot de passe** : les comptes de démonstration ne peuvent pas se connecter tant qu'un
  mot de passe ne leur a pas été attribué (voir ci-dessous). Leurs e-mails utilisent le domaine
  réservé `.test`.

## Comptes de démonstration

Pour vous connecter avec un compte des données de départ, définissez d'abord son mot de passe.
Il est demandé au clavier, **sans être affiché**, haché avec argon2id, et n'est écrit dans aucun
fichier :

```bash
npm --prefix backend run db:set-password -- mariama.diallo@proavenir.test               # candidate
npm --prefix backend run db:set-password -- recrutement.kamsar-solutions@proavenir.test # entreprise
npm --prefix backend run db:set-password -- admin@proavenir.test                        # administrateur
```

La commande révoque aussi les sessions ouvertes du compte. C'est le **seul** moyen de donner un
mot de passe à l'administrateur : l'inscription publique ne crée jamais de compte administrateur.

En développement (`npm run dev`), les boutons « Accès rapide à la démonstration » de la page
de connexion **préremplissent seulement l'e-mail** : le mot de passe reste obligatoire. Ils sont
absents du build de production.

## Authentification et sécurité

| Élément                | Fonctionnement                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mots de passe          | Hachés avec **argon2id** (paramètres OWASP), 8 à 128 caractères, jamais renvoyés par l'API                                                                  |
| Jeton d'accès          | JWT signé (HS256), valable 15 min, gardé **en mémoire** par le frontend (jamais dans `localStorage`)                                                        |
| Session                | Cookie `proavenir_refresh` `httpOnly`, `SameSite=Strict`, `Secure` en production, limité à `/api/auth` ; seule son empreinte SHA-256 est stockée en base    |
| « Se souvenir de moi » | Coché : session de 30 jours. Sinon : cookie de session, 24 h maximum côté serveur                                                                           |
| Rotation               | Chaque renouvellement remplace le jeton (fin de session inchangée). La réutilisation d'un ancien jeton (vol probable) révoque toutes les sessions du compte |
| CSRF                   | Cookie `SameSite=Strict` + en-tête obligatoire `X-ProAvenir-CSRF` + origine vérifiée (`CORS_ORIGIN`)                                                        |
| Erreurs de connexion   | Message identique (« E-mail ou mot de passe incorrect. ») quelle que soit la cause                                                                          |
| Force brute            | 5 tentatives de connexion par minute et par adresse IP (réponse 429)                                                                                        |
| Accès aux routes       | Toutes les routes exigent une connexion, sauf celles marquées `@Public()`. Le compte et son rôle sont relus en base à chaque requête                        |

Après une déconnexion, la session est révoquée immédiatement. Un jeton d'accès déjà émis
reste techniquement valable jusqu'à son expiration (15 min au plus), mais le frontend l'oublie.

## Démarrer les serveurs

Il faut **deux terminaux**, un par application :

```bash
# Terminal 1 : backend (dossier backend/)
cd backend
npm run db:up          # PostgreSQL sur 127.0.0.1:5434 (si la base n'est pas déjà démarrée)
npm run start:dev      # API sur http://localhost:3001/api (redémarre à chaque modification)

# Terminal 2 : frontend (dossier frontend/)
cd frontend
npm run dev            # application sur http://localhost:8443
```

Depuis la racine, les raccourcis `npm run db:up`, `npm run dev:api` et `npm run dev` font la
même chose.

Vérifications rapides :

- http://localhost:3001/api/health doit afficher `"database":"up"` ;
- http://localhost:3001/api/offers doit afficher les offres au format JSON ;
- http://localhost:8443, page « Offres », doit afficher les offres de la base.

Pour arrêter : `Ctrl + C` dans chaque terminal. La base peut rester allumée.

## Tests et vérifications

| Commande                          | Dossier     | Contenu                                                                                        |
| --------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `npm run check`                   | racine      | **Toutes les vérifications** du frontend puis du backend. À lancer avant chaque commit.        |
| `npm run check:front`             | racine      | Raccourci de `npm run check` dans `frontend/`                                                  |
| `npm run check:api`               | racine      | Raccourci de `npm run check` dans `backend/`                                                   |
| `npm run build`                   | racine      | Build du frontend (`frontend/dist/`) puis du backend (`backend/dist/`)                         |
| `npm run check`                   | `frontend/` | Formatage (oxfmt), TypeScript, tests (Vitest), build                                           |
| `npm test` / `npm run test:watch` | `frontend/` | Tests du frontend (une fois / à chaque enregistrement)                                         |
| `npm run format`                  | `frontend/` | Formate le code du frontend                                                                    |
| `npm run build`                   | `frontend/` | Build de production dans `frontend/dist/`                                                      |
| `npm run check`                   | `backend/`  | Formatage (Prettier), TypeScript, lint (oxlint), tests unitaires, tests de bout en bout, build |
| `npm test` / `npm run test:e2e`   | `backend/`  | Tests unitaires / tests de bout en bout                                                        |

À savoir :

- Les **tests de bout en bout du backend** utilisent la vraie base : PostgreSQL doit être
  démarré et les données de départ chargées. Ils ne modifient pas les données existantes.
- Les **tests du frontend** n'appellent jamais le vrai serveur : un faux serveur
  (`frontend/src/test/fakeApi.ts`) renvoie de vraies réponses de l'API enregistrées.
- Les **snapshots** (`frontend/src/__snapshots__/pages/`) enregistrent le HTML de chaque écran : tout
  changement de rendu fait échouer les tests. Ne les mettez à jour (`npm test -- -u`) que pour
  un changement de design voulu, puis relisez `git diff`.

## Figma Make

Le dossier `.figma/` reste à la racine, car Figma Make l'attend à cet endroit.
`frontend/vite.config.ts` y lit `.figma/make/site.json` (titre, favicon, langue de la page).
Limites connues depuis la séparation :

- les scripts `.figma/make/install` et `.figma/make/dev` appellent **pnpm** à la racine
  (`pnpm install`, puis `pnpm run dev`). Le projet utilise npm. À la racine, il n'y a plus de
  dépendance à installer, et `run dev` redirige vers `frontend/`. Les dépendances du frontend,
  elles, ne sont **pas** installées par ces scripts ;
- `.figma/make/dev.json` surveille le `package.json` de la racine, et non `frontend/package.json` ;
- `.figma/make/deploy` et `deploy-preview` lancent la build à la racine puis publient le dossier
  `dist/` **de la racine** (`--build-dir dist`), alors que la build du frontend est désormais
  écrite dans `frontend/dist/`. Le déploiement par Figma Make n'est donc **pas utilisable** en
  l'état ;
- `.figma/make/format` appelle `pnpm run format` à la racine, où ce script n'existe plus
  (le formatage se lance dans `frontend/` : `npm run format`) ;
- un nouvel import du dépôt dans Figma Make n'a pas été testé avec cette organisation. Le
  développement se fait en local avec npm, comme décrit ci-dessus.

## Dépannage

| Symptôme                                                                        | Cause probable                                                                                | Solution                                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Page Offres : « Offres indisponibles » / « Impossible de joindre le serveur »   | L'API n'est pas lancée, ou la base est arrêtée                                                | Lancer `npm run db:up` puis `npm run dev:api`, puis cliquer sur « Réessayer »          |
| « L'adresse du serveur n'est pas configurée (VITE_API_URL manquante) »          | Le fichier `frontend/.env` est absent                                                         | `cp frontend/.env.example frontend/.env`, puis redémarrer `npm run dev`                |
| Erreur CORS dans la console du navigateur                                       | L'adresse du frontend n'est pas dans `CORS_ORIGIN`                                            | L'ajouter dans `backend/.env`, puis redémarrer l'API                                   |
| `EADDRINUSE` (3001) ou `Port 8443 is already in use`                            | Un ancien serveur tourne encore                                                               | Fermer l'autre terminal, ou trouver le processus : `netstat -ano \| findstr :3001`     |
| `npm run db:up` échoue : « Cannot connect to the Docker daemon »                | Docker Desktop n'est pas démarré                                                              | Lancer Docker Desktop, attendre qu'il soit prêt, recommencer                           |
| L'API ne démarre pas : erreur de connexion à PostgreSQL ou d'authentification   | Base arrêtée, ou mots de passe différents dans `backend/.env`                                 | `docker compose ps` dans `backend/` ; vérifier `POSTGRES_PASSWORD` et `DATABASE_URL`   |
| Le port 5434 est déjà utilisé                                                   | Une autre base occupe ce port                                                                 | Changer `POSTGRES_PORT` **et** le port de `DATABASE_URL` dans `backend/.env`           |
| `Cannot find module '…/generated/prisma/…'`                                     | Client Prisma pas encore généré                                                               | `npm --prefix backend run db:generate`                                                 |
| Les tests e2e échouent sur les nombres d'offres                                 | Données de départ absentes ou modifiées                                                       | `npm --prefix backend run db:seed` (sans suppression)                                  |
| Fichiers entièrement modifiés dans `git diff` sous Windows                      | Fins de ligne CRLF                                                                            | Le projet impose LF (`.gitattributes`) ; dans VS Code, choisir « LF » en bas à droite  |
| Avertissement `npm warn allow-scripts …`                                        | npm 11 bloque les scripts d'installation non approuvés                                        | Normal : seuls ceux de Prisma et d'argon2 sont approuvés dans `backend/package.json`   |
| L'API refuse de démarrer : « JWT_ACCESS_SECRET doit être un secret aléatoire… » | Secret absent, trop court ou laissé à « change-me »                                           | Générer un secret (voir « Installation depuis zéro ») et le placer dans `backend/.env` |
| « E-mail ou mot de passe incorrect » avec un compte de démonstration            | Ce compte n'a pas encore de mot de passe                                                      | `npm --prefix backend run db:set-password -- <e-mail>`                                 |
| « Trop de tentatives. Patientez une minute… »                                   | Plus de 5 tentatives de connexion en une minute                                               | Attendre une minute                                                                    |
| Déconnecté après chaque rechargement de la page                                 | Le cookie de session n'est pas envoyé : frontend ouvert via une autre adresse que `localhost` | Ouvrir http://localhost:8443 (et non 127.0.0.1 ou l'adresse réseau)                    |
| « Requête refusée (protection CSRF) »                                           | Adresse du frontend absente de `CORS_ORIGIN`                                                  | L'ajouter dans `backend/.env`, puis redémarrer l'API                                   |
