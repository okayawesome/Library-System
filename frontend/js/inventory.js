// The catalogue and branch-inventory screens. Members and admins both see
// them. Each role passes its own `actionFor(book)`, or null for no buttons.
//
// actionFor(book) returns null or { label, action, data, disabled }. `action`
// and `data` become data-* attributes, which the role's handleAction()
// receives when the button is clicked.

import { $, bookCover, escapeHtml, icon, refreshIcons, titleKey } from './ui.js';

export const branchInitials = (name) => name.slice(0, 2).toUpperCase();
export const currentBranch = () => $('#globalBranch').value || 'all';
const availableCount = (books) => books.filter((book) => book.available).length;

// Refills the branch filters, keeping each one's choice if that branch still exists.
export function fillBranchFilters(branches) {
  for (const select of [$('#globalBranch'), $('#catalogueBranch')]) {
    const current = select.value;
    select.innerHTML = '<option value="all">All branches</option>'
      + branches.map((branch) => `<option value="${escapeHtml(branch.name)}">${escapeHtml(branch.name)}</option>`).join('');
    select.value = branches.some((branch) => branch.name === current) ? current : 'all';
  }
}

function dataAttributes(data = {}) {
  return Object.entries(data)
    .map(([key, value]) => ` data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${escapeHtml(value)}"`)
    .join('');
}

function cardButton(spec) {
  if (!spec) return '';
  if (spec.disabled) return `<button class="button button-disabled full-button" disabled>${escapeHtml(spec.label)}</button>`;
  return `<button class="button button-secondary full-button" data-action="${spec.action}"${dataAttributes(spec.data)}>${escapeHtml(spec.label)} ${icon('arrow-up-right')}</button>`;
}

function rowButton(spec) {
  if (!spec || spec.disabled) return `<span class="muted">${escapeHtml(spec?.label || '—')}</span>`;
  return `<button class="table-action" data-action="${spec.action}"${dataAttributes(spec.data)}>${escapeHtml(spec.label)} ${icon('arrow-right')}</button>`;
}

export function renderCatalogue(books, actionFor) {
  const query = $('#catalogueSearch').value.trim().toLocaleLowerCase();
  const branch = $('#catalogueBranch').value;
  const availability = $('#catalogueAvailability').value;
  const shown = books.filter((book) => [book.title, book.author, book.id, book.category].some((value) => value.toLocaleLowerCase().includes(query))
    && (branch === 'all' || book.branch === branch)
    && (availability === 'all' || (availability === 'available') === book.available));
  $('#catalogueCount').textContent = `${shown.length} physical ${shown.length === 1 ? 'copy' : 'copies'} · ${new Set(shown.map((book) => titleKey(book.title))).size} unique titles`;
  $('#bookGrid').innerHTML = shown.length ? shown.map((book) => `<article class="book-card">${bookCover(book)}<div class="book-card-content"><div class="book-card-top"><span class="category-chip">${escapeHtml(book.category)}</span><span class="availability-chip ${book.available ? 'is-available' : 'is-borrowed'}"><span class="legend-dot ${book.available ? 'available' : 'borrowed'}"></span>${book.available ? 'Available' : 'On loan'}</span></div><h3 title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3><p class="book-author">${escapeHtml(book.author)}</p><div class="book-meta"><span>${icon('map-pin')} ${escapeHtml(book.branch)}</span><span>${escapeHtml(book.id)}</span></div>${actionFor ? cardButton(actionFor(book)) : ''}</div></article>`).join('')
    : `<div class="empty-state full-span"><span class="empty-icon">${icon('search-x')}</span><strong>No matching copies</strong><p>Try another search or change your filters.</p></div>`;
  refreshIcons();
}

export function renderBranchInventory(branches, books, actionFor) {
  const selected = currentBranch();
  const shownBranches = selected === 'all' ? branches : branches.filter((branch) => branch.name === selected);
  $('#branchCards').innerHTML = shownBranches.map((branch) => {
    const stock = books.filter((book) => book.branch === branch.name);
    const available = availableCount(stock);
    return `<button class="branch-card ${selected === branch.name ? 'selected' : ''}" data-branch-open="${escapeHtml(branch.name)}"><div class="branch-card-top"><span class="branch-avatar large">${escapeHtml(branchInitials(branch.name))}</span><span class="branch-open-link">${icon('arrow-up-right')}</span></div><h3>${escapeHtml(branch.name)} Library</h3><p>${escapeHtml(branch.city)}</p><div class="branch-card-stats"><div><strong>${stock.length}</strong><small>Total copies</small></div><div><strong>${available}</strong><small>Available</small></div><div><strong>${stock.length - available}</strong><small>On loan</small></div></div><div class="stock-progress"><span style="width:${stock.length ? (available / stock.length) * 100 : 0}%"></span></div></button>`;
  }).join('');
  $('#inventoryTitle').textContent = selected === 'all' ? 'All branch stock' : `${selected} branch stock`;

  const query = $('#inventorySearch').value.toLocaleLowerCase();
  const rows = books.filter((book) => (selected === 'all' || book.branch === selected)
    && [book.title, book.author, book.id, book.branch].some((value) => value.toLocaleLowerCase().includes(query)));
  $('#inventoryRows').innerHTML = rows.length ? rows.map((book) => `<tr><td><div class="table-book"><span class="table-book-icon">${icon('book-open')}</span><span><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.id)} · ${escapeHtml(book.author)}</small></span></div></td><td data-label="Branch"><span class="branch-tag">${escapeHtml(book.branch)}</span></td><td data-label="Status"><span class="status-chip ${book.available ? 'status-available' : 'status-loaned'}"><span class="legend-dot ${book.available ? 'available' : 'borrowed'}"></span>${book.available ? 'Available' : 'On loan'}</span></td>${actionFor ? `<td class="td-action">${rowButton(actionFor(book))}</td>` : ''}</tr>`).join('')
    : `<tr><td colspan="${actionFor ? 4 : 3}"><div class="empty-state compact-empty"><strong>No inventory matches</strong><p>Try a different branch or search term.</p></div></td></tr>`;
  refreshIcons();
}
