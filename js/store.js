// État partagé minimal entre les vues (données de référence + sélection de
// villa active). Chaque vue garde son état d'UI propre (filtre catégorie,
// mois du calendrier...) localement dans son propre module.
export const state = {
  session: null,
  currentTeamMember: null, // ligne team_members de l'utilisateur connecté (peut être null)
  villas: [],
  villasById: new Map(),
  categories: [],
  categoriesById: new Map(),
  teamMembers: [],
  teamMembersById: new Map(),
  selectedVillaId: 'all', // 'all' ou uuid
  currentView: 'journal',
};

export function setReferenceData({ villas, categories, teamMembers, currentTeamMember }) {
  state.villas = villas;
  state.villasById = new Map(villas.map((v) => [v.id, v]));
  state.categories = categories;
  state.categoriesById = new Map(categories.map((c) => [c.id, c]));
  state.teamMembers = teamMembers;
  state.teamMembersById = new Map(teamMembers.map((m) => [m.id, m]));
  state.currentTeamMember = currentTeamMember;
}

export function addCategory(category) {
  state.categories.push(category);
  state.categoriesById.set(category.id, category);
}

export function entryContext(showVilla = true) {
  return {
    categoriesById: state.categoriesById,
    teamMembersById: state.teamMembersById,
    villasById: state.villasById,
    showVilla,
  };
}
