# ProAvenir

Plateforme de stages et d'emplois pour la Guinée : les candidats consultent les offres et
postulent, les entreprises publient leurs offres et suivent les candidatures, l'administration
valide les entreprises.

> **État du projet** : en développement. Les pages publiques (accueil, liste et détail des offres)
> lisent les vraies données de PostgreSQL via l'API. Les espaces candidat, entreprise et
> administration utilisent encore des données fictives ; ils seront branchés progressivement
> (authentification, offres des entreprises, candidatures…).

## Sommaire

- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation depuis zéro](#installation-depuis-zéro)
- [Variables d'environnement](#variables-denvironnement)
- [Docker et PostgreSQL](#docker-et-postgresql)
- [Migrations Prisma](#migrations-prisma)
- [Données de départ](#données-de-départ)
- [Démarrer les serveurs](#démarrer-les-serveurs)
- [Tests et vérifications](#tests-et-vérifications)
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
   dossier racine (src/)                        dossier backend/                     volume proavenir-pgdata
```

| Partie          | Dossier           | Rôle                                                                         |
| --------------- | ----------------- | ---------------------------------------------------------------------------- |
| Frontend        | `src/`            | Interface (pages, composants). Appelle l'API via `src/services/`.            |
| Backend         | `backend/`        | API REST sous `/api` : règles métier, validation, sécurité, accès à la base. |
| Base de données | `backend/prisma/` | Modèle (`schema.prisma`), migrations SQL versionnées, données de départ.     |

Le frontend et le backend sont **deux projets npm distincts**, chacun avec son
`package.json` et son `package-lock.json`. La documentation détaillée se trouve dans :

- [`backend/README.md`](backend/README.md) : API, base de données, commandes du backend ;
- [`AGENTS.md`](AGENTS.md) et [`backend/AGENTS.md`](backend/AGENTS.md) : structure du code et
  conventions.

### API disponible

| Route              | Description                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `GET /api/health`  | État de l'API et de la connexion à la base                                                          |
| `GET /api/cities`  | Villes (ordre alphabétique)                                                                         |
| `GET /api/domains` | Domaines professionnels (ordre alphabétique)                                                        |
| `GET /api/offers`  | Offres publiques, filtrables par `city`, `domain`, `type` (`JOB` / `INTERNSHIP`) et `q` (recherche) |

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

# 2. Installer les dépendances (frontend puis backend)
npm install
npm --prefix backend install

# 3. Créer les fichiers de configuration locaux (jamais versionnés)
cp .env.example .env
cp backend/.env.example backend/.env
#    puis, dans backend/.env, remplacer les deux « change-me » par un même mot de passe
#    (voir « Variables d'environnement » ci-dessous)

# 4. Démarrer PostgreSQL (Docker Desktop doit être lancé)
npm run db:up

# 5. Préparer la base : client Prisma, tables, données de départ
npm --prefix backend run db:generate
npm --prefix backend run db:migrate
npm --prefix backend run db:seed

# 6. Vérifier que tout fonctionne
npm run check
```

> Sous Windows (PowerShell), `cp` fonctionne. Vous pouvez aussi utiliser `Copy-Item .env.example .env`.

Pour générer un mot de passe solide pour la base :

```bash
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
```

## Variables d'environnement

Deux fichiers `.env`, **jamais envoyés dans Git** (seuls les modèles `.env.example` le sont).

### Frontend : `.env` (racine)

| Variable       | Exemple                     | Rôle                                       |
| -------------- | --------------------------- | ------------------------------------------ |
| `VITE_API_URL` | `http://localhost:3001/api` | Adresse de l'API appelée par le navigateur |

⚠️ Toute variable `VITE_…` est incluse dans le code envoyé au navigateur : n'y mettez jamais de
secret. Après une modification, redémarrez `npm run dev`.

### Backend : `backend/.env`

| Variable            | Exemple                                                                        | Rôle                                                             |
| ------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `NODE_ENV`          | `development`                                                                  | Mode d'exécution                                                 |
| `PORT`              | `3001`                                                                         | Port de l'API                                                    |
| `CORS_ORIGIN`       | `http://localhost:8443,http://localhost:5173`                                  | Adresses du frontend autorisées à appeler l'API (`*` est refusé) |
| `POSTGRES_USER`     | `proavenir`                                                                    | Utilisateur créé dans PostgreSQL                                 |
| `POSTGRES_PASSWORD` | _(secret)_                                                                     | Mot de passe de la base                                          |
| `POSTGRES_DB`       | `proavenir`                                                                    | Nom de la base                                                   |
| `POSTGRES_PORT`     | `5434`                                                                         | Port publié sur la machine                                       |
| `DATABASE_URL`      | `postgresql://proavenir:<mot-de-passe>@127.0.0.1:5434/proavenir?schema=public` | Connexion utilisée par Prisma                                    |

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
- **Aucun mot de passe** : les comptes de démonstration ne peuvent pas encore se connecter.
  Leurs e-mails utilisent le domaine réservé `.test`. La connexion arrivera avec
  l'authentification.

## Démarrer les serveurs

Il faut **deux terminaux**, tous deux ouverts au dossier racine :

```bash
# Terminal 1 : base de données (si elle n'est pas déjà démarrée), puis API
npm run db:up
npm run dev:api        # API sur http://localhost:3001/api (redémarre à chaque modification)

# Terminal 2 : frontend
npm run dev            # application sur http://localhost:8443
```

Vérifications rapides :

- http://localhost:3001/api/health doit afficher `"database":"up"` ;
- http://localhost:3001/api/offers doit afficher les offres au format JSON ;
- http://localhost:8443, page « Offres », doit afficher les offres de la base.

Pour arrêter : `Ctrl + C` dans chaque terminal. La base peut rester allumée.

## Tests et vérifications

| Commande (racine)     | Contenu                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run check`       | **Toutes les vérifications** du frontend puis du backend. À lancer avant chaque commit.                  |
| `npm run check:front` | Frontend : formatage (oxfmt), TypeScript, tests (Vitest), build                                          |
| `npm run check:api`   | Backend : formatage (Prettier), TypeScript, lint (oxlint), tests unitaires, tests de bout en bout, build |
| `npm test`            | Tests du frontend seulement                                                                              |
| `npm run test:watch`  | Tests du frontend, relancés à chaque enregistrement                                                      |
| `npm run format`      | Formate le code du frontend                                                                              |

À savoir :

- Les **tests de bout en bout du backend** utilisent la vraie base : PostgreSQL doit être
  démarré et les données de départ chargées. Ils ne modifient pas les données existantes.
- Les **tests du frontend** n'appellent jamais le vrai serveur : un faux serveur
  (`src/test/fakeApi.ts`) renvoie de vraies réponses de l'API enregistrées.
- Les **snapshots** (`src/__snapshots__/pages/`) enregistrent le HTML de chaque écran : tout
  changement de rendu fait échouer les tests. Ne les mettez à jour (`npm test -- -u`) que pour
  un changement de design voulu, puis relisez `git diff`.

## Dépannage

| Symptôme                                                                      | Cause probable                                                | Solution                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Page Offres : « Offres indisponibles » / « Impossible de joindre le serveur » | L'API n'est pas lancée, ou la base est arrêtée                | Lancer `npm run db:up` puis `npm run dev:api`, puis cliquer sur « Réessayer »         |
| « L'adresse du serveur n'est pas configurée (VITE_API_URL manquante) »        | Le fichier `.env` racine est absent                           | `cp .env.example .env`, puis redémarrer `npm run dev`                                 |
| Erreur CORS dans la console du navigateur                                     | L'adresse du frontend n'est pas dans `CORS_ORIGIN`            | L'ajouter dans `backend/.env`, puis redémarrer l'API                                  |
| `EADDRINUSE` (3001) ou `Port 8443 is already in use`                          | Un ancien serveur tourne encore                               | Fermer l'autre terminal, ou trouver le processus : `netstat -ano \| findstr :3001`    |
| `npm run db:up` échoue : « Cannot connect to the Docker daemon »              | Docker Desktop n'est pas démarré                              | Lancer Docker Desktop, attendre qu'il soit prêt, recommencer                          |
| L'API ne démarre pas : erreur de connexion à PostgreSQL ou d'authentification | Base arrêtée, ou mots de passe différents dans `backend/.env` | `docker compose ps` dans `backend/` ; vérifier `POSTGRES_PASSWORD` et `DATABASE_URL`  |
| Le port 5434 est déjà utilisé                                                 | Une autre base occupe ce port                                 | Changer `POSTGRES_PORT` **et** le port de `DATABASE_URL` dans `backend/.env`          |
| `Cannot find module '…/generated/prisma/…'`                                   | Client Prisma pas encore généré                               | `npm --prefix backend run db:generate`                                                |
| Les tests e2e échouent sur les nombres d'offres                               | Données de départ absentes ou modifiées                       | `npm --prefix backend run db:seed` (sans suppression)                                 |
| Fichiers entièrement modifiés dans `git diff` sous Windows                    | Fins de ligne CRLF                                            | Le projet impose LF (`.gitattributes`) ; dans VS Code, choisir « LF » en bas à droite |
| Avertissement `npm warn allow-scripts …`                                      | npm 11 bloque les scripts d'installation non approuvés        | Normal : seuls ceux de Prisma sont approuvés dans `backend/package.json`              |
