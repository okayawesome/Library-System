// The administrator's side: see stock across the network, and add and remove
// books and libraries. Admins cannot borrow, and never see which member has a copy.

import { request } from './api.js';
import { branchInitials, currentBranch, fillBranchFilters, renderBranchInventory, renderCatalogue } from './inventory.js';
import { $, closeModal, escapeHtml, icon, openModal, refreshIcons, selectOptions, titleKey, toast } from './ui.js';

const CATEGORIES = ['Fiction', 'Fantasy', 'Classic', 'Science', 'History', 'Technology', 'Biography', 'Other'];

export function createAdminPortal(profile, { rerender }) {
  let branches = [];
  let books = [];

  async function load() {
    [branches, books] = await Promise.all([request('/branches'), request('/admin/books')]);
    fillBranchFilters(branches);
  }

  // A copy on loan can only be removed once it has been returned.
  const actionFor = (book) => (book.available
    ? { label: 'Remove copy', action: 'remove-book', data: { bookId: book.id } }
    : { label: 'On loan', disabled: true });

  function render(view) {
    if (view === 'overview') renderOverview();
    if (view === 'catalogue') renderCatalogue(books, actionFor);
    if (view === 'branches') renderBranchInventory(branches, books, actionFor);
    refreshIcons();
  }

  function renderOverview() {
    const hour = new Date().getHours();
    $('#dashGreeting').textContent = hour < 5 || hour >= 18 ? 'Good evening' : hour < 12 ? 'Good morning' : 'Good afternoon';
    const selected = currentBranch();
    const scoped = selected === 'all' ? books : books.filter((book) => book.branch === selected);
    const available = scoped.filter((book) => book.available).length;
    $('#statTitles').textContent = new Set(scoped.map((book) => titleKey(book.title))).size;
    $('#statCopies').textContent = scoped.length;
    $('#statAvailable').textContent = `${available} available`;
    $('#statLoans').textContent = scoped.length - available;
    $('#statBranches').textContent = branches.length;
    $('#dashboardBranches').innerHTML = branches.map((branch) => {
      const stock = books.filter((book) => book.branch === branch.name);
      const free = stock.filter((book) => book.available).length;
      const percent = stock.length ? Math.round((free / stock.length) * 100) : 0;
      return `<button class="branch-row" data-branch-open="${escapeHtml(branch.name)}"><span class="branch-avatar">${escapeHtml(branchInitials(branch.name))}</span><span class="branch-row-main"><strong>${escapeHtml(branch.name)}</strong><small>${escapeHtml(branch.city)}</small></span><span class="branch-row-stock"><strong>${free}<small> / ${stock.length}</small></strong><span class="mini-progress"><span style="width:${percent}%"></span></span></span></button>`;
    }).join('');
  }

  // Shows a form in the dialog, sends it to `path`, then reloads and says what happened.
  function showFormModal({ title, eyebrow, fields, submitLabel, path, body, done }) {
    openModal(title, eyebrow, `<form id="adminForm" class="form-stack">${fields}</form>`,
      `<button class="button button-secondary" data-modal-cancel>Cancel</button><button class="button button-primary" id="confirmAdminForm" type="submit" form="adminForm">${icon('plus')} ${submitLabel}</button>`);
    $('#adminForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      $('#confirmAdminForm').disabled = true;
      try {
        const created = await request(path, { method: 'POST', body: body(new FormData(event.currentTarget)) });
        await load();
        closeModal();
        rerender();
        toast(done(created));
      } catch (error) {
        toast(error.message, 'warning');
        $('#confirmAdminForm').disabled = false;
      }
    });
  }

  function showAddBookModal() {
    const defaultBranch = currentBranch() === 'all' ? branches[0]?.name : currentBranch();
    showFormModal({
      title: 'Add a physical copy',
      eyebrow: 'CATALOGUE',
      fields: `<label class="form-label">Book title<input name="title" required maxlength="140" placeholder="e.g. The Design of Everyday Things"></label>
        <label class="form-label">Author<input name="author" required maxlength="100" placeholder="Author name"></label>
        <div class="form-row"><label class="form-label">Category<select name="category">${selectOptions(CATEGORIES, 'Fiction')}</select></label><label class="form-label">Library<select name="branch">${selectOptions(branches.map((branch) => branch.name), defaultBranch)}</select></label></div>
        <p class="form-helper">Each entry is one physical copy. Add the same title again to put another copy in a library.</p>`,
      submitLabel: 'Add copy',
      path: '/admin/books',
      body: (data) => ({
        title: data.get('title').trim(), author: data.get('author').trim(), category: data.get('category'), branch: data.get('branch'),
      }),
      done: (book) => `${book.title} added to ${book.branch} as ${book.id}.`,
    });
  }

  function showAddBranchModal() {
    showFormModal({
      title: 'Add a library',
      eyebrow: 'NETWORK',
      fields: `<label class="form-label">Library name<input name="name" required maxlength="60" placeholder="e.g. Pune"></label>
        <label class="form-label">Area or city<input name="city" required maxlength="80" placeholder="e.g. Koregaon Park"></label>
        <p class="form-helper">Members can borrow from and return to the new library straight away. Add books to stock its shelves.</p>`,
      submitLabel: 'Add library',
      path: '/admin/branches',
      body: (data) => ({ name: data.get('name').trim(), city: data.get('city').trim() }),
      done: (branch) => `${branch.name} Library added to the network.`,
    });
  }

  // Asks before removing, sends DELETE to `path`, then reloads and says what happened.
  async function confirmRemoval(button, path, done) {
    button.disabled = true;
    try {
      await request(path, { method: 'DELETE' });
      await load();
      closeModal();
      rerender();
      toast(done);
    } catch (error) {
      toast(error.message, 'warning');
      button.disabled = false;
    }
  }

  function showRemoveBookModal(bookId) {
    const book = books.find((item) => item.id === bookId);
    if (!book) return;
    openModal('Remove this copy?', 'CATALOGUE', `<p class="modal-description"><strong>${escapeHtml(book.title)}</strong> (${escapeHtml(book.id)}) at ${escapeHtml(book.branch)} will leave the catalogue. Members can no longer borrow it, and past loans of it stay in their history.</p>`,
      `<button class="button button-secondary" data-modal-cancel>Keep it</button><button class="button button-danger" id="confirmRemoveBook">${icon('trash-2')} Remove copy</button>`);
    $('#confirmRemoveBook').addEventListener('click', (event) => confirmRemoval(
      event.currentTarget, `/admin/books/${encodeURIComponent(book.id)}`, `${book.title} (${book.id}) removed from ${book.branch}.`,
    ));
  }

  function showRemoveBranchModal() {
    const stockOf = (name) => books.filter((book) => book.branch === name).length;
    const selected = currentBranch() === 'all' ? branches[0]?.name : currentBranch();
    openModal('Remove a library', 'NETWORK', `
      <form id="removeBranchForm" class="form-stack">
        <label class="form-label">Library<select name="branch">${branches.map((branch) => `<option value="${escapeHtml(branch.name)}" ${branch.name === selected ? 'selected' : ''}>${escapeHtml(branch.name)} · ${stockOf(branch.name)} ${stockOf(branch.name) === 1 ? 'copy' : 'copies'}</option>`).join('')}</select></label>
        <div id="removeBranchCheck" class="inline-validation" aria-live="polite"></div>
        <p class="form-helper">Only an empty library can be removed. Its past loans stay in members' history, and adding a library with the same name opens it again.</p>
      </form>`, `<button class="button button-secondary" data-modal-cancel>Cancel</button><button class="button button-danger" id="confirmRemoveBranch">${icon('trash-2')} Remove library</button>`);
    const form = $('#removeBranchForm');
    const check = () => {
      const name = form.elements.branch.value;
      const stock = stockOf(name);
      $('#removeBranchCheck').textContent = stock
        ? `${name} still has ${stock} ${stock === 1 ? 'copy' : 'copies'}. Remove them first.`
        : `${name} has no books and can be removed.`;
      $('#removeBranchCheck').className = `inline-validation ${stock ? 'invalid' : 'valid'}`;
      $('#confirmRemoveBranch').disabled = stock > 0;
    };
    form.addEventListener('change', check);
    check();
    $('#confirmRemoveBranch').addEventListener('click', (event) => {
      const name = form.elements.branch.value;
      confirmRemoval(event.currentTarget, `/admin/branches/${encodeURIComponent(name)}`, `${name} Library removed from the network.`);
    });
  }

  function handleAction(action, element) {
    if (action === 'add-book') showAddBookModal();
    if (action === 'add-branch') showAddBranchModal();
    if (action === 'remove-book') showRemoveBookModal(element.dataset.bookId);
    if (action === 'remove-branch') showRemoveBranchModal();
  }

  return {
    defaultView: 'overview', profileName: 'Library Admin', roleLabel: 'Administrator', load, render, handleAction,
  };
}
