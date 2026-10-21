// The member's side: browse the inventory, borrow, and return your own books.
// Members only ever load their own account and loans.

import { request } from './api.js';
import { currentBranch, fillBranchFilters, renderBranchInventory, renderCatalogue } from './inventory.js';
import {
  $, bookCover, closeModal, escapeHtml, formatDate, icon, initials, openModal, refreshIcons, selectOptions, titleKey, toast,
} from './ui.js';

const MAX_ACTIVE_LOANS = 3;

export function createMemberPortal(profile, { rerender }) {
  let branches = [];
  let books = [];
  let loans = [];

  const getBook = (id) => books.find((book) => book.id === id);
  const activeLoans = () => loans.filter((loan) => !loan.returnedAt);
  const activeLoanFor = (bookId) => activeLoans().find((loan) => loan.bookId === bookId);
  const hasTitle = (title) => activeLoans().some((loan) => titleKey(getBook(loan.bookId)?.title || '') === titleKey(title));

  async function load() {
    [branches, books, loans] = await Promise.all([
      request('/branches'), request('/member/books'), request('/member/loans'),
    ]);
    fillBranchFilters(branches);
  }

  // Why this copy can't be borrowed right now, or '' when it can.
  // The server checks the same rules again.
  function borrowBlocker(book) {
    if (!book.available) return 'On loan';
    if (hasTitle(book.title)) return 'You have this title';
    if (activeLoans().length >= MAX_ACTIVE_LOANS) return 'Limit reached';
    return '';
  }

  function actionFor(book) {
    const loan = activeLoanFor(book.id);
    if (loan) return { label: 'Return', action: 'return-book', data: { loanId: loan.id } };
    const blocker = borrowBlocker(book);
    return blocker ? { label: blocker, disabled: true } : { label: 'Borrow', action: 'borrow', data: { bookId: book.id } };
  }

  function render(view) {
    if (view === 'my-library') renderMyLibrary();
    if (view === 'catalogue') renderCatalogue(books, actionFor);
    if (view === 'branches') renderBranchInventory(branches, books, actionFor);
    if (view === 'loans') renderLoans();
    refreshIcons();
  }

  function renderMyLibrary() {
    const active = activeLoans();
    $('#memberWelcome').innerHTML = `<div class="member-welcome-left"><span class="avatar member-avatar">${initials(profile.name)}</span><div><p class="eyebrow">WELCOME BACK</p><h2>${escapeHtml(profile.name)}</h2><p>Library card <strong>${escapeHtml(profile.cardNumber)}</strong> · Home branch: ${escapeHtml(profile.homeBranch)}</p><p class="member-account-meta">${escapeHtml(profile.email)} · Active member</p></div></div><div class="member-limit"><span class="limit-ring"><strong>${MAX_ACTIVE_LOANS - active.length}</strong><small>left</small></span><div><strong>Borrowing allowance</strong><p>${active.length} of ${MAX_ACTIVE_LOANS} active loans</p></div></div>`;
    $('#memberLoanCount').textContent = `${active.length} / ${MAX_ACTIVE_LOANS}`;
    $('#memberActiveLoans').innerHTML = active.length ? active.map((loan) => {
      const book = getBook(loan.bookId);
      return `<div class="member-loan-row">${bookCover(book)}<div class="member-loan-info"><strong>${escapeHtml(book.title)}</strong><p>${escapeHtml(book.author)}</p><span>Borrowed from ${escapeHtml(loan.borrowBranch)} · ${formatDate(loan.borrowedAt)}</span></div><button class="mini-button" data-action="return-book" data-loan-id="${loan.id}">Return</button></div>`;
    }).join('') : `<div class="empty-state compact-empty"><span class="empty-icon">${icon('sparkles')}</span><strong>Your shelf is clear</strong><p>You have no active loans. Find your next read.</p></div>`;

    const query = $('#memberPortalSearch').value.toLocaleLowerCase();
    const titles = new Map();
    books.forEach((book) => {
      const key = titleKey(book.title);
      if (!titles.has(key)) titles.set(key, { title: book.title, author: book.author, category: book.category, copies: [] });
      titles.get(key).copies.push(book);
    });
    const hints = {
      'You have this title': 'You already have this title on loan',
      'Limit reached': 'Return a book before borrowing another',
      Unavailable: 'No copies on the shelf right now',
    };
    $('#memberCatalogue').innerHTML = [...titles.values()]
      .filter((group) => [group.title, group.author, group.category].some((value) => value.toLocaleLowerCase().includes(query)))
      .map((group) => {
        // Offer a copy at the member's home branch first.
        const available = group.copies.filter((book) => book.available)
          .sort((a, b) => (b.branch === profile.homeBranch) - (a.branch === profile.homeBranch));
        const branchNames = [...new Set(available.map((book) => book.branch))];
        const copy = available[0];
        const blocker = copy ? borrowBlocker(copy) : 'Unavailable';
        const label = blocker === 'You have this title' ? 'On loan' : blocker || 'Borrow';
        return `<div class="member-catalogue-row"><div class="member-catalogue-cover">${icon('book-open')}</div><div class="member-catalogue-info"><strong>${escapeHtml(group.title)}</strong><p>${escapeHtml(group.author)}</p><small>${available.length} available · ${branchNames.length ? escapeHtml(branchNames.join(', ')) : 'No available branches'}</small></div><button class="mini-button" ${blocker ? 'disabled' : `data-action="borrow" data-book-id="${escapeHtml(copy.id)}"`} title="${escapeHtml(hints[blocker] || `Borrow from ${copy.branch}`)}">${label}</button></div>`;
      }).join('') || '<p class="muted empty-search">No books match that search.</p>';
  }

  function renderLoans() {
    const returned = loans.filter((loan) => loan.returnedAt);
    $('#loanMetrics').innerHTML = `<div class="loan-metric"><span class="stat-icon">${icon('book-up')}</span><div><strong>${activeLoans().length}</strong><small>Active loans</small></div></div><div class="loan-metric"><span class="stat-icon">${icon('book-check')}</span><div><strong>${returned.length}</strong><small>Returned</small></div></div><div class="loan-metric"><span class="stat-icon">${icon('git-compare-arrows')}</span><div><strong>${returned.filter((loan) => loan.returnBranch !== loan.borrowBranch).length}</strong><small>Returned to another branch</small></div></div>`;
    const status = $('#loanStatus').value;
    const query = $('#loanSearch').value.toLocaleLowerCase();
    const shown = [...loans].reverse().filter((loan) => (status === 'all' || (status === 'active') === !loan.returnedAt)
      && [loan.bookTitle, loan.bookId, loan.borrowBranch, loan.returnBranch].some((value) => (value || '').toLocaleLowerCase().includes(query)));
    $('#loanRows').innerHTML = shown.length ? shown.map((loan) => {
      const book = getBook(loan.bookId);
      const active = !loan.returnedAt;
      return `<tr><td><div class="table-book"><span class="table-book-icon">${icon('book-open')}</span><span><strong>${escapeHtml(loan.bookTitle)}</strong><small>${escapeHtml(loan.bookId)}${book ? '' : ' · no longer in the catalogue'} · ${formatDate(loan.borrowedAt)}</small></span></div></td><td data-label="Borrowed from"><span class="branch-tag">${escapeHtml(loan.borrowBranch)}</span></td><td data-label="Returned to">${loan.returnBranch ? `<span class="branch-tag">${escapeHtml(loan.returnBranch)}</span><small class="table-subline">${loan.returnBranch !== loan.borrowBranch ? 'Another branch' : 'Same branch'} · ${formatDate(loan.returnedAt)}</small>` : '<span class="muted">Not returned</span>'}</td><td data-label="Status"><span class="status-chip ${active ? 'status-loaned' : 'status-returned'}">${active ? 'Active' : 'Returned'}</span></td><td class="td-action">${active ? `<button class="table-action" data-action="return-book" data-loan-id="${loan.id}">Return ${icon('arrow-right')}</button>` : '<span class="muted">Complete</span>'}</td></tr>`;
    }).join('') : '<tr><td colspan="5"><div class="empty-state compact-empty"><strong>No loans found</strong><p>Borrow a book from the catalogue to see it here.</p></div></td></tr>';
  }

  async function borrow(bookId, button) {
    button.disabled = true;
    try {
      const loan = await request('/member/loans', { method: 'POST', body: { bookId } });
      await load();
      rerender();
      toast(`${getBook(loan.bookId)?.title || 'Book'} borrowed from ${loan.borrowBranch}.`);
    } catch (error) {
      toast(error.message, 'warning');
      button.disabled = false;
    }
  }

  function showReturnModal(preselectedLoanId = '') {
    const active = activeLoans();
    if (!active.length) {
      toast('You have no books to return.', 'warning');
      return;
    }
    const defaultBranch = currentBranch() === 'all' ? profile.homeBranch : currentBranch();
    const options = active.map((loan) => `<option value="${loan.id}" ${String(loan.id) === String(preselectedLoanId) ? 'selected' : ''}>${escapeHtml(getBook(loan.bookId)?.title || loan.bookId)} (borrowed at ${escapeHtml(loan.borrowBranch)})</option>`).join('');
    openModal('Return a book', 'MY LOANS', `
      <form id="returnForm" class="form-stack">
        <div class="form-note">${icon('git-compare-arrows')}<span>Return to any branch. The copy then stays at the branch that receives it.</span></div>
        <label class="form-label">Book<select name="loanId" required>${options}</select></label>
        <label class="form-label">Returning at<select name="branch" required>${selectOptions(branches.map((branch) => branch.name), defaultBranch)}</select></label>
        <div id="returnPreview" class="inline-validation valid" aria-live="polite"></div>
      </form>`, `<button class="button button-secondary" data-modal-cancel>Cancel</button><button class="button button-primary" id="confirmReturn">${icon('book-down')} Return book</button>`);
    const form = $('#returnForm');
    const updatePreview = () => {
      const loan = active.find((item) => String(item.id) === form.elements.loanId.value);
      const branch = form.elements.branch.value;
      $('#returnPreview').textContent = branch === loan.borrowBranch
        ? `Returning to ${branch}, where you borrowed it.`
        : `Borrowed at ${loan.borrowBranch}, returning at ${branch}.`;
    };
    form.addEventListener('change', updatePreview);
    updatePreview();
    $('#confirmReturn').addEventListener('click', async () => {
      $('#confirmReturn').disabled = true;
      try {
        const loan = await request(`/member/loans/${encodeURIComponent(form.elements.loanId.value)}/return`, {
          method: 'POST', body: { branch: form.elements.branch.value },
        });
        await load();
        closeModal();
        rerender();
        toast(`${getBook(loan.bookId)?.title || 'Book'} returned at ${loan.returnBranch}.`);
      } catch (error) {
        toast(error.message, 'warning');
        $('#confirmReturn').disabled = false;
      }
    });
  }

  function handleAction(action, element) {
    if (action === 'borrow') borrow(element.dataset.bookId, element);
    if (action === 'return-book') showReturnModal(element.dataset.loanId);
  }

  return {
    defaultView: 'my-library', profileName: profile.name, roleLabel: 'Library member', load, render, handleAction,
  };
}
