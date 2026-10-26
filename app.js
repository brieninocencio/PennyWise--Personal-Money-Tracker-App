/* =============================================================
   PENNYWISE — UI LAYER (app.js)
   All money logic lives in store.js (window.PW). This file only
   renders pages and forwards user actions to the store.
   ============================================================= */
(function () {
  'use strict';
  const S = window.PW;
  S.migrate();

  /* ---------------- helpers ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '₱' + Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signedMoney = (n) => (n < 0 ? '-' : '') + money(n);
  const parseISO = (s) => new Date(s + 'T00:00:00');
  const dateShort = (s) => parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateLong = (s) => parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const firstName = () => (S.getUserName().trim().split(/\s+/)[0] || 'there');
  const greeting = () => { const h = new Date().getHours(); return `Good ${h < 5 || h >= 18 ? 'evening' : h < 12 ? 'morning' : 'afternoon'}, ${firstName()}!`; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    swap: '<path d="M17 4l4 4-4 4M3 8h18M7 20l-4-4 4-4M21 16H3"/>',
    list: '<path d="M9 12h6M9 16h6M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.6a1 1 0 0 1 .7.3l5.4 5.4a1 1 0 0 1 .3.7V19a2 2 0 0 1-2 2z"/>',
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4zM3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16.5" cy="14" r="1.2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    down: '<path d="M7 7l10 10M17 8v9H8"/>', up: '<path d="M7 17 17 7M8 7h9v9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    chev: '<path d="m9 6 6 6-6 6"/>', users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    hand: '<path d="M12 2v10M8 6v6M16 6v6M20 9v5a8 8 0 0 1-8 8h-1a8 8 0 0 1-6-3l-2-3a2 2 0 0 1 3-2l2 2V8"/>',
    bank: '<path d="M3 10 12 3l9 7M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>', card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>', check: '<path d="m5 12 5 5L20 7"/>', panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const ACC_ICON = { cash: 'cash', bank: 'bank', ewallet: 'phone', card: 'card' };

  const CAT_COLORS = { 'Essential Expenses': '#10b981', Food: '#16a34a', Transport: '#3b82f6', Bills: '#ef4444', Financial: '#d97706', Education: '#0d9488', 'Family Social': '#f59e0b', Entertainment: '#8b5cf6', Salary: '#059669', Others: '#6b7280' };
  const catColor = (c) => CAT_COLORS[c] || '#6b7280';

  /* ---------------- toast / modal / confirm ---------------- */
  function toast(msg, isErr) {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast' + (isErr ? ' err' : ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  const openModals = [];
  function openModal(opts) {
    const overlay = document.createElement('div'); overlay.className = 'overlay';
    overlay.innerHTML = `<div class="dialog ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
      <div class="dialog-head"><div><h2>${esc(opts.title)}</h2>${opts.sub ? `<p class="sub small">${esc(opts.sub)}</p>` : ''}</div>
      <button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div><div class="dialog-body"></div></div>`;
    const body = $('.dialog-body', overlay);
    const prevFocus = document.activeElement;
    const m = { el: overlay, body, live: !!opts.live };
    m.close = () => { const i = openModals.indexOf(m); if (i >= 0) openModals.splice(i, 1); overlay.remove(); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* gone */ } };
    m.refresh = () => opts.build(body, m);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) m.close(); });
    $('[data-close]', overlay).addEventListener('click', m.close);
    document.body.appendChild(overlay); openModals.push(m); opts.build(body, m);
    const first = $('input:not([type=hidden]):not([disabled]), select, button.btn', body); if (first && !opts.noFocus) first.focus();
    return m;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openModals.length) openModals[openModals.length - 1].close(); });
  document.addEventListener('pw:change', () => openModals.filter((m) => m.live).forEach((m) => m.refresh()));

  function confirmDialog({ title, message, confirmText, danger }) {
    return new Promise((resolve) => {
      let answered = false;
      const m = openModal({ title, noFocus: true, build(body, mm) {
        body.innerHTML = `<p class="muted" style="font-size:14px">${esc(message)}</p><div class="dialog-actions"><button type="button" class="btn secondary" data-no>Cancel</button><button type="button" class="btn ${danger ? 'danger' : ''}" data-yes>${esc(confirmText || 'Confirm')}</button></div>`;
        $('[data-no]', body).addEventListener('click', () => { answered = true; mm.close(); resolve(false); });
        $('[data-yes]', body).addEventListener('click', () => { answered = true; mm.close(); resolve(true); });
        $('[data-no]', body).focus();
      } });
      const orig = m.close; m.close = () => { orig(); if (!answered) resolve(false); };
      $('[data-close]', m.el).onclick = m.close;
    });
  }

  /** Prevents double submits: disables the submit button until the handler finishes. */
  function guarded(form, fn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); if (form.dataset.busy) return;
      form.dataset.busy = '1'; const btn = $('button[type=submit]', form); if (btn) btn.disabled = true;
      try { await fn(new FormData(form)); } finally { delete form.dataset.busy; if (btn && btn.isConnected) btn.disabled = false; }
    });
  }
  function showErr(form, msg) {
    let box = $('.form-error', form);
    if (!msg) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.className = 'form-error'; box.setAttribute('role', 'alert'); form.prepend(box); }
    box.textContent = msg;
  }
  const accountOptions = (selected, extra) => (extra || '') + S.getAccounts().map((a) => `<option value="${esc(a.id)}" ${a.id === selected ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
  const categoryOptions = (selected) => `<option value="">Select category</option>` + S.CATEGORIES.map((c) => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('');

  /* ---------------- shell ---------------- */
  const PAGES = { dashboard: ['Dashboard', 'index.html', 'home'], transactions: ['Transactions', 'transactions.html', 'swap'], listapay: ['ListaPay', 'listapay.html', 'list'], accounts: ['Accounts', 'accounts.html', 'wallet'] };
  let page = document.body.dataset.page;

  function buildShell() {
    const main = $('main#page'); const mainParent = main.parentNode;
    const app = document.createElement('div'); app.className = 'app';
    const navLinks = Object.entries(PAGES).map(([k, [label, href, ic]]) => `<a href="${href}" class="${k === page ? 'active' : ''}" ${k === page ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`).join('');
    app.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="brand"><div class="brand-mark">P</div><div class="brand-name">PennyWise</div></div>
        <div class="brand-tag">Better Money, Brighter Future.</div>
        <nav class="nav" aria-label="Main">${navLinks}<button type="button" data-settings>${icon('gear')}<span>Settings</span></button></nav>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="topbar-left">
            <button type="button" class="icon-btn collapse-btn" id="collapseBtn" aria-label="Collapse sidebar">${icon('panel')}</button>
            <span class="mobile-brand">PennyWise</span>
            <div class="crumbs">My workspace &nbsp;›&nbsp; <b>${PAGES[page][0]}</b></div>
          </div>
          <div class="topbar-right">
            <div class="menu-wrap"><button type="button" class="icon-btn" id="notifBtn" aria-label="Notifications" aria-haspopup="true">${icon('bell')}<span class="notif-dot" id="notifDot" hidden></span></button><div class="popover" id="notifPop" hidden></div></div>
            <div class="menu-wrap"><button type="button" class="user-pill" id="userBtn" aria-haspopup="true"><span class="avatar" id="avatar"></span><span class="uname" id="uname"></span></button>
              <div class="popover" id="userPop" hidden>
                <div class="ph"><strong id="popName"></strong><small>PennyWise Member</small></div>
                <button type="button" class="menu-item" data-act="name">${icon('edit')} Edit Name</button>
                <button type="button" class="menu-item" data-act="budget">${icon('target')} Set Monthly Budget</button>
                <button type="button" class="menu-item" data-act="demo">${icon('plus')} Load Sample Data</button>
                <button type="button" class="menu-item danger" data-act="reset">${icon('trash')} Reset Data</button>
              </div></div>
          </div>
        </header>
      </div>
      <nav class="bottom-nav" aria-label="Mobile">
        <a href="index.html" class="${page === 'dashboard' ? 'active' : ''}">${icon('home')}Home</a>
        <a href="transactions.html" class="${page === 'transactions' ? 'active' : ''}">${icon('swap')}Transactions</a>
        <a href="listapay.html" class="${page === 'listapay' ? 'active' : ''}">${icon('list')}ListaPay</a>
        <button type="button" id="moreBtn" class="${page === 'accounts' ? 'active' : ''}">${icon('dots')}More</button>
      </nav>`;
    mainParent.insertBefore(app, main); $('.main', app).appendChild(main);
    main.className = 'content';

    $('#collapseBtn').addEventListener('click', () => $('#sidebar').classList.toggle('collapsed'));
    $('[data-settings]').addEventListener('click', openSettings);
    $('#moreBtn').addEventListener('click', openMore);
    const pops = [['notifBtn', 'notifPop'], ['userBtn', 'userPop']];
    pops.forEach(([b, p]) => $('#' + b).addEventListener('click', (e) => { e.stopPropagation(); const el = $('#' + p); const was = el.hidden; pops.forEach(([, id]) => ($('#' + id).hidden = true)); el.hidden = !was; if (p === 'notifPop') renderNotifs(); }));
    document.addEventListener('click', (e) => pops.forEach(([, id]) => { const el = $('#' + id); if (!el.contains(e.target)) el.hidden = true; }));
    $('#userPop').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b) return; $('#userPop').hidden = true; menuAction(b.dataset.act); });
    updateProfile(); renderNotifs();
  }
  function menuAction(act) {
    if (act === 'name') openSettings(); else if (act === 'budget') openSettings('budget');
    else if (act === 'demo') confirmDialog({ title: 'Load sample data?', message: 'This replaces your current accounts, transactions and ListaPay entries with demo data. It cannot be undone.', confirmText: 'Replace with sample', danger: true }).then((y) => { if (y) { S.loadSampleData(); toast('Sample data loaded'); } });
    else if (act === 'reset') confirmDialog({ title: 'Reset all data?', message: 'This permanently deletes every account, transaction, ListaPay entry and your budget.', confirmText: 'Delete everything', danger: true }).then((y) => { if (y) { S.resetAll(); toast('All data reset'); } });
  }
  function openMore() {
    openModal({ title: 'More', noFocus: true, build(body, m) {
      body.innerHTML = `<div class="nav" style="color:var(--text)"><a href="accounts.html" style="color:var(--text)">${icon('wallet')}<span>Accounts</span></a><button type="button" data-a="settings" style="color:var(--text)">${icon('gear')}<span>Settings</span></button><button type="button" data-a="demo" style="color:var(--text)">${icon('plus')}<span>Load Sample Data</span></button><button type="button" data-a="reset" style="color:var(--expense)">${icon('trash')}<span>Reset Data</span></button></div>`;
      body.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; m.close(); if (b.dataset.a === 'settings') openSettings(); else menuAction(b.dataset.a); });
    } });
  }
  function updateProfile() {
    const n = S.getUserName(); $('#avatar').textContent = n.trim().charAt(0).toUpperCase() || 'B'; $('#uname').textContent = firstName(); $('#popName').textContent = n;
  }
  function renderNotifs() {
    const today = S.todayISO(); const soon = new Date(); soon.setDate(soon.getDate() + 3);
    const lim = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    const items = S.debtViews().filter((d) => d.outstanding > 0 && d.dueDate <= lim).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    $('#notifDot').hidden = !items.length;
    $('#notifPop').innerHTML = items.length ? items.slice(0, 5).map((d) => `<div class="notif-item"><strong>${esc(d.name)}</strong><small>${d.dueDate < today ? 'Overdue since ' : 'Due '}${dateShort(d.dueDate)} · ${money(d.outstanding)} ${d.direction === 'i-owe' ? 'to pay' : 'to collect'}</small></div>`).join('') : `<div class="notif-item"><strong>You're all caught up</strong><small>Nothing is due in the next 3 days.</small></div>`;
  }
  function openSettings(focus) {
    openModal({ title: 'Settings', sub: 'Your name and monthly budget.', noFocus: focus === 'budget', build(body, m) {
      body.innerHTML = `<form novalidate><div class="form-grid"><div class="field full"><label for="sName">Your name</label><input class="input" id="sName" name="name" maxlength="40" value="${esc(S.getUserName())}"></div>
        <div class="field full"><label for="sBudget">Monthly budget</label><div class="prefix"><span>₱</span><input class="input" id="sBudget" name="budget" type="number" min="0" step="0.01" inputmode="decimal" value="${S.getMonthlyBudget() || ''}" placeholder="0.00"></div></div></div>
        <div class="dialog-actions"><button type="button" class="btn secondary" data-close2>Cancel</button><button type="submit" class="btn">Save Settings</button></div></form>`;
      $('[data-close2]', body).onclick = m.close;
      const form = $('form', body); if (focus === 'budget') $('#sBudget').focus();
      guarded(form, (fd) => {
        const name = String(fd.get('name') || '').trim(); const b = String(fd.get('budget') || '').trim();
        if (!name) return showErr(form, 'Name can’t be empty.');
        if (b !== '' && !(parseFloat(b) >= 0)) return showErr(form, 'Enter a valid budget.');
        S.setUserName(name); S.setMonthlyBudget(b === '' ? 0 : b); m.close(); toast('Settings saved');
      });
    } });
  }

  /* ---------------- shared transaction form ---------------- */
  function txFormHTML(tx, submitLabel) {
    const type = tx ? tx.type : 'expense'; const accs = S.getAccounts();
    return `<form novalidate class="tx-form"><input type="hidden" name="type" value="${type}">
      <div class="field" style="margin-bottom:16px"><span class="label">Type</span><div class="seg" role="tablist">
        <button type="button" role="tab" class="t-expense" data-type="expense" aria-selected="${type === 'expense'}">${icon('up')} Expense</button>
        <button type="button" role="tab" class="t-income" data-type="income" aria-selected="${type === 'income'}">${icon('down')} Income</button>
        <button type="button" role="tab" data-type="transfer" aria-selected="${type === 'transfer'}">${icon('swap')} Transfer</button></div></div>
      <div class="form-grid">
        <div class="field full"><label for="f-amount">Amount</label><div class="prefix"><span>₱</span><input class="input" id="f-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00" value="${tx ? tx.amount : ''}" required></div></div>
        <div class="field"><label for="f-acc" data-l="acc">${type === 'transfer' ? 'From account' : 'Account'}</label><select class="input" id="f-acc" name="accountId">${accountOptions(tx ? tx.accountId : accs[0] && accs[0].id)}</select></div>
        <div class="field" data-for="transfer"><label for="f-to">To account</label><select class="input" id="f-to" name="toAccountId">${accountOptions(tx && tx.toAccountId || (accs[1] && accs[1].id))}</select></div>
        <div class="field" data-for="cat"><label for="f-cat">Category</label><select class="input" id="f-cat" name="category">${categoryOptions(tx && tx.category)}</select></div>
        <div class="field"><label for="f-date">Date</label><input class="input" id="f-date" name="date" type="date" value="${tx ? tx.date : S.todayISO()}" required></div>
        <div class="field full"><label for="f-desc">Description</label><input class="input" id="f-desc" name="description" maxlength="120" placeholder="Groceries, Salary, etc." value="${esc(tx ? tx.description : '')}"></div>
      </div>
      <button type="submit" class="btn block" style="margin-top:18px">${icon(tx ? 'check' : 'plus')} ${submitLabel}</button></form>`;
  }
  function bindTxForm(form, tx, onSaved) {
    const typeInput = $('[name=type]', form);
    const sync = () => {
      const t = typeInput.value;
      $$('.seg button', form).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.type === t)));
      $('[data-for=transfer]', form).hidden = t !== 'transfer'; $('[data-for=cat]', form).hidden = t === 'transfer';
      $('[data-l=acc]', form).textContent = t === 'transfer' ? 'From account' : 'Account';
      const to = $('#f-to', form); if (t === 'transfer' && to.value === $('#f-acc', form).value) { const other = Array.from(to.options).find((o) => o.value !== $('#f-acc', form).value); if (other) to.value = other.value; }
    };
    $$('.seg button', form).forEach((b) => b.addEventListener('click', () => { typeInput.value = b.dataset.type; showErr(form, ''); sync(); }));
    $('#f-acc', form).addEventListener('change', sync); sync();
    guarded(form, (fd) => {
      const input = Object.fromEntries(fd.entries());
      const res = tx ? S.updateTransaction(tx.id, input) : S.addTransaction(input);
      if (!res.ok) return showErr(form, res.error);
      showErr(form, ''); if (!tx) { form.querySelector('[name=amount]').value = ''; form.querySelector('[name=description]').value = ''; form.querySelector('[name=date]').value = S.todayISO(); }
      toast(tx ? 'Transaction updated' : 'Transaction added'); if (onSaved) onSaved(res.item);
    });
  }
  function openTxModal(tx) {
    openModal({ title: tx ? 'Edit Transaction' : 'Add Transaction', sub: tx ? 'Changes update your account balance automatically.' : 'Record income, an expense, or a transfer.', build(body, m) {
      body.innerHTML = txFormHTML(tx, tx ? 'Save Changes' : 'Add Transaction'); bindTxForm($('form', body), tx, m.close);
    } });
  }
  function txRowParts(t, accName) {
    const linked = !!t.link;
    const map = { income: ['down', '', 'pos', '+'], expense: ['up', 'expense', 'neg', '-'], transfer: ['swap', 'transfer', '', ''], lend: ['hand', 'debt', 'debt', '-'], repay: ['down', '', 'pos', '+'] };
    const [ic, cls, amtCls, sign] = map[t.type] || map.expense;
    const meta = t.type === 'transfer' ? `${esc(accName(t.accountId))} → ${esc(accName(t.toAccountId))}` : esc(t.category);
    return { ic, cls, amtCls, sign, meta, linked, label: t.description || (t.type === 'transfer' ? 'Transfer' : t.category) };
  }

  /* ---------------- DASHBOARD ---------------- */
  function renderDashboard(root) {
    const sum = S.monthSummary(); const accs = S.accountsWithBalances(); const budget = S.getMonthlyBudget(); const bal = S.totalBalance();
    const spent = sum.expense; const left = budget - spent;
    const cats = Object.entries(sum.categories).sort((a, b) => b[1] - a[1]);
    const accName = (id) => (accs.find((a) => a.id === id) || {}).name || 'Deleted account';
    const recent = S.getTransactions().slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
    root.innerHTML = `
      <div class="page-head"><div><h1>${esc(greeting())}</h1><p class="sub">Track your expenses, build better habits, reach your goals.</p></div></div>
      <section class="grid-4" aria-label="Summary">
        <a class="stat balance" href="accounts.html"><span class="ico">${icon('wallet')}</span><span class="lbl">Available Balance</span><span class="val ${bal < 0 ? 'neg' : ''}">${signedMoney(bal)}</span><span class="hint">Across ${plural(accs.length, 'account')}</span></a>
        <a class="stat income" href="transactions.html"><span class="ico">${icon('down')}</span><span class="lbl">Income this Month</span><span class="val">${money(sum.income)}</span><span class="hint">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span></a>
        <a class="stat expense" href="transactions.html"><span class="ico">${icon('up')}</span><span class="lbl">Expenses this Month</span><span class="val">${money(sum.expense)}</span><span class="hint">${cats.length ? `Top: ${esc(cats[0][0])}` : 'No expenses yet'}</span></a>
        <button type="button" class="stat budget" id="budgetCard"><span class="ico">${icon('target')}</span><span class="lbl">Monthly Budget</span><span class="val">${money(budget)}</span>
          ${budget > 0 ? `<span class="meter ${left < 0 ? 'over' : ''}"><i style="width:${Math.min(100, Math.round(spent / budget * 100))}%"></i></span><span class="hint">${left >= 0 ? `${money(left)} left` : `${money(-left)} over budget`}</span>` : '<span class="hint">Set a budget to get started</span>'}</button>
      </section>
      <section class="grid-2">
        <article class="card"><div class="card-head"><h2>Spending by Category</h2></div>
          <div class="donut-row"><div class="donut">${donutSVG(cats, sum.expense)}<div class="donut-center"><b>${money(sum.expense)}</b><span>Total Spent</span></div></div>
          <div class="cat-list">${catBars(cats, sum.expense)}</div></div>
          ${cats.length ? '' : `<p class="sub small" style="margin-top:16px">No expenses recorded yet this month. Start tracking your transactions to see your spending insights here.</p>`}
        </article>
        <article class="card"><div class="card-head"><h2>Recent Transactions</h2><a class="link-btn" href="transactions.html">View all</a></div>
          ${recent.length ? `<div class="recent-list">${recent.map((t) => { const p = txRowParts(t, accName); return `<div class="recent-row"><div class="tx-main"><span class="tx-ico ${p.cls}">${icon(p.ic)}</span><div style="min-width:0"><div class="tx-title">${esc(p.label)}</div><div class="tx-meta">${p.meta} · ${dateShort(t.date)}</div></div></div><span class="amount ${p.amtCls}">${p.sign}${money(t.amount)}</span></div>`; }).join('')}</div>`
            : `<div class="empty"><div class="ico">${icon('swap')}</div><strong>No transactions yet</strong>Add your first transaction to see it here.<div style="margin-top:14px"><a class="btn sm" href="transactions.html">${icon('plus')} Add Transaction</a></div></div>`}
        </article>
      </section>`;
    $('#budgetCard').addEventListener('click', () => openSettings('budget'));
  }
  function donutSVG(cats, total) {
    const r = 70, c = 2 * Math.PI * r; let off = 0;
    const segs = total > 0 ? cats.map(([n, v]) => { const len = v / total * c; const s = `<circle cx="84" cy="84" r="${r}" fill="none" stroke="${catColor(n)}" stroke-width="18" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}"><title>${esc(n)}: ${money(v)}</title></circle>`; off += len; return s; }).join('') : '';
    return `<svg viewBox="0 0 168 168" role="img" aria-label="Spending by category"><circle cx="84" cy="84" r="${r}" fill="none" stroke="#e8f0eb" stroke-width="18"/>${segs}</svg>`;
  }
  function catBars(cats, total) {
    const rows = cats.length ? cats : ['Essential Expenses', 'Financial', 'Education', 'Family Social'].map((n) => [n, 0]);
    return rows.map(([n, v]) => { const pct = total > 0 ? Math.round(v / total * 100) : 0; return `<div class="cat-item"><div class="top"><span><i class="dot" style="background:${catColor(n)}"></i>${esc(n)}</span><span class="muted">${cats.length ? money(v) + ' · ' : ''}${pct}%</span></div><div class="track"><i style="width:${pct}%;background:${catColor(n)}"></i></div></div>`; }).join('');
  }

  /* ---------------- TRANSACTIONS ---------------- */
  const txState = { q: '', type: 'all', account: '', category: '' };
  function renderTransactions(root, full) {
    if (full || !$('#txList', root)) {
      root.innerHTML = `
        <div class="page-head"><div><h1>Transactions</h1><p class="sub">Keep track of your income and expenses.</p></div></div>
        <section class="card" aria-labelledby="addTitle"><div class="card-head"><h2 id="addTitle">Add a Transaction</h2></div><div id="txFormMount"></div></section>
        <section class="card" aria-labelledby="histTitle"><div class="card-head"><h2 id="histTitle">Transaction History</h2></div>
          <div class="toolbar"><label class="search"><span class="sr-only">Search transactions</span>${icon('search')}<input class="input" id="txSearch" type="search" placeholder="Search transactions" value="${esc(txState.q)}"></label>
            <select class="input select-sm" id="txAcc" aria-label="Filter by account"></select><select class="input select-sm" id="txCat" aria-label="Filter by category"></select></div>
          <div class="chips" id="txChips" role="group" aria-label="Filter by type" style="margin-bottom:14px">${[['all', 'All'], ['income', 'Income'], ['expense', 'Expenses'], ['transfer', 'Transfers'], ['listapay', 'ListaPay']].map(([k, l]) => `<button type="button" class="chip" data-t="${k}" aria-pressed="${txState.type === k}">${l}</button>`).join('')}</div>
          <div id="txList"></div></section>`;
      $('#txFormMount').innerHTML = txFormHTML(null, 'Add Transaction'); bindTxForm($('#txFormMount form'));
      $('#txSearch').addEventListener('input', (e) => { txState.q = e.target.value; renderTxList(); });
      $('#txAcc').addEventListener('change', (e) => { txState.account = e.target.value; renderTxList(); });
      $('#txCat').addEventListener('change', (e) => { txState.category = e.target.value; renderTxList(); });
      $('#txChips').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; txState.type = b.dataset.t; $$('#txChips .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b))); renderTxList(); });
      $('#txList').addEventListener('click', onTxAction);
    }
    // keep filter selects and the add-form account lists in sync with accounts
    $('#txAcc').innerHTML = `<option value="">All accounts</option>` + accountOptions(txState.account);
    $('#txCat').innerHTML = `<option value="">All categories</option>` + S.CATEGORIES.concat(['Transfer', 'Loan Given', 'Loan Repayment']).map((c) => `<option ${c === txState.category ? 'selected' : ''}>${esc(c)}</option>`).join('');
    const form = $('#txFormMount form'); if (form) { [['#f-acc'], ['#f-to']].forEach(([s]) => { const sel = $(s, form); const cur = sel.value; sel.innerHTML = accountOptions(cur); if (!sel.value && sel.options.length) sel.selectedIndex = 0; }); }
    renderTxList();
  }
  function renderTxList() {
    const accs = S.getAccounts(); const accName = (id) => (accs.find((a) => a.id === id) || {}).name || 'Deleted account';
    const q = txState.q.trim().toLowerCase();
    const list = S.getTransactions().filter((t) => {
      if (txState.type === 'listapay' ? !t.link : txState.type !== 'all' && t.type !== txState.type) return false;
      if (txState.account && t.accountId !== txState.account && t.toAccountId !== txState.account) return false;
      if (txState.category && t.category !== txState.category) return false;
      if (q && !(`${t.description} ${t.category} ${accName(t.accountId)}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    const host = $('#txList'); const filtered = q || txState.account || txState.category || txState.type !== 'all';
    if (!list.length) { host.innerHTML = `<div class="empty"><div class="ico">${icon('swap')}</div><strong>${filtered ? 'No matching transactions' : 'No transactions yet'}</strong>${filtered ? 'Try a different search or filter.' : 'Your first transaction will show up here.'}</div>`; return; }
    host.innerHTML = `<table class="tx-table"><thead><tr><th>Description</th><th>Date</th><th>Category</th><th>Account</th><th class="r">Amount</th><th></th></tr></thead><tbody>${list.map((t) => {
      const p = txRowParts(t, accName);
      return `<tr><td data-l="desc"><div class="tx-main"><span class="tx-ico ${p.cls}">${icon(p.ic)}</span><div style="min-width:0"><div class="tx-title">${esc(p.label)}</div><div class="tx-meta">${p.meta} · ${dateShort(t.date)}</div></div></div></td>
        <td data-l="date">${dateLong(t.date)}</td><td data-l="cat">${p.linked ? '<span class="badge linked">ListaPay</span>' : `<span class="badge">${esc(t.category)}</span>`}</td><td data-l="acct">${esc(accName(t.accountId))}</td>
        <td class="r amount ${p.amtCls}">${p.sign}${money(t.amount)}</td>
        <td class="act"><div class="row-actions">${p.linked ? `<a class="icon-btn" href="listapay.html?open=${encodeURIComponent(t.link.debtId)}" aria-label="Open in ListaPay" title="Managed in ListaPay">${icon('list')}</a>` : `<button type="button" class="icon-btn" data-edit="${esc(t.id)}" aria-label="Edit transaction">${icon('edit')}</button>`}<button type="button" class="icon-btn danger" data-del="${esc(t.id)}" aria-label="Delete transaction">${icon('trash')}</button></div></td></tr>`;
    }).join('')}</tbody></table>`;
  }
  async function onTxAction(e) {
    const ed = e.target.closest('[data-edit]'); const del = e.target.closest('[data-del]');
    if (ed) { const t = S.getTransactions().find((x) => x.id === ed.dataset.edit); if (!t) return toast('That transaction no longer exists.', true); openTxModal(t); }
    if (del) {
      const t = S.getTransactions().find((x) => x.id === del.dataset.del); if (!t) return toast('That transaction no longer exists.', true);
      const msg = t.type === 'lend' ? 'This was money you lent out. The amount returns to the account and the loan stays in ListaPay, no longer taken from an account.'
        : t.link ? 'This is a ListaPay payment. Deleting it restores the balance owed and reverses the account change.' : 'The account balance will be adjusted to reverse this transaction.';
      if (!(await confirmDialog({ title: 'Delete transaction?', message: `${msg} This can’t be undone.`, confirmText: 'Delete', danger: true }))) return;
      const r = S.deleteTransaction(t.id); toast(r.ok ? 'Transaction deleted' : r.error, !r.ok);
    }
  }

  /* ---------------- LISTAPAY ---------------- */
  const lpState = { q: '', filter: 'all' };
  const lpIcon = (d) => d.kind === 'group' ? `<span class="lp-av sq">${icon('users')}</span>` : d.kind === 'bill' ? `<span class="lp-av bill">${icon('bolt')}</span>` : `<span class="lp-av">${esc(d.name.charAt(0).toUpperCase())}</span>`;
  function statusBadge(d) { return { paid: '<span class="badge">Paid</span>', overdue: '<span class="badge bad">Overdue</span>', partial: '<span class="badge warn">Partial</span>', unpaid: '' }[d.status]; }
  function renderListaPay(root, full) {
    if (full || !$('#lpBody', root)) {
      root.innerHTML = `<div class="page-head"><div><h1>ListaPay</h1><p class="sub">Keep tabs on utang and bills — walang tatakas sa lista.</p></div><button type="button" class="btn" id="lpAdd">${icon('plus')} Add Entry</button></div>
        <div class="lp-sum" id="lpSum"></div>
        <div class="toolbar"><label class="search"><span class="sr-only">Search by name or group</span>${icon('search')}<input class="input" id="lpSearch" type="search" placeholder="Search by name or group" value="${esc(lpState.q)}"></label>
          <div class="chips" id="lpChips" role="group" aria-label="Filter">${[['all', 'All'], ['person', 'People'], ['group', 'Groups'], ['bill', 'Bills']].map(([k, l]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${lpState.filter === k}">${l}</button>`).join('')}</div></div>
        <div id="lpBody"></div>`;
      $('#lpAdd').addEventListener('click', () => openEntryModal());
      $('#lpSearch').addEventListener('input', (e) => { lpState.q = e.target.value; renderLpBody(); });
      $('#lpChips').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; lpState.filter = b.dataset.f; $$('#lpChips .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b))); renderLpBody(); });
      $('#lpBody').addEventListener('click', (e) => { const c = e.target.closest('[data-id]'); if (c) openDetail(c.dataset.id); });
    }
    renderLpBody();
  }
  function renderLpBody() {
    const all = S.debtViews(); const q = lpState.q.trim().toLowerCase();
    const sum = (arr) => arr.reduce((s, d) => s + S.toCents(d.outstanding), 0) / 100;
    $('#lpSum').innerHTML = `<div class="card"><div class="k">To collect</div><div class="v pos">${money(sum(all.filter((d) => d.direction === 'owed-to-me')))}</div></div><div class="card"><div class="k">Bills to pay</div><div class="v debt">${money(sum(all.filter((d) => d.direction === 'i-owe')))}</div></div><div class="card"><div class="k">Overdue</div><div class="v ${all.some((d) => d.status === 'overdue') ? 'neg' : ''}">${all.filter((d) => d.status === 'overdue').length}</div></div>`;
    const match = (d) => (lpState.filter === 'all' || d.kind === lpState.filter) && (!q || `${d.name} ${d.note} ${(d.members || []).map((m) => m.name).join(' ')}`.toLowerCase().includes(q));
    const order = (a, b) => (a.status === 'paid') - (b.status === 'paid') || a.dueDate.localeCompare(b.dueDate);
    const sections = [['person', 'Individual Debtors'], ['group', 'Group Debtors'], ['bill', 'Bills / Utilities']];
    const html = sections.map(([k, label]) => { const items = all.filter((d) => d.kind === k && match(d)).sort(order); if (!items.length) return '';
      return `<div class="section-title">${label} <span class="count-pill">${items.length}</span></div><div class="lp-grid">${items.map(lpCard).join('')}</div>`; }).join('');
    $('#lpBody').innerHTML = html || `<div class="card"><div class="empty"><div class="ico">${icon('list')}</div><strong>${all.length ? 'No matching entries' : 'No entries yet'}</strong>${all.length ? 'Try a different search or filter.' : 'Add a person, group or bill to start your lista.'}</div></div>`;
  }
  function lpCard(d) {
    const sub = d.kind === 'group' ? `${plural(d.members.length, 'member')} • ${money(d.amount)} total` : '';
    const due = d.status === 'paid' ? 'Settled' : `${d.status === 'overdue' ? '<span class="late">Overdue · ' : '<span>'}Due ${dateShort(d.dueDate)}</span>`;
    return `<button type="button" class="lp-card ${d.status === 'paid' ? 'paid' : ''}" data-id="${esc(d.id)}">${lpIcon(d)}<div class="lp-body"><div class="lp-name">${esc(d.name)}</div><div class="lp-amt ${d.direction === 'i-owe' ? 'debt' : ''}">${money(d.outstanding)}</div>
      <div class="lp-sub">${sub ? `<span>${esc(sub)}</span>` : ''}${due}${d.status === 'partial' ? `<span>of ${money(d.amount)}</span>` : ''}</div></div>${statusBadge(d)}<span class="lp-chev">${icon('chev')}</span></button>`;
  }

  function memberRowHTML(m) { return `<div class="member-row" data-mid="${esc(m.id || '')}"><input class="input" placeholder="Member name" aria-label="Member name" maxlength="40" value="${esc(m.name || '')}"><div class="prefix"><span>₱</span><input class="input" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" aria-label="Member amount" value="${m.amount || ''}"></div><button type="button" class="icon-btn danger" data-rm aria-label="Remove member">${icon('x')}</button></div>`; }
  function openEntryModal(debt) {
    openModal({ title: debt ? 'Edit Entry' : 'Add Entry', sub: debt ? 'Changes update linked balances and history.' : 'Keep tabs on utang and bills.', wide: true, build(body, m) {
      let kind = debt ? debt.kind : 'person';
      const vals = debt ? { name: debt.name, amount: debt.kind === 'group' ? '' : debt.amount, dueDate: debt.dueDate, note: debt.note, accountId: debt.accountId || '', members: (debt.members || []).map((x) => ({ ...x })) }
        : { name: '', amount: '', dueDate: S.todayISO(), note: '', accountId: S.getAccounts()[0].id, members: [{ name: '', amount: '' }, { name: '', amount: '' }] };
      body.innerHTML = `<form novalidate><div class="seg" role="tablist" style="margin-bottom:16px">${[['person', 'Person', 'users'], ['group', 'Group', 'users'], ['bill', 'Bill', 'bolt']].map(([k, l, ic]) => `<button type="button" role="tab" data-kind="${k}" ${debt ? 'disabled' : ''}>${icon(ic)} ${l}</button>`).join('')}</div><div id="entryFields"></div>
        <div class="dialog-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn">${icon(debt ? 'check' : 'plus')} ${debt ? 'Save Changes' : 'Add Entry'}</button></div></form>`;
      const form = $('form', body);
      const capture = () => { const f = $('#entryFields', form); if (!f || !f.children.length) return; const g = (n) => { const e = f.querySelector(`[name=${n}]`); return e ? e.value : undefined; };
        ['name', 'amount', 'dueDate', 'note', 'accountId'].forEach((n) => { const v = g(n); if (v !== undefined) vals[n] = v; });
        const rows = $$('.member-row', f); if (rows.length) vals.members = rows.map((r) => ({ id: r.dataset.mid || undefined, name: $('input', r).value, amount: $$('input', r)[1].value })); };
      const draw = () => {
        $$('.seg button', form).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.kind === kind)));
        const lend = kind !== 'bill'; const total = vals.members.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        $('#entryFields', form).innerHTML = `<div class="form-grid">
          <div class="field full"><label for="e-name">${kind === 'person' ? 'Name' : kind === 'group' ? 'Group name' : 'Bill name'}</label><input class="input" id="e-name" name="name" maxlength="60" value="${esc(vals.name)}" placeholder="${kind === 'bill' ? 'e.g., Electricity Bill' : kind === 'group' ? 'e.g., Barkada Group' : 'e.g., Juan Dela Cruz'}"></div>
          ${kind === 'group' ? `<div class="field full"><span class="label">Members & amounts owed</span><div id="members">${vals.members.map(memberRowHTML).join('')}</div><div style="display:flex;justify-content:space-between;align-items:center"><button type="button" class="link-btn" id="addMember">+ Add member</button><span class="hint-text">Total <b id="memTotal">${money(total)}</b></span></div></div>`
            : `<div class="field"><label for="e-amt">Amount</label><div class="prefix"><span>₱</span><input class="input" id="e-amt" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" value="${esc(vals.amount)}"></div></div>`}
          <div class="field ${kind === 'group' ? '' : ''}"><label for="e-due">Due date</label><input class="input" id="e-due" name="dueDate" type="date" value="${esc(vals.dueDate)}"></div>
          ${lend ? `<div class="field ${kind === 'group' ? '' : 'full'}"><label for="e-acc">Money lent from</label><select class="input" id="e-acc" name="accountId">${accountOptions(vals.accountId, `<option value="">Don’t deduct from an account</option>`)}</select><span class="hint-text">Deducts the amount from this account now and links the loan to it.</span></div>` : ''}
          <div class="field full"><label for="e-note">Note (optional)</label><input class="input" id="e-note" name="note" maxlength="120" value="${esc(vals.note)}" placeholder="Add a note about this entry"></div></div>`;
      };
      draw();
      $('.seg', form).addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (!b || b.disabled) return; capture(); kind = b.dataset.kind; showErr(form, ''); draw(); });
      form.addEventListener('click', (e) => {
        if (e.target.closest('#addMember')) { capture(); vals.members.push({ name: '', amount: '' }); draw(); const r = $$('.member-row input', form); r[r.length - 2].focus(); }
        const rm = e.target.closest('[data-rm]'); if (rm) { capture(); const idx = $$('.member-row', form).indexOf(rm.closest('.member-row')); const mm = vals.members[idx];
          if (mm && mm.id && debt && S.getPayments().some((p) => p.debtId === debt.id && p.memberId === mm.id)) return showErr(form, 'This member has recorded payments. Delete those payments first.');
          vals.members.splice(idx, 1); draw(); }
      });
      form.addEventListener('input', (e) => { if (e.target.closest('.member-row')) { const t = $$('.member-row', form).reduce((s, r) => s + (parseFloat($$('input', r)[1].value) || 0), 0); $('#memTotal', form).textContent = money(t); } });
      $('[data-cancel]', form).onclick = m.close;
      guarded(form, () => {
        capture(); const input = { kind, name: vals.name, amount: vals.amount, dueDate: vals.dueDate, note: vals.note, accountId: vals.accountId || null, members: vals.members };
        const res = debt ? S.updateDebt(debt.id, input) : S.addDebt(input);
        if (!res.ok) return showErr(form, res.error);
        m.close(); toast(debt ? 'Entry updated' : 'Entry added');
      });
    } });
  }

  function openDetail(id) {
    const exists = S.getDebts().some((d) => d.id === id); if (!exists) return;
    openModal({ title: 'Entry details', wide: true, live: true, noFocus: true, build(body, m) {
      const raw = S.getDebts().find((d) => d.id === id);
      if (!raw) { m.close(); return; }
      const d = S.debtView(raw); const bill = d.direction === 'i-owe'; const accs = S.getAccounts();
      const accName = (aid) => (accs.find((a) => a.id === aid) || {}).name;
      $('.dialog-head h2', m.el).textContent = d.name;
      body.innerHTML = `<div style="display:flex;gap:8px;align-items:center;margin:-8px 0 12px"><span class="badge gray">${d.kind === 'group' ? 'Group' : bill ? 'Bill' : 'Person'}</span>${statusBadge(d)}<span class="small muted">Due ${dateLong(d.dueDate)}</span></div>
        <div class="detail-top"><div><div class="k">${bill ? 'Bill' : 'Lent'}</div><div class="v">${money(d.amount)}</div></div><div><div class="k">${bill ? 'Paid' : 'Received'}</div><div class="v pos">${money(d.paid)}</div></div><div><div class="k">Outstanding</div><div class="v ${bill ? 'debt' : ''}">${money(d.outstanding)}</div></div></div>
        ${d.note ? `<p class="small muted" style="margin-bottom:12px">${esc(d.note)}</p>` : ''}
        ${!bill ? `<p class="small muted" style="margin-bottom:12px">${d.accountId && accName(d.accountId) ? `Lent from ${esc(accName(d.accountId))}.` : 'Not recorded against an account.'}</p>` : ''}
        ${d.kind === 'group' ? `<h3 style="margin-bottom:8px">Members</h3><div class="mini-list">${d.members.map((x) => `<div class="mini-row"><div class="l"><div>${esc(x.name)}</div><div class="tx-meta">${money(x.paid)} of ${money(x.amount)}</div></div>${x.outstanding > 0 ? `<button type="button" class="btn sm" data-pay-member="${esc(x.id)}">${bill ? 'Pay' : 'Record'} ${money(x.outstanding)}</button>` : '<span class="badge">Paid</span>'}</div>`).join('')}</div>` : ''}
        <h3 style="margin-bottom:8px">Payments</h3>
        ${d.payments.length ? `<div class="mini-list">${d.payments.slice().sort((a, b) => b.date.localeCompare(a.date)).map((p) => { const who = p.memberId ? (d.members.find((x) => x.id === p.memberId) || {}).name : ''; return `<div class="mini-row"><div class="l"><div>${money(p.amount)}${who ? ` · ${esc(who)}` : ''}</div><div class="tx-meta">${dateLong(p.date)} · ${p.accountId && accName(p.accountId) ? esc(accName(p.accountId)) : 'No account'}${p.note ? ` · ${esc(p.note)}` : ''}</div></div><div class="row-actions"><button type="button" class="icon-btn" data-edit-pay="${esc(p.id)}" aria-label="Edit payment">${icon('edit')}</button><button type="button" class="icon-btn danger" data-del-pay="${esc(p.id)}" aria-label="Delete payment">${icon('trash')}</button></div></div>`; }).join('')}</div>` : '<p class="small muted" style="margin-bottom:14px">No payments recorded yet.</p>'}
        <div class="dialog-actions" style="flex-wrap:wrap"><button type="button" class="btn secondary" data-edit-entry>${icon('edit')} Edit</button><button type="button" class="btn secondary" data-del-entry style="color:var(--expense)">${icon('trash')} Delete</button>${d.kind !== 'group' && d.outstanding > 0 ? `<button type="button" class="btn" data-pay>${icon('plus')} ${bill ? 'Pay bill' : 'Record payment'}</button>` : ''}</div>`;
      body.onclick = async (e) => {
        const t = e.target; const cur = S.getDebts().find((x) => x.id === id); if (!cur) return;
        if (t.closest('[data-edit-entry]')) return openEntryModal(S.debtView(cur));
        if (t.closest('[data-pay]')) return openPaymentModal(id);
        const pm = t.closest('[data-pay-member]'); if (pm) return openPaymentModal(id, null, pm.dataset.payMember);
        const ep = t.closest('[data-edit-pay]'); if (ep) return openPaymentModal(id, ep.dataset.editPay);
        const dp = t.closest('[data-del-pay]'); if (dp) { if (await confirmDialog({ title: 'Delete payment?', message: 'The amount owed goes back up and the linked account change is reversed.', confirmText: 'Delete', danger: true })) { const r = S.deletePayment(dp.dataset.delPay); toast(r.ok ? 'Payment deleted' : r.error, !r.ok); } return; }
        if (t.closest('[data-del-entry]')) { const v = S.debtView(cur); const extra = v.payments.length || cur.lendTxId ? ' Its payments and linked transactions are removed and the account balances are restored.' : '';
          if (await confirmDialog({ title: `Delete ${cur.name}?`, message: `This removes the entry.${extra} This can’t be undone.`, confirmText: 'Delete entry', danger: true })) { const r = S.deleteDebt(id); if (r.ok) { m.close(); toast('Entry deleted'); } else toast(r.error, true); } }
      };
    } });
  }

  function openPaymentModal(debtId, paymentId, memberId) {
    const raw = S.getDebts().find((d) => d.id === debtId); if (!raw) return;
    const existing = paymentId ? S.getPayments().find((p) => p.id === paymentId) : null; if (paymentId && !existing) return toast('That payment no longer exists.', true);
    const bill = raw.direction === 'i-owe';
    openModal({ title: existing ? 'Edit Payment' : bill ? 'Pay Bill' : 'Record Payment', sub: raw.name, build(body, m) {
      const d = S.debtView(raw); const mid = existing ? existing.memberId : memberId;
      const room = () => { const sel = $('[name=memberId]', body); return S.paymentRoom(raw, sel ? sel.value : mid, existing && existing.id) / 100; };
      const defAcc = existing ? (existing.accountId || '') : S.getAccounts()[0].id;
      body.innerHTML = `<form novalidate><div class="form-grid">
        ${raw.kind === 'group' ? `<div class="field full"><label for="p-m">Who paid?</label><select class="input" id="p-m" name="memberId" ${existing ? 'disabled' : ''}>${d.members.map((x) => `<option value="${esc(x.id)}" ${x.id === mid ? 'selected' : ''}>${esc(x.name)}${x.outstanding > 0 ? ` — ${money(x.outstanding)} left` : ' — paid'}</option>`).join('')}</select></div>` : ''}
        <div class="field full"><label for="p-amt">Amount</label><div class="prefix"><span>₱</span><input class="input" id="p-amt" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" value="${existing ? existing.amount : ''}"></div><span class="hint-text">Remaining: <b id="pRoom"></b> · <button type="button" class="link-btn" id="payFull">Pay in full</button></span></div>
        <div class="field"><label for="p-date">Date</label><input class="input" id="p-date" name="date" type="date" value="${existing ? existing.date : S.todayISO()}"></div>
        <div class="field"><label for="p-acc">${bill ? 'Paid from' : 'Received into'}</label><select class="input" id="p-acc" name="accountId">${accountOptions(defAcc, `<option value="">Don’t record in an account</option>`)}</select></div>
        <div class="field full"><label for="p-note">Note (optional)</label><input class="input" id="p-note" name="note" maxlength="120" value="${esc(existing ? existing.note : '')}"></div></div>
        <div class="dialog-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn">${icon('check')} ${existing ? 'Save Changes' : bill ? 'Pay' : 'Record Payment'}</button></div></form>`;
      const form = $('form', body); const roomEl = $('#pRoom', body);
      const upd = () => { roomEl.textContent = money(room()); }; upd();
      $('[name=memberId]', body) && $('[name=memberId]', body).addEventListener('change', () => { upd(); $('#p-amt', body).value = ''; });
      $('#payFull', body).addEventListener('click', () => { $('#p-amt', body).value = room().toFixed(2); });
      if (!existing) { const r = room(); if (r > 0) $('#p-amt', body).value = r.toFixed(2); }
      $('[data-cancel]', body).onclick = m.close;
      guarded(form, (fd) => {
        const input = Object.fromEntries(fd.entries()); if (existing) input.memberId = existing.memberId;
        const res = existing ? S.updatePayment(existing.id, input) : S.addPayment(debtId, input);
        if (!res.ok) return showErr(form, res.error);
        m.close(); toast(existing ? 'Payment updated' : 'Payment recorded');
      });
    } });
  }

  /* ---------------- ACCOUNTS ---------------- */
  function renderAccounts(root) {
    const accs = S.accountsWithBalances(); const total = S.totalBalance();
    root.innerHTML = `<div class="page-head"><div><h1>Accounts</h1><p class="sub">Cash, banks, e-wallets and cards. Balances are always calculated from your transactions.</p></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn secondary" id="accTransfer" ${accs.length < 2 ? 'disabled title="Add a second account to transfer"' : ''}>${icon('swap')} Transfer</button><button type="button" class="btn" id="accAdd">${icon('plus')} Add Account</button></div></div>
      <div class="total-card"><div class="k">Total balance</div><div class="v">${signedMoney(total)}</div></div>
      <div class="acc-grid">${accs.map((a) => `<article class="acc-card"><div class="top"><span class="tx-ico">${icon(ACC_ICON[a.type] || 'wallet')}</span><div class="row-actions"><button type="button" class="icon-btn" data-edit="${esc(a.id)}" aria-label="Edit ${esc(a.name)}">${icon('edit')}</button><button type="button" class="icon-btn danger" data-del="${esc(a.id)}" aria-label="Delete ${esc(a.name)}">${icon('trash')}</button></div></div>
        <div class="lp-name" style="margin-top:6px">${esc(a.name)}</div><div class="amount ${a.balance < 0 ? 'neg' : ''}" style="font-size:22px;font-weight:700">${signedMoney(a.balance)}</div><div class="tx-meta">${S.ACCOUNT_TYPES[a.type]} · ${plural(a.txCount, 'transaction')}</div></article>`).join('')}</div>`;
    $('#accAdd').addEventListener('click', () => openAccountModal());
    $('#accTransfer').addEventListener('click', () => { openModal({ title: 'Transfer between accounts', sub: 'Moves money without counting as income or expense.', build(body, m) { const accsL = S.getAccounts(); body.innerHTML = txFormHTML({ type: 'transfer', amount: '', accountId: accsL[0].id, toAccountId: accsL[1].id, date: S.todayISO(), description: '' }, 'Transfer'); $('.seg', body).closest('.field').hidden = true; bindTxForm($('form', body), null, m.close); } }); });
    $('.acc-grid', root).addEventListener('click', (e) => {
      const ed = e.target.closest('[data-edit]'); const del = e.target.closest('[data-del]');
      if (ed) { const a = S.getAccounts().find((x) => x.id === ed.dataset.edit); if (a) openAccountModal(a); }
      if (del) openDeleteAccount(del.dataset.del);
    });
  }
  function openAccountModal(acc) {
    openModal({ title: acc ? 'Edit Account' : 'Add Account', sub: acc ? 'Changing the starting balance changes the current balance by the same amount.' : 'Where does your money live?', build(body, m) {
      body.innerHTML = `<form novalidate><div class="form-grid"><div class="field full"><label for="a-name">Account name</label><input class="input" id="a-name" name="name" maxlength="40" placeholder="e.g., GCash, BDO Savings" value="${esc(acc ? acc.name : '')}"></div>
        <div class="field"><label for="a-type">Type</label><select class="input" id="a-type" name="type">${Object.entries(S.ACCOUNT_TYPES).map(([k, l]) => `<option value="${k}" ${acc && acc.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="a-bal">${acc ? 'Starting balance' : 'Current balance'}</label><div class="prefix"><span>₱</span><input class="input" id="a-bal" name="openingBalance" type="number" step="0.01" inputmode="decimal" placeholder="0.00" value="${acc ? acc.openingBalance : ''}"></div></div></div>
        <div class="dialog-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn">${icon(acc ? 'check' : 'plus')} ${acc ? 'Save Changes' : 'Add Account'}</button></div></form>`;
      $('[data-cancel]', body).onclick = m.close; const form = $('form', body);
      guarded(form, (fd) => { const input = Object.fromEntries(fd.entries()); const res = acc ? S.updateAccount(acc.id, input) : S.addAccount(input); if (!res.ok) return showErr(form, res.error); m.close(); toast(acc ? 'Account updated' : 'Account added'); });
    } });
  }
  function openDeleteAccount(id) {
    const a = S.accountsWithBalances().find((x) => x.id === id); if (!a) return;
    const others = S.getAccounts().filter((x) => x.id !== id);
    if (!others.length) return toast('You need at least one account.', true);
    openModal({ title: `Delete ${a.name}?`, build(body, m) {
      body.innerHTML = `<form novalidate><p class="muted" style="font-size:14px;margin-bottom:14px">${a.txCount ? `${esc(a.name)} has ${plural(a.txCount, 'transaction')}. They move to the account you choose so your total stays ${money(S.totalBalance())}.` : `${esc(a.name)} has no transactions. Its ${money(a.balance)} will be removed from your total.`}</p>
        ${a.txCount ? `<div class="field"><label for="mv">Move history to</label><select class="input" id="mv" name="moveTo">${others.map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select></div>` : ''}
        <div class="dialog-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn danger">Delete account</button></div></form>`;
      $('[data-cancel]', body).onclick = m.close; const form = $('form', body);
      guarded(form, (fd) => { const res = S.deleteAccount(id, fd.get('moveTo')); if (!res.ok) return showErr(form, res.error); m.close(); toast('Account deleted'); });
    } });
  }

  /* ---------------- boot ---------------- */
  const RENDER = {
    dashboard: (full) => renderDashboard($('#page')),
    transactions: (full) => renderTransactions($('#page'), full),
    listapay: (full) => renderListaPay($('#page'), full),
    accounts: (full) => renderAccounts($('#page')),
  };
  function refresh(full) { updateProfile(); renderNotifs(); RENDER[page](full); }
  document.addEventListener('DOMContentLoaded', () => {
    buildShell(); RENDER[page](true);
    document.addEventListener('pw:change', () => refresh(false));
    window.addEventListener('storage', (e) => { if (e.key && e.key.indexOf('financeApp_') === 0) { S.migrate(); refresh(true); openModals.slice().forEach((m) => (m.live ? m.refresh() : m.close())); } });
    if (page === 'listapay') { const open = new URLSearchParams(location.search).get('open'); if (open) openDetail(open); }
  });
})();
