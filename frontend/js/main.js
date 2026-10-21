// Entry point: sign in or sign up, then hand over to the member or admin side.
// Screens marked data-role="member" or data-role="admin" in index.html are
// shown only to that role; the rest are shared.

import { createAdminPortal } from './admin.js';
import { onSessionExpired, request, requestToken, setToken } from './api.js';
import { createMemberPortal } from './member.js';
import { $, $$, closeModal, escapeHtml, initials, isModalOpen, refreshIcons, toast, trapModalFocus } from './ui.js';

const PORTALS = { member: createMemberPortal, admin: createAdminPortal };
const VIEW_TITLES = {
  'my-library': 'My library', overview: 'Overview', catalogue: 'Book catalogue', branches: 'Branch inventory', loans: 'My loans',
};
const NOT_RECOGNISED = 'Those sign-in details were not recognised. Check them and try again.';

let role = null; // 'member' or 'admin' while signed in
let portal = null; // that role's screens and actions
let activeView = '';

// ---------- Sign in and sign up ----------

function showError(selector, message) {
  $(selector).textContent = message;
  $(selector).hidden = false;
}

function updateSignInFields() {
  const isAdmin = $('#signInRole').value === 'admin';
  $('#signInIdentityLabel').firstChild.textContent = isAdmin ? 'Administrator username' : 'Library card number';
  $('#signInIdentity').placeholder = isAdmin ? 'admin' : 'e.g. LM-1001';
  $('#signUpPrompt').hidden = isAdmin;
  $('#signInError').hidden = true;
}

async function loadSignUpBranches() {
  try {
    const branches = await request('/branches');
    $('#signUpBranch').innerHTML = branches
      .map((branch) => `<option value="${escapeHtml(branch.name)}">${escapeHtml(branch.name)} · ${escapeHtml(branch.city)}</option>`).join('');
  } catch (error) {
    showError('#signUpError', error.message);
  }
}

function showAuthForm(form) {
  const signingUp = form === 'signup';
  $('#signInForm').hidden = signingUp;
  $('#signUpForm').hidden = !signingUp;
  $('#authTitle').textContent = signingUp ? 'Create your library account' : 'Sign in to your library';
  $('#authIntro').textContent = signingUp
    ? 'You get a library card number straight away.'
    : 'Members sign in with their library card. Library staff sign in as administrator.';
  $('#signInError').hidden = true;
  $('#signUpError').hidden = true;
  if (signingUp) loadSignUpBranches();
  (signingUp ? $('#signUpForm input') : $('#signInIdentity')).focus();
}

async function startSession(nextRole, username, password) {
  setToken(await requestToken(nextRole, username, password));
  try {
    const profile = await request(`/${nextRole}/me`);
    const nextPortal = PORTALS[nextRole](profile, { rerender: renderActive });
    await nextPortal.load();
    role = nextRole;
    portal = nextPortal;
  } catch (error) {
    setToken(null);
    throw error;
  }
  applyRole();
  $('#authScreen').hidden = true;
  $('#appShell').hidden = false;
  switchView(portal.defaultView);
}

async function signIn(event) {
  event.preventDefault();
  const submit = $('#signInForm button[type="submit"]');
  submit.disabled = true;
  $('#signInError').hidden = true;
  try {
    await startSession($('#signInRole').value, $('#signInIdentity').value.trim(), $('#signInPassword').value);
    $('#signInPassword').value = '';
    toast(`Signed in as ${portal.profileName}.`);
  } catch (error) {
    showError('#signInError', error.status === 401 ? NOT_RECOGNISED : error.message);
  } finally {
    submit.disabled = false;
  }
}

async function signUp(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  $('#signUpError').hidden = true;
  try {
    const member = await request('/member/signup', {
      method: 'POST',
      body: {
        name: data.get('name').trim(), email: data.get('email').trim(), homeBranch: data.get('homeBranch'), password: data.get('password'),
      },
    });
    await startSession('member', member.cardNumber, data.get('password'));
    form.reset();
    toast(`Welcome, ${member.name}! Your library card number is ${member.cardNumber}.`);
  } catch (error) {
    showError('#signUpError', error.message);
  } finally {
    submit.disabled = false;
  }
}

function signOut(message = '') {
  role = null;
  portal = null;
  setToken(null);
  if (isModalOpen()) closeModal();
  setMenu(false);
  // The next person to sign in starts with no filters or searches.
  $$('.main-area select').forEach((select) => { select.selectedIndex = 0; });
  $$('.main-area input[type="search"]').forEach((input) => { input.value = ''; });
  $('#appShell').hidden = true;
  $('#authScreen').hidden = false;
  $('#signInForm').reset();
  showAuthForm('signin');
  updateSignInFields();
  if (message) showError('#signInError', message);
}

// ---------- App shell ----------

function applyRole() {
  $$('[data-role]').forEach((element) => {
    element.hidden = element.dataset.role !== role;
  });
  $('#profileName').textContent = portal.profileName;
  $('#profileRole').textContent = `${portal.roleLabel} · Sign out`;
  $('#profileAvatar').textContent = initials(portal.profileName);
  $('#profileButton').setAttribute('aria-label', `Sign out of ${portal.profileName}`);
  $('#roleLabel').textContent = portal.roleLabel;
}

function renderActive() {
  if (portal) portal.render(activeView);
}

function switchView(view) {
  const target = $(`#view-${view}`);
  if (!portal || !target || target.hidden) return;
  activeView = view;
  $$('.page-view').forEach((element) => element.classList.toggle('active', element === target));
  $$('.nav-item[data-view]').forEach((element) => {
    const isCurrent = element.dataset.view === view;
    element.classList.toggle('active', isCurrent);
    if (isCurrent) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  });
  $('#breadcrumbCurrent').textContent = VIEW_TITLES[view];
  setMenu(false);
  renderActive();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMenu(open) {
  $('#sidebar').classList.toggle('sidebar-open', open);
  document.body.classList.toggle('menu-open', open);
  $('#menuToggle').setAttribute('aria-expanded', String(open));
  $('#menuToggle').setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

function bindEvents() {
  $('#signInRole').addEventListener('change', updateSignInFields);
  $('#signInForm').addEventListener('submit', signIn);
  $('#signUpForm').addEventListener('submit', signUp);
  $('#profileButton').addEventListener('click', () => signOut());
  $('#signOutButton').addEventListener('click', () => signOut());
  onSessionExpired(() => signOut('Your session has expired. Please sign in again.'));

  document.addEventListener('click', (event) => {
    const authSwitch = event.target.closest('[data-auth]');
    if (authSwitch) showAuthForm(authSwitch.dataset.auth);
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) switchView(viewButton.dataset.view);
    const actionElement = event.target.closest('[data-action]');
    if (actionElement && portal) portal.handleAction(actionElement.dataset.action, actionElement);
    const branchElement = event.target.closest('[data-branch-open]');
    if (branchElement) {
      $('#globalBranch').value = branchElement.dataset.branchOpen;
      switchView('branches');
    }
    if (event.target.closest('[data-modal-cancel]')) closeModal();
  });

  [
    ['#globalBranch', 'change'], ['#catalogueSearch', 'input'], ['#catalogueBranch', 'change'],
    ['#catalogueAvailability', 'change'], ['#inventorySearch', 'input'], ['#loanStatus', 'change'],
    ['#loanSearch', 'input'], ['#memberPortalSearch', 'input'],
  ].forEach(([selector, eventName]) => $(selector).addEventListener(eventName, renderActive));

  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', (event) => {
    if (event.target === $('#modalBackdrop')) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    trapModalFocus(event);
    if (event.key !== 'Escape') return;
    if (isModalOpen()) closeModal();
    else if ($('#sidebar').classList.contains('sidebar-open')) {
      setMenu(false);
      $('#menuToggle').focus();
    }
  });
  $('#menuToggle').addEventListener('click', () => {
    const open = !$('#sidebar').classList.contains('sidebar-open');
    setMenu(open);
    if (open) $('.nav-item:not([hidden])')?.focus();
  });
  $('#sidebarScrim').addEventListener('click', () => setMenu(false));
  window.matchMedia('(max-width: 930px)').addEventListener('change', (event) => {
    if (!event.matches) setMenu(false);
  });
}

bindEvents();
updateSignInFields();
refreshIcons();
