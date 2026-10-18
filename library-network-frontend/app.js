
(() => {
  'use strict';

  const STORAGE_KEY = 'libramind-network-v1';
  const MAX_ACTIVE_LOANS = 3;
  const BRANCHES = [
    { name: 'Delhi', city: 'Connaught Place', color: 'violet', initials: 'DE' },
    { name: 'Mumbai', city: 'Fort', color: 'blue', initials: 'MU' },
    { name: 'Bangalore', city: 'Indiranagar', color: 'teal', initials: 'BL' },
    { name: 'Chennai', city: 'Anna Nagar', color: 'orange', initials: 'CH' },
    { name: 'Kolkata', city: 'Park Street', color: 'pink', initials: 'KO' },
  ];

  const SEED = {
    members: [
      { id: 'M001', name: 'Anmol', card: 'LM-1001', homeBranch: 'Delhi', email: 'anmol@example.com' },
      { id: 'M002', name: 'Vishesh', card: 'LM-1002', homeBranch: 'Mumbai', email: 'vishesh@example.com' },
      { id: 'M003', name: 'Annie', card: 'LM-1003', homeBranch: 'Bangalore', email: 'annie@example.com' },
      { id: 'M004', name: 'Ab', card: 'LM-1004', homeBranch: 'Chennai', email: 'ab@example.com' },
      { id: 'M005', name: 'Hey', card: 'LM-1005', homeBranch: 'Kolkata', email: 'hey@example.com' },
    ],
    books: [
      { id: 'B001', title: 'Harry Potter and the Philosopher’s Stone', author: 'J. K. Rowling', category: 'Fantasy', branch: 'Delhi', copyNo: 1 },
      { id: 'B002', title: 'The Chronicles of Narnia', author: 'C. S. Lewis', category: 'Fantasy', branch: 'Delhi', copyNo: 1 },
      { id: 'B007', title: 'The Hobbit', author: 'J. R. R. Tolkien', category: 'Fantasy', branch: 'Delhi', copyNo: 1 },
      { id: 'B010', title: 'Pride and Prejudice', author: 'Jane Austen', category: 'Classic', branch: 'Delhi', copyNo: 1 },
      { id: 'B003', title: 'Harry Potter and the Philosopher’s Stone', author: 'J. K. Rowling', category: 'Fantasy', branch: 'Mumbai', copyNo: 2 },
      { id: 'B004', title: 'The Lord of the Rings', author: 'J. R. R. Tolkien', category: 'Fantasy', branch: 'Mumbai', copyNo: 1 },
      { id: 'B008', title: 'To Kill a Mockingbird', author: 'Harper Lee', category: 'Classic', branch: 'Mumbai', copyNo: 1 },
      { id: 'B011', title: 'The Alchemist', author: 'Paulo Coelho', category: 'Fiction', branch: 'Mumbai', copyNo: 1 },
      { id: 'B006', title: 'Percy Jackson and the Olympians', author: 'Rick Riordan', category: 'Fantasy', branch: 'Bangalore', copyNo: 1 },
      { id: 'B005', title: 'Harry Potter and the Philosopher’s Stone', author: 'J. K. Rowling', category: 'Fantasy', branch: 'Bangalore', copyNo: 3 },
      { id: 'B009', title: '1984', author: 'George Orwell', category: 'Classic', branch: 'Bangalore', copyNo: 1 },
      { id: 'B012', title: 'A Song of Ice and Fire', author: 'George R. R. Martin', category: 'Fantasy', branch: 'Chennai', copyNo: 1 },
      { id: 'B013', title: 'Harry Potter and the Philosopher’s Stone', author: 'J. K. Rowling', category: 'Fantasy', branch: 'Kolkata', copyNo: 4 },
    ],
    loans: [],
    activity: [],
    nextLoanId: 1,
    nextBookId: 14,
    nextMemberId: 6,
  };

  let state = loadState();
  let activeView = 'dashboard';
  let selectedMemberId = state.members[0]?.id || '';
  let lastFocusedElement = null;
  let session = null;
  const DEMO_ADMIN_USERNAME = 'admin';
  const DEMO_ADMIN_PASSWORD = 'admin123';
  const DEMO_MEMBER_PASSWORD = 'member123';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const titleKey = (title) => title.trim().toLocaleLowerCase().replace(/[’']/g, "'");
  const getBranch = (name) => BRANCHES.find((branch) => branch.name === name);
  const getMember = (id) => state.members.find((member) => member.id === id);
  const getBook = (id) => state.books.find((book) => book.id === id);
  const isActiveLoan = (loan) => !loan.returnedAt;
  const activeLoans = (memberId) => state.loans.filter((loan) => loan.memberId === memberId && isActiveLoan(loan));
  const isBookAvailable = (book) => !state.loans.some((loan) => loan.bookId === book.id && isActiveLoan(loan));
  const availableCopies = (books) => books.filter(isBookAvailable).length;
  const formatDate = (date) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
  const initials = (name) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.books) && Array.isArray(parsed.members) && Array.isArray(parsed.loans)) return parsed;
      }
    } catch (error) {
      console.warn('Could not load saved demo data:', error);
    }
    return structuredClone(SEED);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Could not save demo data:', error);
      toast('Browser storage is unavailable; changes may not persist.', 'warning');
    }
  }

  function logActivity(type, message, detail = '') {
    state.activity.unshift({ id: `A${Date.now()}`, type, message, detail, at: new Date().toISOString() });
    state.activity = state.activity.slice(0, 30);
    saveState();
  }

  function icon(name, className = '') {
    return `<i data-lucide="${name}"${className ? ` class="${className}"` : ''}></i>`;
  }

  function refreshIcons() {
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  function toast(message, type = 'success') {
    const element = document.createElement('div');
    element.className = `toast toast-${type}`;
    element.innerHTML = `${icon(type === 'success' ? 'check-circle-2' : type === 'warning' ? 'alert-triangle' : 'alert-circle')}<span>${escapeHtml(message)}</span>`;
    $('#toastRegion').append(element);
    refreshIcons();
    window.setTimeout(() => element.remove(), 3600);
  }

  function updateSignInFields() {
    const isAdmin = $('#signInRole').value === 'admin';
    $('#signInIdentityLabel').firstChild.textContent = isAdmin ? 'Administrator username' : 'Library card number';
    $('#signInIdentity').placeholder = isAdmin ? 'admin' : 'e.g. LM-1001';
    $('#signInIdentity').autocomplete = 'username';
    $('#signInError').hidden = true;
  }

  function signIn(event) {
    event.preventDefault();
    const role = $('#signInRole').value;
    const identity = $('#signInIdentity').value.trim();
    const password = $('#signInPassword').value;
    let nextSession = null;
    if (role === 'admin' && identity.toLowerCase() === DEMO_ADMIN_USERNAME && password === DEMO_ADMIN_PASSWORD) {
      nextSession = { role: 'admin', name: 'Library Admin' };
    } else if (role === 'member' && password === DEMO_MEMBER_PASSWORD) {
      const member = state.members.find((item) => item.card.toLowerCase() === identity.toLowerCase());
      if (member) nextSession = { role: 'member', memberId: member.id, name: member.name };
    }
    if (!nextSession) {
      $('#signInError').textContent = 'Those sign-in details were not recognised. Check the demo credentials and try again.';
      $('#signInError').hidden = false;
      return;
    }
    session = nextSession;
    if (session.role === 'member') selectedMemberId = session.memberId;
    $('#authScreen').hidden = true;
    $('#appShell').hidden = false;
    applyRoleInterface();
    switchView(session.role === 'admin' ? 'dashboard' : 'member');
    toast(`Signed in as ${session.name}.`);
  }

  function signOut() {
    session = null;
    $('#appShell').hidden = true;
    $('#authScreen').hidden = false;
    $('#signInForm').reset();
    $('#signInRole').value = 'member';
    updateSignInFields();
    $('#signInIdentity').focus();
  }

  function applyRoleInterface() {
    const isMember = session?.role === 'member';
    $$('.nav-item[data-view]').forEach((button) => {
      const view = button.dataset.view;
      button.hidden = isMember ? view !== 'member' : view === 'member';
    });
    $('.workspace-label').hidden = isMember;
    $('.sidebar-divider').hidden = isMember;
    $('.sidebar-bottom').hidden = isMember;
    $('#globalBranch').closest('.branch-switcher').hidden = isMember;
    $('#resetDemo').hidden = isMember;
    $('#profileButton .profile-copy strong').textContent = isMember ? session.name : 'Library Admin';
    $('#profileButton .profile-copy small').textContent = isMember ? 'Library member · Sign out' : 'Administrator · Sign out';
    $('#profileButton .avatar').textContent = initials(session.name);
    $('#view-member .eyebrow').textContent = isMember ? 'YOUR LIBRARY ACCOUNT' : 'MEMBER EXPERIENCE PREVIEW';
    $('#view-member .page-heading .muted').textContent = isMember
      ? 'Your library card, registered branch, and books currently checked out.'
      : 'A preview of what a library-card holder sees. Choose a demo member to explore.';
    $('#view-member .member-select-label').hidden = isMember;
    $('#view-member .member-portal-grid').hidden = isMember;
    $('#view-member .notice-strip').hidden = false;
    $('#view-member .notice-strip span').textContent = isMember
      ? 'For account changes or returns, please visit any branch library desk.'
      : 'This is a front-end preview. A real card login and secure account sync require backend/API integration.';
    if (isMember) selectedMemberId = session.memberId;
  }

  function switchView(view) {
    if (!session) return;
    if (session.role === 'member' && view !== 'member') return;
    if (session.role === 'admin' && view === 'member') return;
    const target = $(`#view-${view}`);
    if (!target) return;
    activeView = view;
    $$('.page-view').forEach((element) => element.classList.toggle('active', element === target));
    $$('.nav-item[data-view]').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
    $('#breadcrumbCurrent').textContent = ({
      dashboard: 'Overview', catalogue: 'Book catalogue', branches: 'Branch inventory',
      loans: 'Borrow & return', members: 'Members', member: 'Member portal',
    })[view] || view;
    $('#sidebar').classList.remove('sidebar-open');
    renderView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderView(view) {
    if (view === 'dashboard') renderDashboard();
    if (view === 'catalogue') renderCatalogue();
    if (view === 'branches') renderBranches();
    if (view === 'loans') renderLoans();
    if (view === 'members') renderMembers();
    if (view === 'member') renderMemberPortal();
    refreshIcons();
  }

  function currentBranch() {
    return $('#globalBranch').value || 'all';
  }

  function scopedBooks(branch = currentBranch()) {
    return branch === 'all' ? state.books : state.books.filter((book) => book.branch === branch);
  }

  function renderDashboard() {
    const books = scopedBooks();
    const titles = new Set(books.map((book) => titleKey(book.title)));
    const available = availableCopies(books);
    const loans = state.loans.filter((loan) => isActiveLoan(loan) && (currentBranch() === 'all' || loan.borrowBranch === currentBranch()));
    $('#statTitles').textContent = titles.size;
    $('#statCopies').textContent = books.length;
    $('#statAvailable').textContent = `${available} available`;
    $('#statLoans').textContent = loans.length;
    $('#statMembers').textContent = state.members.length;
    $('#dashboardBranches').innerHTML = BRANCHES.map((branch) => {
      const branchBooks = state.books.filter((book) => book.branch === branch.name);
      const branchAvailable = availableCopies(branchBooks);
      const percent = branchBooks.length ? Math.round((branchAvailable / branchBooks.length) * 100) : 0;
      return `<button class="branch-row" data-branch-open="${branch.name}">
        <span class="branch-avatar ${branch.color}">${branch.initials}</span>
        <span class="branch-row-main"><strong>${branch.name}</strong><small>${branch.city}</small></span>
        <span class="branch-row-stock"><strong>${branchAvailable}<small> / ${branchBooks.length}</small></strong><span class="mini-progress"><span style="width:${percent}%"></span></span></span>
      </button>`;
    }).join('');
    const events = state.activity.slice(0, 5);
    $('#recentActivity').innerHTML = events.length ? events.map((event) => `
      <div class="activity-row"><span class="activity-icon ${event.type === 'return' ? 'green' : event.type === 'issue' ? 'blue' : 'purple'}">${icon(event.type === 'return' ? 'book-down' : event.type === 'issue' ? 'book-up' : 'sparkles')}</span><div><strong>${escapeHtml(event.message)}</strong><p>${escapeHtml(event.detail || '')}</p></div><time>${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.at))}</time></div>`).join('') : '<div class="empty-state compact-empty"><span class="empty-icon">✦</span><strong>No activity yet</strong><p>Issue or return a book to see activity here.</p></div>';
  }

  function bookCover(book) {
    const themes = { Fantasy: 'cover-violet', Classic: 'cover-sand', Fiction: 'cover-teal', Science: 'cover-blue' };
    const theme = themes[book.category] || 'cover-blue';
    return `<div class="book-cover ${theme}"><span class="cover-line"></span><span class="cover-title">${escapeHtml(book.title)}</span><span class="cover-author">${escapeHtml(book.author)}</span><span class="cover-emblem">✦</span></div>`;
  }

  function renderCatalogue() {
    const query = ($('#catalogueSearch')?.value || '').trim().toLocaleLowerCase();
    const branch = $('#catalogueBranch')?.value || 'all';
    const availability = $('#catalogueAvailability')?.value || 'all';
    const books = state.books.filter((book) => {
      const matchesQuery = [book.title, book.author, book.id, book.category].some((value) => value.toLocaleLowerCase().includes(query));
      return matchesQuery && (branch === 'all' || book.branch === branch)
        && (availability === 'all' || (availability === 'available' ? isBookAvailable(book) : !isBookAvailable(book)));
    });
    $('#catalogueCount').textContent = `${books.length} physical ${books.length === 1 ? 'copy' : 'copies'} · ${new Set(books.map((book) => titleKey(book.title))).size} unique titles`;
    $('#bookGrid').innerHTML = books.length ? books.map((book) => {
      const available = isBookAvailable(book);
      return `<article class="book-card">${bookCover(book)}<div class="book-card-content"><div class="book-card-top"><span class="category-chip">${escapeHtml(book.category)}</span><span class="availability-chip ${available ? 'is-available' : 'is-borrowed'}"><span class="legend-dot ${available ? 'available' : 'borrowed'}"></span>${available ? 'Available' : 'On loan'}</span></div><h3>${escapeHtml(book.title)}</h3><p class="book-author">${escapeHtml(book.author)}</p><div class="book-meta"><span>${icon('map-pin')} ${escapeHtml(book.branch)}</span><span>${escapeHtml(book.id)}</span></div><button class="button ${available ? 'button-secondary' : 'button-disabled'} full-button" ${available ? `data-action="issue-book" data-book-id="${book.id}"` : 'disabled'}>${available ? 'Issue this copy' : 'Currently on loan'} ${icon('arrow-up-right')}</button></div></article>`;
    }).join('') : '<div class="empty-state full-span"><span class="empty-icon">⌕</span><strong>No matching copies</strong><p>Try another search or change your filters.</p></div>';
  }

  function renderBranches() {
    const selected = currentBranch();
    const branches = selected === 'all' ? BRANCHES : BRANCHES.filter((branch) => branch.name === selected);
    $('#branchCards').innerHTML = branches.map((branch) => {
      const books = state.books.filter((book) => book.branch === branch.name);
      const available = availableCopies(books);
      const borrowed = books.length - available;
      return `<button class="branch-card ${selected === branch.name ? 'selected' : ''}" data-branch-open="${branch.name}"><div class="branch-card-top"><span class="branch-avatar large ${branch.color}">${branch.initials}</span><span class="branch-open-link">${icon('arrow-up-right')}</span></div><h3>${branch.name} Library</h3><p>${branch.city}</p><div class="branch-card-stats"><div><strong>${books.length}</strong><small>Total copies</small></div><div><strong>${available}</strong><small>Available</small></div><div><strong>${borrowed}</strong><small>On loan</small></div></div><div class="stock-progress"><span style="width:${books.length ? (available / books.length) * 100 : 0}%"></span></div></button>`;
    }).join('');
    $('#inventoryTitle').textContent = selected === 'all' ? 'All branch stock' : `${selected} branch stock`;
    renderInventoryRows();
  }

  function renderInventoryRows() {
    const query = ($('#inventorySearch')?.value || '').toLocaleLowerCase();
    const branch = currentBranch();
    const books = scopedBooks(branch).filter((book) => [book.title, book.author, book.id, book.branch].some((value) => value.toLocaleLowerCase().includes(query)));
    $('#inventoryRows').innerHTML = books.length ? books.map((book) => {
      const loan = state.loans.find((item) => item.bookId === book.id && isActiveLoan(item));
      const member = loan ? getMember(loan.memberId) : null;
      return `<tr><td><div class="table-book"><span class="table-book-icon">${icon('book-open')}</span><span><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.id)} · ${escapeHtml(book.author)}</small></span></div></td><td><span class="branch-tag">${escapeHtml(book.branch)}</span></td><td><span class="status-chip ${loan ? 'status-loaned' : 'status-available'}"><span class="legend-dot ${loan ? 'borrowed' : 'available'}"></span>${loan ? 'On loan' : 'Available'}</span></td><td>${member ? escapeHtml(member.name) : '<span class="muted">—</span>'}</td><td>${loan ? `<button class="table-action" data-action="return-book" data-loan-id="${loan.id}">Return <i data-lucide="arrow-right"></i></button>` : `<button class="table-action" data-action="issue-book" data-book-id="${book.id}">Issue <i data-lucide="arrow-right"></i></button>`}</td></tr>`;
    }).join('') : '<tr><td colspan="5"><div class="empty-state compact-empty"><strong>No inventory matches</strong><p>Try a different branch or search term.</p></div></td></tr>';
    refreshIcons();
  }

  function renderLoans() {
    const active = state.loans.filter(isActiveLoan).length;
    const returned = state.loans.length - active;
    $('#loanMetrics').innerHTML = `<div class="loan-metric"><span class="stat-icon orange">${icon('book-up')}</span><div><strong>${active}</strong><small>Active loans</small></div></div><div class="loan-metric"><span class="stat-icon green">${icon('book-check')}</span><div><strong>${returned}</strong><small>Returned copies</small></div></div><div class="loan-metric"><span class="stat-icon violet">${icon('git-compare-arrows')}</span><div><strong>${state.loans.filter((loan) => loan.returnedAt && loan.returnBranch !== loan.borrowBranch).length}</strong><small>Cross-branch returns</small></div></div>`;
    const status = $('#loanStatus').value;
    const query = $('#loanSearch').value.toLocaleLowerCase();
    const loans = [...state.loans].reverse().filter((loan) => {
      const member = getMember(loan.memberId);
      const book = getBook(loan.bookId);
      return (status === 'all' || (status === 'active' ? isActiveLoan(loan) : !isActiveLoan(loan)))
        && [member?.name, member?.card, book?.title, book?.id, loan.borrowBranch, loan.returnBranch].some((value) => (value || '').toLocaleLowerCase().includes(query));
    });
    $('#loanRows').innerHTML = loans.length ? loans.map((loan) => {
      const book = getBook(loan.bookId);
      const member = getMember(loan.memberId);
      const activeLoan = isActiveLoan(loan);
      return `<tr><td><div class="table-book"><span class="table-book-icon">${icon('book-open')}</span><span><strong>${escapeHtml(book?.title || 'Removed book')}</strong><small>${escapeHtml(book?.id || loan.bookId)} · ${formatDate(loan.borrowedAt)}</small></span></div></td><td><div class="member-cell"><span class="avatar small">${initials(member?.name || '?')}</span><span><strong>${escapeHtml(member?.name || 'Unknown')}</strong><small>${escapeHtml(member?.card || '')}</small></span></div></td><td><span class="branch-tag">${escapeHtml(loan.borrowBranch)}</span></td><td>${loan.returnBranch ? `<span class="branch-tag">${escapeHtml(loan.returnBranch)}</span><small class="table-subline">${loan.returnBranch !== loan.borrowBranch ? 'Cross-branch return' : 'Same branch'}</small>` : '<span class="muted">Not returned</span>'}</td><td><span class="status-chip ${activeLoan ? 'status-loaned' : 'status-returned'}">${activeLoan ? 'Active' : 'Returned'}</span></td><td>${activeLoan ? `<button class="table-action" data-action="return-book" data-loan-id="${loan.id}">Return <i data-lucide="arrow-right"></i></button>` : '<span class="muted">Complete</span>'}</td></tr>`;
    }).join('') : '<tr><td colspan="6"><div class="empty-state compact-empty"><strong>No loans found</strong><p>Try another filter, or issue a book to create a loan.</p></div></td></tr>';
    refreshIcons();
  }

  function renderMembers() {
    const query = ($('#memberSearch')?.value || '').toLocaleLowerCase();
    const members = state.members.filter((member) => [member.name, member.card, member.email, member.homeBranch].some((value) => value.toLocaleLowerCase().includes(query)));
    $('#membersGrid').innerHTML = members.length ? members.map((member) => {
      const loans = activeLoans(member.id);
      return `<article class="member-card"><div class="member-card-top"><span class="avatar member-avatar">${initials(member.name)}</span><span class="member-card-id">${escapeHtml(member.card)}</span></div><h3>${escapeHtml(member.name)}</h3><p>${escapeHtml(member.email)}</p><div class="member-home">${icon('map-pin')} Registered at ${escapeHtml(member.homeBranch)}</div><div class="member-card-bottom"><div><strong>${loans.length} / ${MAX_ACTIVE_LOANS}</strong><small>Active books</small></div><div class="member-progress"><span style="width:${(loans.length / MAX_ACTIVE_LOANS) * 100}%"></span></div></div><button class="button button-secondary full-button" data-action="view-member" data-member-id="${member.id}">View member account ${icon('arrow-up-right')}</button></article>`;
    }).join('') : '<div class="empty-state full-span"><strong>No members found</strong><p>Try another search or register a new member.</p></div>';
  }

  function renderMemberPortal() {
    const select = $('#memberPortalSelect');
    const previous = selectedMemberId;
    select.innerHTML = state.members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)} · ${escapeHtml(member.card)}</option>`).join('');
    if (state.members.some((member) => member.id === previous)) selectedMemberId = previous;
    else selectedMemberId = state.members[0]?.id || '';
    select.value = selectedMemberId;
    const member = getMember(selectedMemberId);
    if (!member) {
      $('#memberWelcome').innerHTML = '<div class="empty-state"><strong>No member accounts yet</strong><p>Register a member from the admin portal to preview this view.</p></div>';
      $('#memberActiveLoans').innerHTML = '';
      $('#memberCatalogue').innerHTML = '';
      $('#memberLoanCount').textContent = '0 / 3';
      return;
    }
    const loans = activeLoans(member.id);
    $('#memberWelcome').innerHTML = `<div class="member-welcome-left"><span class="avatar member-avatar">${initials(member.name)}</span><div><p class="eyebrow">WELCOME BACK</p><h2>${escapeHtml(member.name)}</h2><p>Library card <strong>${escapeHtml(member.card)}</strong> · Home branch: ${escapeHtml(member.homeBranch)}</p><p class="member-account-meta">Account ID ${escapeHtml(member.id)} · ${escapeHtml(member.email)} · Active member</p></div></div><div class="member-limit"><span class="limit-ring"><strong>${MAX_ACTIVE_LOANS - loans.length}</strong><small>left</small></span><div><strong>Borrowing allowance</strong><p>${loans.length} of ${MAX_ACTIVE_LOANS} active loans</p></div></div>`;
    $('#memberLoanCount').textContent = `${loans.length} / ${MAX_ACTIVE_LOANS}`;
    $('#memberActiveLoans').innerHTML = loans.length ? loans.map((loan) => {
      const book = getBook(loan.bookId);
      return `<div class="member-loan-row">${bookCover(book)}<div class="member-loan-info"><strong>${escapeHtml(book.title)}</strong><p>${escapeHtml(book.author)}</p><span>Borrowed from ${escapeHtml(loan.borrowBranch)} · ${formatDate(loan.borrowedAt)}</span></div><span class="status-chip status-loaned">On loan</span></div>`;
    }).join('') : '<div class="empty-state compact-empty"><span class="empty-icon">✦</span><strong>Your shelf is clear</strong><p>You have no active loans. Find your next read.</p></div>';
    const query = ($('#memberPortalSearch')?.value || '').toLocaleLowerCase();
    const titleGroups = new Map();
    state.books.forEach((book) => {
      const key = titleKey(book.title);
      if (!titleGroups.has(key)) titleGroups.set(key, { title: book.title, author: book.author, category: book.category, copies: [] });
      titleGroups.get(key).copies.push(book);
    });
    const filtered = [...titleGroups.values()].filter((group) => [group.title, group.author, group.category].some((value) => value.toLocaleLowerCase().includes(query)));
    $('#memberCatalogue').innerHTML = filtered.map((group) => {
      const available = group.copies.filter(isBookAvailable);
      const alreadyBorrowed = loans.some((loan) => titleKey(getBook(loan.bookId)?.title || '') === titleKey(group.title));
      const branches = [...new Set(available.map((book) => book.branch))];
      const borrowCopy = available[0];
      return `<div class="member-catalogue-row"><div class="member-catalogue-cover">${icon('book-open')}</div><div class="member-catalogue-info"><strong>${escapeHtml(group.title)}</strong><p>${escapeHtml(group.author)}</p><small>${available.length} available · ${branches.length ? branches.join(', ') : 'No available branches'}</small></div><button class="mini-button" ${(!borrowCopy || alreadyBorrowed || loans.length >= MAX_ACTIVE_LOANS) ? 'disabled' : `data-action="member-borrow" data-book-id="${borrowCopy.id}"`} title="${alreadyBorrowed ? 'You already have this title on loan' : loans.length >= MAX_ACTIVE_LOANS ? 'Return a book before borrowing another' : 'Borrow from an available branch'}">${alreadyBorrowed ? 'On loan' : borrowCopy ? 'Borrow' : 'Unavailable'}</button></div>`;
    }).join('') || '<p class="muted empty-search">No books match that search.</p>';
  }

  function openModal(title, eyebrow, body, footer) {
    lastFocusedElement = document.activeElement;
    $('#modalTitle').textContent = title;
    $('#modalEyebrow').textContent = eyebrow;
    $('#modalBody').innerHTML = body;
    $('#modalFooter').innerHTML = footer;
    $('#modalBackdrop').hidden = false;
    document.body.classList.add('modal-open');
    refreshIcons();
    $('#modalClose').focus();
  }

  function closeModal() {
    $('#modalBackdrop').hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocusedElement?.focus) lastFocusedElement.focus();
  }

  function selectOptions(values, selected = '') {
    return values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }

  function showIssueModal(preselectedBookId = '') {
    const available = state.books.filter(isBookAvailable);
    const memberOptions = state.members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)} — ${escapeHtml(member.card)}</option>`).join('');
    const bookOptions = available.map((book) => `<option value="${book.id}" ${book.id === preselectedBookId ? 'selected' : ''}>${escapeHtml(book.title)} — ${escapeHtml(book.branch)} (${book.id})</option>`).join('');
    openModal('Issue a book', 'CIRCULATION DESK', `
      <form id="issueForm" class="form-stack">
        <div class="form-note"><i data-lucide="shield-check"></i><span>Rules apply network-wide: maximum ${MAX_ACTIVE_LOANS} active books per member, and no duplicate active title.</span></div>
        <label class="form-label">Member / library card<select name="memberId" required>${memberOptions}</select></label>
        <label class="form-label">Available physical copy<select name="bookId" required>${bookOptions}</select></label>
        <label class="form-label">Issue from branch<select name="borrowBranch" required>${selectOptions(BRANCHES.map((branch) => branch.name), currentBranch() === 'all' ? (getBook(preselectedBookId)?.branch || BRANCHES[0].name) : currentBranch())}</select></label>
        <div id="issueValidation" class="inline-validation" aria-live="polite">Choose a member and copy to validate the issue.</div>
      </form>`, `<button class="button button-secondary" data-modal-cancel>Cancel</button><button class="button button-primary" id="confirmIssue">${icon('book-up')} Issue book</button>`);
    const form = $('#issueForm');
    const validate = () => {
      const member = getMember(form.elements.memberId.value);
      const book = getBook(form.elements.bookId.value);
      const loans = member ? activeLoans(member.id) : [];
      const duplicate = member && book && loans.some((loan) => titleKey(getBook(loan.bookId)?.title || '') === titleKey(book.title));
      const message = !member || !book ? 'Select a member and an available copy.'
        : loans.length >= MAX_ACTIVE_LOANS ? `${member.name} already has ${MAX_ACTIVE_LOANS} active books. A return is required first.`
          : duplicate ? `${member.name} already has this title on loan. Duplicate titles are blocked.`
            : `Ready to issue to ${member.name}. They currently have ${loans.length} of ${MAX_ACTIVE_LOANS} active books.`;
      $('#issueValidation').textContent = message;
      $('#issueValidation').className = `inline-validation ${loans.length >= MAX_ACTIVE_LOANS || duplicate ? 'invalid' : 'valid'}`;
      $('#confirmIssue').disabled = !member || !book || loans.length >= MAX_ACTIVE_LOANS || duplicate;
    };
    form.addEventListener('change', validate);
    $('#confirmIssue').addEventListener('click', () => {
      if (!form.reportValidity()) return;
      const result = issueBook(form.elements.memberId.value, form.elements.bookId.value, form.elements.borrowBranch.value);
      if (result.ok) {
        closeModal();
        renderView(activeView);
        toast(result.message);
      } else {
        $('#issueValidation').textContent = result.message;
        $('#issueValidation').className = 'inline-validation invalid';
      }
    });
    validate();
  }

  function issueBook(memberId, bookId, borrowBranch) {
    const member = getMember(memberId);
    const book = getBook(bookId);
    if (!member || !book) return { ok: false, message: 'Choose a valid member and book copy.' };
    if (!isBookAvailable(book)) return { ok: false, message: 'That physical copy is already on loan.' };
    const loans = activeLoans(member.id);
    if (loans.length >= MAX_ACTIVE_LOANS) return { ok: false, message: `${member.name} has reached the ${MAX_ACTIVE_LOANS}-book limit.` };
    if (loans.some((loan) => titleKey(getBook(loan.bookId)?.title || '') === titleKey(book.title))) {
      return { ok: false, message: 'This member already has the same title on loan.' };
    }
    const loan = {
      id: `L${String(state.nextLoanId++).padStart(4, '0')}`,
      memberId, bookId, borrowBranch, borrowedAt: new Date().toISOString(),
      returnedAt: null, returnBranch: null,
    };
    state.loans.push(loan);
    logActivity('issue', `${member.name} borrowed a book`, `${book.title} · Issued at ${borrowBranch}`);
    return { ok: true, message: `${book.title} issued to ${member.name} at ${borrowBranch}.` };
  }

  function showReturnModal(preselectedLoanId = '') {
    const loans = state.loans.filter(isActiveLoan);
    const options = loans.map((loan) => {
      const book = getBook(loan.bookId);
      const member = getMember(loan.memberId);
      return `<option value="${loan.id}" ${loan.id === preselectedLoanId ? 'selected' : ''}>${escapeHtml(book?.title || loan.bookId)} — ${escapeHtml(member?.name || 'Unknown')} (borrowed at ${escapeHtml(loan.borrowBranch)})</option>`;
    }).join('');
    openModal('Return a book', 'CIRCULATION DESK', `
      <form id="returnForm" class="form-stack">
        <div class="form-note"><i data-lucide="git-compare-arrows"></i><span>Returns are accepted at any branch. The original borrowing branch does not have to match.</span></div>
        <label class="form-label">Active loan<select name="loanId" required>${options}</select></label>
        <label class="form-label">Return received at<select name="returnBranch" required>${selectOptions(BRANCHES.map((branch) => branch.name), currentBranch() === 'all' ? BRANCHES[0].name : currentBranch())}</select></label>
        <div id="returnPreview" class="inline-validation valid">The return branch will be recorded against this loan.</div>
      </form>`, `<button class="button button-secondary" data-modal-cancel>Cancel</button><button class="button button-primary" id="confirmReturn">${icon('book-down')} Complete return</button>`);
    const form = $('#returnForm');
    if (!loans.length) {
      form.innerHTML = '<div class="empty-state compact-empty"><strong>No active loans</strong><p>There are no books waiting to be returned.</p></div>';
      $('#confirmReturn').disabled = true;
      return;
    }
    const updatePreview = () => {
      const loan = state.loans.find((item) => item.id === form.elements.loanId.value);
      if (!loan) return;
      const branch = form.elements.returnBranch.value;
      $('#returnPreview').textContent = branch === loan.borrowBranch
        ? `Returning to ${branch}, the original borrowing branch.`
        : `Cross-branch return: borrowed at ${loan.borrowBranch}, returning at ${branch}.`;
    };
    form.addEventListener('change', updatePreview);
    $('#confirmReturn').addEventListener('click', () => {
      if (!form.reportValidity()) return;
      const result = returnBook(form.elements.loanId.value, form.elements.returnBranch.value);
      if (result.ok) {
        closeModal();
        renderView(activeView);
        toast(result.message);
      } else toast(result.message, 'warning');
    });
    updatePreview();
  }

  function returnBook(loanId, returnBranch) {
    const loan = state.loans.find((item) => item.id === loanId && isActiveLoan(item));
    if (!loan) return { ok: false, message: 'That loan is already returned or does not exist.' };
    const book = getBook(loan.bookId);
    const member = getMember(loan.memberId);
    loan.returnedAt = new Date().toISOString();
    loan.returnBranch = returnBranch;
    logActivity('return', `${member?.name || 'Member'} returned a book`, `${book?.title || loan.bookId} · Returned at ${returnBranch}`);
    return { ok: true, message: `${book?.title || 'Book'} returned at ${returnBranch}.` };
  }

  function showAddBookModal() {
    openModal('Add a physical copy', 'CATALOGUE MANAGEMENT', `
      <form id="addBookForm" class="form-stack">
        <label class="form-label">Book title<input name="title" required maxlength="140" placeholder="e.g. The Design of Everyday Things"></label>
        <label class="form-label">Author<input name="author" required maxlength="100" placeholder="Author name"></label>
        <div class="form-row"><label class="form-label">Category<select name="category">${selectOptions(['Fiction', 'Fantasy', 'Classic', 'Science', 'History', 'Technology', 'Biography', 'Other'], 'Fiction')}</select></label><label class="form-label">Branch<select name="branch">${selectOptions(BRANCHES.map((branch) => branch.name), currentBranch() === 'all' ? 'Delhi' : currentBranch())}</select></label></div>
        <p class="form-helper">Each entry represents one physical copy. Add the same title again to register another copy at another branch.</p>
      </form>`, `<button class="button button-secondary" data-modal-cancel>Cancel</button><button class="button button-primary" id="confirmAddBook">${icon('plus')} Add copy</button>`);
    $('#confirmAddBook').addEventListener('click', () => {
      const form = $('#addBookForm');
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const title = data.get('title').trim();
      const sameTitle = state.books.filter((book) => titleKey(book.title) === titleKey(title));
      const book = {
        id: `B${String(state.nextBookId++).padStart(3, '0')}`,
        title, author: data.get('author').trim(), category: data.get('category'),
        branch: data.get('branch'), copyNo: sameTitle.length + 1,
      };
      state.books.push(book);
      logActivity('add', 'A new copy was added', `${book.title} · ${book.branch} · ${book.id}`);
      closeModal();
      renderView(activeView);
      toast(`${book.title} added to ${book.branch}.`);
    });
  }

  function showAddMemberModal() {
    openModal('Register a member', 'MEMBER DIRECTORY', `
      <form id="addMemberForm" class="form-stack">
        <label class="form-label">Full name<input name="name" required maxlength="80" placeholder="Member name"></label>
        <label class="form-label">Email address<input name="email" type="email" required placeholder="member@example.com"></label>
        <label class="form-label">Home branch<select name="homeBranch">${selectOptions(BRANCHES.map((branch) => branch.name), currentBranch() === 'all' ? 'Delhi' : currentBranch())}</select></label>
        <p class="form-helper">A demo library card ID is generated automatically. Real authentication and card verification require backend integration.</p>
      </form>`, `<button class="button button-secondary" data-modal-cancel>Cancel</button><button class="button button-primary" id="confirmAddMember">${icon('user-round-plus')} Register member</button>`);
    $('#confirmAddMember').addEventListener('click', () => {
      const form = $('#addMemberForm');
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const name = data.get('name').trim();
      const member = {
        id: `M${String(state.nextMemberId++).padStart(3, '0')}`,
        name, email: data.get('email').trim(),
        homeBranch: data.get('homeBranch'),
        card: `LM-${String(1000 + state.nextMemberId - 2).padStart(4, '0')}`,
      };
      state.members.push(member);
      selectedMemberId = member.id;
      logActivity('member', 'A new member registered', `${member.name} · ${member.card}`);
      closeModal();
      renderView(activeView);
      toast(`Library card ${member.card} created for ${member.name}.`);
    });
  }

  function showMemberDetails(memberId) {
    const member = getMember(memberId);
    if (!member) return;
    selectedMemberId = member.id;
    switchView('member');
  }

  function exportSnapshot() {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      note: 'Frontend demo data only; not a server database export.',
      rules: { maxActiveLoans: MAX_ACTIVE_LOANS, duplicateActiveTitlesAllowed: false, crossBranchBorrowing: true, crossBranchReturns: true },
      branches: BRANCHES,
      members: state.members,
      books: state.books,
      loans: state.loans,
      activity: state.activity,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'libramind-network-snapshot.json';
    anchor.click();
    URL.revokeObjectURL(url);
    toast('Snapshot exported as JSON.');
  }

  function resetDemo() {
    openModal('Reset demo data?', 'RESET WORKSPACE', '<p class="modal-description">This restores the sample catalogue and members and clears demo loans and activity stored in this browser. This cannot affect a connected backend because none is configured.</p>', '<button class="button button-secondary" data-modal-cancel>Keep my data</button><button class="button button-danger" id="confirmReset">Reset demo</button>');
    $('#confirmReset').addEventListener('click', () => {
      state = structuredClone(SEED);
      selectedMemberId = state.members[0].id;
      saveState();
      closeModal();
      renderView(activeView);
      toast('Demo data has been reset.');
    });
  }

  function handleAction(action, element) {
    if (action === 'add-book') showAddBookModal();
    if (action === 'add-member') showAddMemberModal();
    if (action === 'issue-book') showIssueModal(element?.dataset.bookId || '');
    if (action === 'return-book') showReturnModal(element?.dataset.loanId || '');
    if (action === 'export') exportSnapshot();
    if (action === 'view-member') showMemberDetails(element.dataset.memberId);
    if (action === 'member-borrow') {
      const member = getMember(selectedMemberId);
      const book = getBook(element.dataset.bookId);
      if (!member || !book) return;
      const result = issueBook(member.id, book.id, book.branch);
      renderMemberPortal();
      if (result.ok) toast(result.message);
      else toast(result.message, 'warning');
    }
  }

  function bindEvents() {
    $('#signInRole').addEventListener('change', updateSignInFields);
    $('#signInForm').addEventListener('submit', signIn);
    $('#profileButton').addEventListener('click', signOut);
    $$('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    $$('[data-view]').forEach((button) => {
      if (!button.classList.contains('nav-item')) button.addEventListener('click', () => switchView(button.dataset.view));
    });
    document.addEventListener('click', (event) => {
      const actionElement = event.target.closest('[data-action]');
      if (actionElement) handleAction(actionElement.dataset.action, actionElement);
      const branchElement = event.target.closest('[data-branch-open]');
      if (branchElement) {
        $('#globalBranch').value = branchElement.dataset.branchOpen;
        switchView('branches');
      }
      if (event.target.closest('[data-modal-cancel]')) closeModal();
    });
    $('#globalBranch').addEventListener('change', () => renderView(activeView));
    $('#catalogueSearch').addEventListener('input', renderCatalogue);
    $('#catalogueBranch').addEventListener('change', renderCatalogue);
    $('#catalogueAvailability').addEventListener('change', renderCatalogue);
    $('#inventorySearch').addEventListener('input', renderInventoryRows);
    $('#loanStatus').addEventListener('change', renderLoans);
    $('#loanSearch').addEventListener('input', renderLoans);
    $('#memberSearch').addEventListener('input', renderMembers);
    $('#memberPortalSelect').addEventListener('change', (event) => {
      selectedMemberId = event.target.value;
      renderMemberPortal();
      refreshIcons();
    });
    $('#memberPortalSearch').addEventListener('input', renderMemberPortal);
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalBackdrop').addEventListener('click', (event) => {
      if (event.target === $('#modalBackdrop')) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#modalBackdrop').hidden) closeModal();
    });
    $('#resetDemo').addEventListener('click', resetDemo);
    $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('sidebar-open'));
  }

  function seedActivityIfEmpty() {
    if (state.activity.length) return;
    state.activity = [
      { id: 'A-seed-1', type: 'member', message: 'Library network ready', detail: 'Sample branches and catalogue loaded', at: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
      { id: 'A-seed-2', type: 'add', message: '13 physical copies in catalogue', detail: 'Across five branches', at: new Date(Date.now() - 1000 * 60 * 42).toISOString() },
    ];
    saveState();
  }

  function init() {
    seedActivityIfEmpty();
    bindEvents();
    updateSignInFields();
    $('#appShell').hidden = true;
    $('#authScreen').hidden = false;
    refreshIcons();
  }

  init();
})();