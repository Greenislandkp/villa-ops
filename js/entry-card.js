import { escapeHtml, formatDueDate, memberInitials, statusLabel, hexOrFallback, isReservationCategory, villaTagCode } from './utils.js';

// ctx: { categoriesById, teamMembersById, villasById, showVilla }
export function entryCardHtml(entry, ctx) {
  const cat = ctx.categoriesById.get(entry.category_id);
  const color = hexOrFallback(cat && cat.color);
  const author = ctx.teamMembersById.get(entry.author_id);
  const assigned = entry.assigned_to_id ? ctx.teamMembersById.get(entry.assigned_to_id) : null;
  const villa = ctx.villasById.get(entry.villa_id);
  const label = cat ? cat.label : 'Other';
  const isReservation = isReservationCategory(cat);

  const metaParts = [];
  metaParts.push(`<span class="avatar">${escapeHtml(memberInitials(author))}</span>${escapeHtml((author && author.full_name) || 'Unknown')}`);
  if (ctx.showVilla && villa) metaParts.push(escapeHtml(villa.name));
  if (entry.check_in_time) metaParts.push(`<span style="font-family:var(--font-mono)">${escapeHtml(entry.check_in_time.slice(0, 5))}</span>`);
  if (assigned) metaParts.push(`→ ${escapeHtml(assigned.full_name)}`);

  const metaHtml = metaParts
    .map((p, i) => (i === 0 ? p : `<span class="sep">·</span> ${p}`))
    .join(' ');

  const tagCode = ctx.showVilla && villa ? villaTagCode(villa.name) : '';

  return `
  <div class="entry clickable" data-entry-id="${entry.id}">
    <div class="tag">${tagCode ? `<span class="tag-label">${escapeHtml(tagCode)}</span>` : ''}<div class="stripe" style="background:${color}"></div></div>
    <div class="entry-body">
      <div class="entry-top">
        <span class="entry-label" style="color:${color}">${escapeHtml(label)}</span>
        <span class="entry-time">${escapeHtml(formatDueDate(entry.event_date))}</span>
      </div>
      <div class="entry-title">${escapeHtml(entry.title)}</div>
      <div class="entry-meta">
        ${metaHtml}
        ${isReservation ? '' : `<span class="status-badge ${entry.status}">${statusLabel(entry.status)}</span>`}
        ${entry.photo_url ? '<span class="photo-flag">📷 photo</span>' : ''}
      </div>
    </div>
  </div>`;
}
