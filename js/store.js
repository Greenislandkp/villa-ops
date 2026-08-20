// Minimal shared state between views (reference data + active villa
// selection). Each view keeps its own UI-only state (category filter,
// calendar month...) locally in its own module.
import { isReservationCategory, normalizeLabel } from './utils.js';

export const state = {
  session: null,
  currentTeamMember: null, // team_members row for the logged-in user (can be null)
  villas: [],
  villasById: new Map(),
  categories: [],
  categoriesById: new Map(),
  teamMembers: [],
  teamMembersById: new Map(),
  selectedVillaIds: [], // ids of currently selected villas — all accessible villas by default
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
  state.selectedVillaIds = villas.map((v) => v.id);
}

export function allVillasSelected() {
  return state.selectedVillaIds.length === state.villas.length;
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

export function getReservationCategory() {
  return state.categories.find((c) => isReservationCategory(c)) || null;
}

export function getCategoryByLabel(label) {
  const n = normalizeLabel(label);
  return state.categories.find((c) => normalizeLabel(c.label) === n) || null;
}

export function isAdmin() {
  return !!(state.currentTeamMember && state.currentTeamMember.full_access);
}
