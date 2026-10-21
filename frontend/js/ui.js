// Small DOM, formatting and dialog helpers shared by every screen.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
export const titleKey = (title) => title.trim().toLocaleLowerCase().replace(/[’']/g, "'");
export const formatDate = (date) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
export const initials = (name) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

export function icon(name, className = '') {
  return `<i data-lucide="${name}"${className ? ` class="${className}"` : ''}></i>`;
}

export function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

export function toast(message, type = 'success') {
  const element = document.createElement('div');
  element.className = `toast toast-${type}`;
  element.innerHTML = `${icon(type === 'success' ? 'check-circle-2' : type === 'warning' ? 'alert-triangle' : 'alert-circle')}<span>${escapeHtml(message)}</span>`;
  $('#toastRegion').append(element);
  refreshIcons();
  window.setTimeout(() => element.remove(), 3600);
}

export function selectOptions(values, selected = '') {
  return values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

export function bookCover(book) {
  const themes = { Fantasy: 'cover-fantasy', Classic: 'cover-classic', Fiction: 'cover-fiction', Science: 'cover-science' };
  const theme = themes[book.category] || 'cover-default';
  return `<div class="book-cover ${theme}" aria-hidden="true"><span class="cover-line"></span><span class="cover-title">${escapeHtml(book.title)}</span><span class="cover-author">${escapeHtml(book.author)}</span><span class="cover-emblem">${icon('sparkles')}</span></div>`;
}

// ---------- Dialog ----------

let lastFocusedElement = null;

export const isModalOpen = () => !$('#modalBackdrop').hidden;

export function openModal(title, eyebrow, body, footer) {
  lastFocusedElement = document.activeElement;
  $('#modalTitle').textContent = title;
  $('#modalEyebrow').textContent = eyebrow;
  $('#modalBody').innerHTML = body;
  $('#modalFooter').innerHTML = footer;
  $('#modalBackdrop').hidden = false;
  $('#appShell').inert = true;
  document.body.classList.add('modal-open');
  refreshIcons();
  $('#modalClose').focus();
}

export function closeModal() {
  $('#modalBackdrop').hidden = true;
  $('#appShell').inert = false;
  document.body.classList.remove('modal-open');
  if (lastFocusedElement?.focus) lastFocusedElement.focus();
}

export function trapModalFocus(event) {
  if (event.key !== 'Tab' || !isModalOpen()) return;
  const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', $('.modal'))
    .filter((element) => !element.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
