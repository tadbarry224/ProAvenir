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
| `npm run db:set-password -- <e-mail>` | définit le mot de passe d'un compte (saisie masquée, argon2id) et révoque ses sessions |

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

`GET /api/offers/:id` renvoie **une** offre publique (même forme qu'un élément de `data`). Un
identifiant mal formé donne **400** `INVALID_OFFER_ID` ; une offre inconnue, en brouillon,
clôturée, expirée ou d'une entreprise non validée donne la **même** réponse **404**
`OFFER_NOT_FOUND` (on ne révèle pas qu'une offre non publique existe).

## Authentification

| Route | Accès | Effet |
| --- | --- | --- |
| `POST /api/auth/register` | public + CSRF | Crée un candidat (avec profil) ou une entreprise `PENDING` + son propriétaire, en une transaction. `ADMIN` refusé (400), e-mail déjà pris (409). |
| `POST /api/auth/login` | public + CSRF | `{ email, password, rememberMe }` → `{ accessToken, expiresIn, user }` + cookie. 5 essais/min/IP. |
| `POST /api/auth/refresh` | public + CSRF | Rotation du cookie, nouveau jeton d'accès. `401 SESSION_ROTATED` si un autre onglet vient de renouveler. |
| `POST /api/auth/logout` | public + CSRF | Révoque la session, efface le cookie (204). |
| `GET /api/auth/me` | connecté | Utilisateur courant (sans hash). |

- **Par défaut, toute route exige un jeton d'accès** (`Authorization: Bearer …`, garde globale
  `JwtAuthGuard`). Une route publique doit être marquée `@Public()`. Restreindre par rôle :
  `@Roles('ADMIN')` (garde globale `RolesGuard`). Le compte (actif, rôle) est relu en base à
  chaque requête.
- **CSRF** : les routes `/api/auth/*` exigent l'en-tête `X-ProAvenir-CSRF: 1` et refusent une
  origine absente de `CORS_ORIGIN` (`CsrfGuard`), en plus du cookie `SameSite=Strict`.
- **Sessions** : table `RefreshToken` (empreinte SHA-256, `expiresAt` = fin absolue,
  `persistent` = « Se souvenir de moi »). Sans « Se souvenir de moi » : 24 h maximum.
- Les sessions expirées ou révoquées restent en base ; un nettoyage périodique est prévu plus tard.

## Espace entreprise : ses offres

| Route | Accès | Réponse |
| --- | --- | --- |
| `GET /api/companies/me/offers` | rôle `COMPANY` | `{ data: [offre…], meta: { total, today, company: { name, status, rejectionReason } } }` (motif du refus montré à l’entreprise, null sinon) |
| `POST /api/companies/me/offers` | rôle `COMPANY` | 201 + l'offre créée (même forme qu'un élément de `data`) |
| `PATCH /api/companies/me/offers/:id/status` | rôle `COMPANY` | `{ status: "PUBLISHED" \| "CLOSED" }` → 200 + l'offre à jour |

- Renvoie **toutes** les offres de l'entreprise connectée (brouillons, publiées, clôturées,
  expirées), les plus récentes d'abord, avec le **nombre réel de candidatures**
  (`applicationsCount`) et `publiclyVisible` (même règle que `GET /api/offers`).
- **L'entreprise est déduite de la session** (table `CompanyMember`) : aucun identifiant
  d'entreprise n'est lu dans l'URL ni dans la requête. Une entreprise ne voit jamais les offres
  d'une autre.
- Sans jeton : **401**. Candidat ou administrateur : **403**. Compte entreprise sans entreprise :
  **403**. Les entreprises `PENDING` et `REJECTED` peuvent consulter leurs offres (lecture seule).
- Seuls les champs listés dans `companyOfferSelect` (`src/company-offers/company-offer.ts`)
  sont lus : aucune donnée de compte, de contact ni de candidat.

**Création** (`POST`, corps validé par `CreateCompanyOfferDto`) :

| Champ | Règle |
| --- | --- |
| `status` | `DRAFT` (brouillon) ou `PUBLISHED` (publication directe) |
| `title` | 3 à 120 caractères, espaces superflus retirés |
| `type`, `cityId`, `domainId` | obligatoires ; la ville et le domaine doivent exister (`GET /api/cities`, `/api/domains`) |
| `description` | 5 000 caractères max ; **pour publier** : au moins 50 |
| `deadline` | `AAAA-MM-JJ` (date réelle) ; **pour publier** : obligatoire, aujourd'hui (Conakry) ou plus tard |
| `skills` | 10 max, 40 caractères chacune, doublons retirés |
| `contractType`, `workSchedule`, `duration` | facultatifs ; emploi : `CDI`/`CDD`/`OTHER`, stage : `INTERNSHIP`/`OTHER` ; pas de durée pour un CDI |

- **Statut de l'entreprise** : `APPROVED` brouillon ou publication ; `PENDING` brouillon seulement
  (publication : 403) ; `REJECTED` aucune création (403). Ce contrôle passe avant la validation
  des données.
- `companyId`, `featured`, `publishedAt`, `closedAt`, `id` sont **refusés** (400) : l'entreprise
  vient de la session, la mise en avant de l'administration, les dates du serveur.
- Toutes les erreurs de données sont renvoyées ensemble (`message: [...]`, 400) ; rien n'est créé.
- La création se fait dans une transaction qui **verrouille la ligne de l'entreprise**
  (`SELECT … FOR SHARE`) : un refus par l'administration au même moment ne peut pas laisser
  passer une publication.

**Changement de statut** (`PATCH …/:id/status`) :

| Statut actuel | Demande | Effet | Entreprise |
| --- | --- | --- | --- |
| `DRAFT` | `PUBLISHED` | publier : `publishedAt` = maintenant | `APPROVED` |
| `PUBLISHED` | `CLOSED` | clôturer (même expirée) : `closedAt` = maintenant | `APPROVED`, `PENDING` |
| `CLOSED` | `PUBLISHED` | rouvrir : `publishedAt` d'origine conservé, `closedAt` effacé | `APPROVED` |

- Toute autre transition : **409** (clôturer un brouillon, republier, reclôturer). Le retour au
  brouillon n'existe pas (`status: "DRAFT"` → 400).
- Publier ou rouvrir exige le même contenu qu'à la création (description ≥ 50 caractères, date
  limite aujourd'hui ou plus tard) : sinon **409**. Une offre expirée ne peut donc pas être
  rouverte (elle ne redeviendrait de toute façon pas visible).
- `PENDING` : publier ou rouvrir → **403**. `REJECTED` : aucun changement (**403**, lecture seule).
- Identifiant mal formé : **400**. Offre inexistante **ou d'une autre entreprise** : **404**
  (même réponse, pour ne pas révéler l'existence des offres des autres).
- Transaction : ligne de l'entreprise verrouillée (`FOR SHARE`), puis ligne de l'offre
  (`FOR UPDATE`). Deux demandes simultanées sur la même offre passent l'une après l'autre : la
  seconde voit le résultat de la première (ex. double clôture : 200 puis 409).

## Administration : vérification des entreprises

| Route | Accès | Réponse |
| --- | --- | --- |
| `GET /api/admin/companies` | rôle `ADMIN` | `{ data: [entreprise…], meta: { total, pending } }`, en attente d'abord puis les plus récentes |
| `PATCH /api/admin/companies/:id/status` | rôle `ADMIN` | `{ status: "APPROVED" }` ou `{ status: "REJECTED", reason }` → 200 + l'entreprise à jour |

- Une entreprise contient : `id`, `name`, `sector`, `city`, `status`, `rejectionReason`,
  `createdAt`, `reviewedAt`, `offersCount` (`adminCompanySelect` dans
  `src/admin-companies/admin-company.ts`). Aucune donnée de compte (e-mail, mot de passe…).
- Sans jeton : **401**. Candidat ou entreprise : **403**.
- Le motif (5 à 500 caractères, espaces en trop retirés) est **obligatoire** pour un refus et
  **interdit** pour une approbation (l'ancien motif est alors effacé). Il est destiné à l'entreprise.
- Décisions possibles : en attente → approuvée ou refusée ; approuvée → refusée (ses offres
  quittent aussitôt la liste publique) ; refusée → approuvée. On ne revient jamais à « en attente ».
- Erreurs : **400** `INVALID_COMPANY_ID` (identifiant mal formé), **400** `VALIDATION_FAILED`
  (statut ou motif), **404** `COMPANY_NOT_FOUND`, **409** `COMPANY_ALREADY_IN_STATUS` (la décision
  ne change rien : double clic ou écran périmé).
- La décision verrouille la ligne de l'entreprise (`FOR UPDATE`) : une publication d'offre en cours
  se termine avant, ou attend la décision.
- Relancer `npm run db:seed` remet les entreprises de démonstration dans leur état de départ
  (Horoya Conseil, Kindia Agro Services et Boké Transit en attente).

## Format des erreurs

Les erreurs métier ont un **code stable** (à utiliser côté frontend) et, si elles portent sur
des champs, des **détails structurés** (`src/common/api-error.ts`) :

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "code": "OFFER_NOT_PUBLISHABLE",
  "message": ["La date limite est obligatoire pour publier."],
  "details": [{ "field": "deadline", "message": "La date limite est obligatoire pour publier." }]
}
```

`message` est toujours un texte prêt à afficher (une chaîne, ou une liste s'il y a plusieurs
erreurs). Les erreurs de validation des DTO gardent leur `message` habituel et reçoivent en
plus `code: "VALIDATION_FAILED"` et `details` (toutes les routes).

| Code | HTTP | Signification |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Formulaire invalide (format, ville/domaine inconnus, contrat, conditions de publication à la création) ; `details` par champ |
| `INVALID_OFFER_ID` | 400 | Identifiant d'offre mal formé dans l'adresse |
| `NO_COMPANY` | 403 | Compte entreprise rattaché à aucune entreprise |
| `COMPANY_REJECTED` | 403 | Entreprise refusée : lecture seule |
| `COMPANY_NOT_APPROVED` | 403 | Entreprise en attente : publication et réouverture impossibles |
| `OFFER_NOT_FOUND` | 404 | Offre inexistante ou d'une autre entreprise |
| `INVALID_STATUS_TRANSITION` | 409 | Changement impossible depuis l'état actuel (brouillon → clôturée, déjà publiée, déjà clôturée) |
| `OFFER_NOT_PUBLISHABLE` | 409 | Publication/réouverture d'une offre incomplète ou expirée ; `details` par champ |
| `SESSION_ROTATED` | 401 | (authentification) session renouvelée par un autre onglet |

Les refus de la garde globale (401 « Connexion requise. », 403 « Accès réservé. ») gardent le
format NestJS standard, sans `code` : le statut HTTP suffit.

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
│   ├── common/            ClockService (date du jour à Conakry, remplaçable en test), dates
│   ├── health/            GET /api/health
│   ├── auth/              inscription, connexion, sessions, gardes (JWT, rôles, CSRF), argon2id
│   ├── reference/         GET /api/cities, GET /api/domains
│   ├── offers/            GET /api/offers et /api/offers/:id (filtres validés par ListOffersQueryDto)
│   ├── company-offers/    GET /api/companies/me/offers (offres de l'entreprise connectée)
│   └── admin-companies/   GET|PATCH /api/admin/companies (vérification des entreprises)
└── test/                  tests de bout en bout
```
