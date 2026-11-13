# ProAvenir — backend

API REST de ProAvenir : NestJS 12, PostgreSQL 17 (Docker) et Prisma 7.

## Prérequis

- Node.js 22.12+ ou 24
- Docker Desktop (démarré)

## Première installation

Toutes les commandes se lancent depuis le dossier `backend/`.

```bash
npm install                 # installe les dépendances
cp .env.example .env        # crée la configuration locale, puis remplacer les « change-me »
docker compose up -d        # démarre PostgreSQL en arrière-plan (port 127.0.0.1:5434)
npx prisma generate         # génère le client Prisma dans src/generated/prisma
```

> Dans `.env`, le mot de passe doit être identique dans `POSTGRES_PASSWORD` et dans `DATABASE_URL`.
> Le fichier `.env` contient des secrets : il n'est jamais envoyé dans Git.

## Lancer l'API

```bash
npm run start:dev           # mode développement (redémarre à chaque modification)
```

Vérification : ouvrir http://localhost:3001/api/health

- `{"status":"ok","database":"up"}` (200) : l'API et la base fonctionnent ;
- `{"status":"error","database":"down"}` (503) : la base ne répond pas (`docker compose ps`).

## Tests et vérifications

```bash
npm test                    # tests unitaires (sans base de données)
npm run test:e2e            # tests de bout en bout (PostgreSQL doit être démarré)
npm run lint                # analyse du code (oxlint)
npm run build               # compilation dans dist/
```

## Base de données (Docker)

| Commande | Effet |
| --- | --- |
| `docker compose up -d` | crée et démarre le conteneur `proavenir-postgres` |
| `docker compose stop` | arrête la base (les données sont conservées) |
| `docker compose start` | redémarre la base |
| `docker compose ps` | affiche l'état (`healthy` = prête) |
| `docker compose logs postgres` | affiche les journaux de PostgreSQL |

⚠️ `docker compose down -v` **supprime définitivement les données** (le `-v` efface le volume).

## Organisation

```
backend/
├── docker-compose.yml     PostgreSQL local
├── .env.example           modèle de configuration (versionné)
├── prisma.config.ts       configuration de la ligne de commande Prisma
├── prisma/schema.prisma   modèle de données (tables ajoutées en phase B1)
├── src/
│   ├── main.ts            démarrage du serveur
│   ├── app.setup.ts       préfixe /api, CORS, arrêt propre (partagé avec les tests e2e)
│   ├── app.module.ts      module racine
│   ├── config/            validation des variables d'environnement
│   ├── prisma/            PrismaService (connexion unique à la base)
│   └── health/            GET /api/health
└── test/                  tests de bout en bout
```
