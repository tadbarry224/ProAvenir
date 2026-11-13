# ProAvenir — backend

API REST de ProAvenir : NestJS 12, PostgreSQL 17 (Docker) et Prisma 7.

## Prérequis

- Node.js 24.15+ et npm 11+ (voir `engines` dans `package.json`)
- Docker Desktop (démarré)

Pour l'installation complète du projet (frontend + backend), voir le [README principal](../README.md).

## Première installation

Toutes les commandes se lancent depuis le dossier `backend/`.

```bash
npm install                 # installe les dépendances
cp .env.example .env        # crée la configuration locale, puis remplacer les « change-me »
npm run db:up               # démarre PostgreSQL et attend qu'il soit prêt (port 127.0.0.1:5434)
npm run db:generate         # génère le client Prisma dans src/generated/prisma
npm run db:migrate          # crée les tables (applique prisma/migrations)
npm run db:seed             # insère les données de démonstration
```

> Dans `.env`, le mot de passe doit être identique dans `POSTGRES_PASSWORD` et dans `DATABASE_URL`.
> Le fichier `.env` contient des secrets : il n'est jamais envoyé dans Git.

## Base de données : migrations et données de départ

| Commande | Effet |
| --- | --- |
| `npm run db:status` | indique si toutes les migrations sont appliquées |
| `npm run db:migrate` | applique les migrations en attente (`prisma migrate deploy`, jamais de réinitialisation) |
| `npm run db:generate` | régénère le client Prisma après une modification de `schema.prisma` |
| `npm run db:seed` | insère ou met à jour les données de démonstration (relançable sans doublon) |

**Modifier le modèle** : éditer `prisma/schema.prisma`, puis
`npx prisma migrate dev --name description-courte --create-only` pour générer la
migration SQL, la relire, puis `npm run db:migrate`.

⚠️ Ne jamais lancer `prisma migrate reset` ni `docker compose down -v` sans accord : ces
commandes effacent toutes les données.

### Données de démonstration (`prisma/seed-data.ts`)

Reprises des données fictives du frontend : 4 villes, 6 domaines, 9 entreprises
(6 approuvées, 3 en attente de vérification), 6 offres publiées, 2 candidats,
4 candidatures, 1 administrateur.

- **Identifiants fixes** : relancer `npm run db:seed` met à jour les mêmes lignes, sans doublon
  ni suppression.
- **Aucun mot de passe** : les comptes de démonstration ont `passwordHash = null` et ne
  peuvent pas se connecter. Leurs e-mails utilisent le domaine réservé `.test`
  (ex. `mariama.diallo@proavenir.test`), qui ne peut appartenir à personne.
- La connexion à ces comptes sera rendue possible en phase B3 (authentification), par une
  commande qui définira un mot de passe **choisi localement et haché avec argon2**, jamais
  écrit dans le code.

## Lancer l'API

```bash
npm run start:dev           # mode développement (redémarre à chaque modification)
```

Vérification : ouvrir http://localhost:3001/api/health

- `{"status":"ok","database":"up"}` (200) : l'API et la base fonctionnent ;
- `{"status":"error","database":"down"}` (503) : la base ne répond pas (`docker compose ps`).

## API publiques (sans connexion)

| Route | Réponse |
| --- | --- |
| `GET /api/cities` | `{ data: [{ id: "boke", name: "Boké" }, …] }` (ordre alphabétique) |
| `GET /api/domains` | `{ data: [{ id: "commerce", name: "Commerce" }, …] }` |
| `GET /api/offers` | `{ data: [offre…], meta: { total, today } }` |

`GET /api/offers` ne renvoie que les offres **publiées**, dont la **date limite est aujourd'hui ou plus tard** (jour de Conakry) et dont l'**entreprise est validée**, les plus récentes d'abord.
Filtres facultatifs et combinables :

- `city` : identifiant de ville (`boke`) ;
- `domain` : identifiant de domaine (`ressources-humaines`) ;
- `type` : `JOB` ou `INTERNSHIP` ;
- `q` : recherche dans l'intitulé, le nom de l'entreprise et les compétences (100 caractères maximum, majuscules ignorées).

Exemple : http://localhost:3001/api/offers?city=conakry&type=JOB&q=web

Un paramètre inconnu ou mal formé renvoie **400**. Seuls les champs publics sont lus en base (`publicOfferSelect` dans `src/offers/public-offer.ts`) : aucune donnée de compte ni de contact.

## Tests et vérifications

```bash
npm test                    # tests unitaires (sans base de données)
npm run test:e2e            # tests de bout en bout (PostgreSQL doit être démarré)
npm run lint                # analyse du code (oxlint)
npm run build               # compilation dans dist/
npm run check               # tout : format, TypeScript, lint, tests unitaires et e2e, build
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
├── prisma/
│   ├── schema.prisma      modèle de données (9 tables)
│   ├── migrations/        historique SQL versionné (ne jamais modifier une migration appliquée)
│   ├── seed.ts            script des données de démonstration
│   └── seed-data.ts       données de démonstration (identifiants fixes, sans mot de passe)
├── src/
│   ├── main.ts            démarrage du serveur
│   ├── app.setup.ts       préfixe /api, validation des paramètres, CORS, arrêt propre (partagé avec les tests e2e)
│   ├── app.module.ts      module racine
│   ├── config/            validation des variables d'environnement
│   ├── prisma/            PrismaService (connexion unique à la base)
│   ├── common/            ClockService (date du jour à Conakry, remplaçable en test)
│   ├── health/            GET /api/health
│   ├── reference/         GET /api/cities, GET /api/domains
│   └── offers/            GET /api/offers (filtres validés par ListOffersQueryDto)
└── test/                  tests de bout en bout
```
