# Prompt de démarrage — à coller dans Claude Code (dans le dossier du projet)

Construis l'app "Villa Ops" en suivant scrupuleusement le brief technique
ci-joint : `villa-ops-brief-claude-code.md` (dans ce même dossier). La
maquette de référence pour le design est `villa-ops-mockup.html` (même
dossier) — reprends exactement cette direction visuelle (couleurs, polices,
style des tags/cartes).

## Infra Supabase déjà créée (backend prêt, ne pas recréer)
- URL du projet : https://ohmercemusyijkipquld.supabase.co
- Clé publishable (safe côté client) : sb_publishable_fjyq1HQcjej7LtrkdY_vIQ_hZLEAeDF
- Le schéma complet (villas, team_members, team_member_villa_access,
  categories, entries, reservations), les policies RLS avec cloisonnement
  par villa, et le bucket Storage privé `entry-photos` sont déjà en place.
  Ne génère pas de migrations SQL contradictoires — utilise ce schéma tel
  quel côté frontend (types TypeScript à générer depuis ce projet si tu
  utilises Supabase CLI).
- Les 2 villas Blue Bay Partners et les catégories de base (Reservation,
  Menage, Maintenance, Note) sont déjà seedées en base.
- Les comptes de l'équipe (auth) ne sont pas encore créés — l'app doit donc
  fonctionner avec un écran de connexion qui échoue proprement tant qu'aucun
  compte n'existe, pas bloquer le développement.

## Ce qu'il reste à faire
1. Initialiser le repo (git init, premier commit) et le dépôt GitHub pour
   l'hébergement GitHub Pages (créer le repo via `gh repo create` si le CLI
   GitHub est authentifié, sinon demander l'URL du repo).
2. Scaffolder le frontend vanilla HTML/CSS/JS en suivant le brief : écran de
   connexion, vue Journal, vue Calendrier, création rapide d'entrée, filtre
   "tâches en cours", Realtime Supabase.
3. Ajouter le PWA : manifest.json, icônes (192x192 et 512x512, palette du
   mockup : fond #16231F, accent laiton #C99A3D), meta tags iOS, service
   worker minimal pour l'installation sur l'écran d'accueil.
4. Configurer le déploiement sur GitHub Pages.

Pose-moi des questions si un point du brief n'est pas assez précis plutôt
que de deviner — en particulier sur les détails d'UX non couverts par la
maquette.
