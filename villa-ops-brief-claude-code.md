# Villa Ops — Brief technique pour Claude Code

## Contexte
App mobile-first (web app installable comme une app sur le telephone, cf. section PWA)
pour gerer plusieurs villas de location. Utilisee par une petite equipe de 3 personnes,
avec des niveaux d'acces differents par villa (voir "Acces par utilisateur" ci-dessous).
Acces restreint a l'equipe uniquement (pas public, pas d'auto-inscription).

Reference visuelle : maquette HTML fournie (villa-ops-mockup.html) — vue Journal
(flux d'entrees chronologique par tags) + vue Calendrier (grille mensuelle avec
barres de couleur par jour + detail du jour selectionne).

## Acces par utilisateur (important, structure les permissions)
3 utilisateurs prevus pour la V1 :
- 1 utilisateur avec acces restreint aux 2 villas Blue Bay Partners uniquement
  (Villa Nour, Breath of Paradise).
- 2 utilisateurs avec acces a l'ensemble des proprietes geree dans l'app, y compris
  les villas gerees pour des proprietaires tiers.

Consequence : ce n'est PAS un acces uniforme pour tout le monde. Il faut un
cloisonnement par villa au niveau des donnees (pas seulement au niveau de
l'affichage / du filtre cote client) — voir section "Securite et hebergement".

## Stack recommandee
- Frontend : HTML / CSS / JS vanilla (comme thai-quotidien), pas de framework lourd
- Backend : Supabase (gratuit) — Postgres + Auth + Realtime + Storage
- Auth : email / mot de passe, comptes crees manuellement pour chaque membre de l'equipe
- Hebergement : GitHub Pages (frontend) + Supabase (backend) — choix tranche,
  ne pas utiliser Vercel pour cette V1.

## Structure de donnees (Postgres / Supabase)

### Table `villas`
- id (uuid, PK)
- name (text) -- ex: "Villa Nour", "Breath of Paradise"
- owner_name (text, optionnel)
- color (text, optionnel) -- couleur d'accent pour differencier visuellement
- created_at (timestamp)

### Table `team_members`
- id (uuid, PK) -- lie a auth.users de Supabase
- full_name (text)
- initials (text) -- pour l'avatar rond (ex: "MX", "SO", "TA")
- role (text) -- ex: gestionnaire, femme de menage, maintenance
- active (boolean, default true)
- full_access (boolean, default false) -- true pour les membres ayant acces a
  toutes les villas (actuelles et futures) ; false pour un acces restreint,
  defini explicitement via la table `team_member_villa_access`

### Table `team_member_villa_access`
Definit les villas visibles pour les membres avec `full_access = false`.
Non utilisee (pas de lignes necessaires) pour les membres avec `full_access = true`.
- id (uuid, PK)
- team_member_id (FK -> team_members.id)
- villa_id (FK -> villas.id)
- contrainte unique (team_member_id, villa_id)

Pour la V1 : 1 ligne pour l'utilisateur restreint x 2 villas Blue Bay Partners
(2 lignes au total). Les 2 autres utilisateurs ont `full_access = true` et n'ont
pas besoin d'entree ici.

### Table `categories`
Liste ouverte / personnalisable, pas figee dans le code.
- id (uuid, PK)
- label (text) -- ex: "Reservation", "Menage", "Maintenance", "Contrat internet",
  "Pest control", "Entretien piscine", "Renouvellement contrat", etc.
- color (text) -- code couleur hex pour le tag et la barre calendrier
- is_default (boolean) -- pour les categories de base non supprimables (Reservation, Menage, Maintenance)
- created_at (timestamp)

L'utilisateur doit pouvoir creer une nouvelle categorie a la volee depuis l'app
(petit formulaire "+ nouvelle categorie" avec label + choix de couleur).
Categories partagees globalement (pas de restriction par villa).

### Table `entries` (coeur de l'app, le "journal de bord")
- id (uuid, PK)
- villa_id (FK -> villas.id)
- category_id (FK -> categories.id)
- title (text) -- ex: "Fuite climatisation chambre 2"
- description (text, optionnel) -- details plus longs
- author_id (FK -> team_members.id) -- qui a cree l'entree
- assigned_to_id (FK -> team_members.id, nullable) -- qui est responsable de l'action
- status (text) -- valeurs: "a_faire", "en_cours", "fait"
  -- applicable a toutes les entrees mais surtout utile pour maintenance/contrats/taches
- event_date (date) -- date a laquelle l'evenement/tache se rapporte
  (differente de created_at si on planifie a l'avance, ex: renouvellement contrat dans 2 mois)
- check_in_time / check_out_time (time, nullable) -- specifique aux entrees de type Reservation
- photo_url (text, nullable) -- upload via Supabase Storage (bucket prive, voir
  section Securite ci-dessous)
- created_at (timestamp)
- updated_at (timestamp)

### Table `reservations` (dediee — decision tranchee)
Table dediee liee a `entries` par une FK optionnelle, pour garder les infos de
reservation structurees (utile plus tard pour rapports proprietaires) tout en
gardant une seule entree dans le fil du journal.
- id (uuid, PK)
- entry_id (FK -> entries.id)
- guest_name (text)
- guest_count (integer, optionnel)
- platform (text) -- ex: "Airbnb", "Booking", "Direct"
- amount (numeric, optionnel)
- currency (text, optionnel)

## Fonctionnalites cles
1. Vue Journal : flux chronologique de toutes les entrees, filtrable par villa
   et par categorie. Chaque entree affiche : tag colore (categorie), titre,
   auteur (avatar initiales), assigne a (si different de l'auteur), statut
   (badge a_faire / en_cours / fait), photo si presente, date/heure.
   Le selecteur de villa en haut ne doit lister que les villas auxquelles
   l'utilisateur connecte a acces (cf. Acces par utilisateur).
2. Vue Calendrier : grille mensuelle par villa, barre de couleur par jour selon
   categorie(s) du jour, clic sur un jour affiche le detail (liste des entrees
   de ce jour). Comporte 2 modes, bascule via un petit toggle en haut de la
   carte calendrier (pas un onglet separe dans la navigation) :
   - "Vue complete" (mode par defaut) : comportement decrit ci-dessus, barre
     de 70% de largeur, couleur = categorie.
   - "Reservations" : n'affiche que les jours avec une reservation (source :
     table `reservations` via `entries` de categorie Reservation). Barre plus
     large (~88% au lieu de 70%, legerement plus epaisse) puisqu'il n'y a
     qu'une seule info a montrer par jour. Couleur = couleur de la villa
     concernee (`villas.color`), pas la couleur de categorie -- utile en vue
     "Toutes les villas" pour voir en un coup d'oeil quelle propriete est
     occupee tel jour. Si plusieurs villas sont reservees le meme jour en vue
     "Toutes les villas", reprendre le style "split" (barre partagee en deux
     couleurs) comme pour le mode complet. La legende sous le toggle change
     en consequence (liste des villas + couleur, au lieu de la legende
     categories). Le detail du jour selectionne, dans ce mode, ne montre que
     les slots lies a une reservation (check-in/check-out/sejour en cours),
     pas le menage ni la maintenance.
   Reference d'implementation : voir villa-ops-mockup.html, toggle
   ".cal-toggle" + classe ".resa-mode" sur ".cal-card" (deja prototype dans
   la maquette).
3. Creation rapide d'entree (bouton + flottant) : choix villa (limite aux
   villas accessibles), categorie (ou creation a la volee), titre, description
   optionnelle, assigne a, date, statut, photo optionnelle.
4. Filtre / vue "taches en cours" : toutes les entrees avec statut a_faire ou
   en_cours, tous types confondus (utile pour voir d'un coup d'oeil les
   contrats a renouveler, maintenances en attente, etc.)
5. Realtime : toute nouvelle entree ou modification de statut doit apparaitre
   en direct chez tous les utilisateurs connectes et autorises sur la villa
   concernee (Supabase Realtime).

## Design
Suivre la direction visuelle de villa-ops-mockup.html : fond sombre (vert
tres fonce quasi noir), cartes claires ton papier/beige pour le calendrier,
accents laiton/ambre, palme, argile. Police display Fraunces, police texte
Inter, police mono JetBrains Mono pour les horaires/donnees techniques.
Tags d'entree stylises comme des etiquettes de porte-cles.

## PWA — installation sur ecran d'accueil (objectif : usage comme une vraie app)
L'equipe doit pouvoir installer Villa Ops sur son telephone et l'utiliser comme
une app native (icone sur l'ecran d'accueil, pas d'URL/barre d'adresse visible).
- `manifest.json` : nom "Villa Ops", icones 192x192 et 512x512 (a partir de la
  charte graphique : fond vert tres fonce, accent laiton), `display: standalone`,
  `theme_color` et `background_color` alignes sur la palette du mockup.
- Balises meta iOS : `apple-touch-icon`, `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style` (l'equipe est probablement sur iPhone
  et Android, prevoir les deux).
- Service worker minimal (cache des assets statiques : HTML/CSS/JS/fonts) pour
  permettre l'installation et un chargement rapide. Pas besoin de mode offline
  complet pour la V1 — les donnees viennent de Supabase en ligne.
- L'ecran de connexion doit s'afficher correctement en mode standalone
  (lance depuis l'icone), avant tout acces au journal/calendrier.

## Non prioritaire pour la V1
- Rapports PDF automatiques (deja gere par un autre projet, "Rapport Upswing")
- Mode offline complet (le service worker PWA sert juste a l'installation +
  cache des assets, pas a la synchronisation hors-ligne des donnees)


## Securite et hebergement — a bien respecter

Points valides avec l'utilisateur, a ne pas oublier lors du developpement :

- Hebergement du frontend sur GitHub Pages : gratuit, mais la page HTML/CSS/JS
  est techniquement chargeable par n'importe qui ayant le lien (GitHub Pages
  n'a pas de restriction d'acces native).
- La restriction reelle se fait via Supabase Auth : sans compte (email + mot
  de passe) cree manuellement par l'utilisateur pour chaque membre de l'equipe,
  aucune donnee n'est visible ni modifiable.
- Toutes les requetes vers Supabase (lecture ET ecriture sur villas, entries,
  categories, team_members, reservations) doivent etre protegees par des
  policies RLS (Row Level Security) exigeant un utilisateur authentifie.
  Aucune table sensible ne doit etre accessible en lecture publique/anonyme.
- Cloisonnement par villa (nouveau, suite a la decision sur les 3 utilisateurs) :
  les policies RLS sur `villas`, `entries` et `reservations` doivent en plus
  verifier que l'utilisateur authentifie a bien acces a la villa concernee —
  soit parce que son `team_members.full_access = true`, soit parce qu'une ligne
  existe dans `team_member_villa_access` pour (son id, la villa concernee).
  `reservations` herite de l'acces via `entries.villa_id`.
- Photos — securite maximum demandee : bucket Supabase Storage prive (pas de
  bucket public). Acces en lecture/ecriture uniquement via policies RLS sur
  `storage.objects` exigeant un utilisateur authentifie, et idealement filtrees
  par acces a la villa de l'entree associee (meme logique que ci-dessus), pas
  seulement "authentifie". Affichage des photos via URLs signees generees a la
  demande (jamais d'URL publique permanente). Si techniquement ce filtrage par
  villa s'avere trop complexe a mettre en place sur le Storage (les policies
  storage n'ont pas toujours acces facile aux jointures), on accepte a minima
  "authentifie uniquement" comme filet de securite, et on retire l'option photo
  si meme ce niveau minimal n'est pas garanti de maniere fiable.
- L'app doit afficher un ecran de connexion (email/mot de passe) avant tout
  acces au journal ou au calendrier, et rediriger vers cet ecran si pas de
  session active.
- Pas de fonctionnalite d'auto-inscription ("sign up") ouverte au public :
  les comptes sont crees uniquement par l'utilisateur (admin) depuis le
  dashboard Supabase, pas depuis l'app elle-meme.
