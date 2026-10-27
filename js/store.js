/* =============================================================
   PENNYWISE — DATA & ACCOUNTING LAYER (store.js)
   Single source of truth. Balances are NEVER stored; they are
   derived from: account opening balance + every transaction.

   Records (localStorage):
     financeApp_accounts      [{id,name,type,openingBalance}]
     financeApp_transactions  [{id,type,amount,category,date,description,
                                accountId,toAccountId?,link?}]
        type: income | expense | transfer | lend | repay
        link: {debtId,paymentId?}  -> owned by a ListaPay record
     financeApp_listapay      [{id,kind,direction,name,amount,dueDate,date,
                                note,members?,accountId,lendTxId}]
        kind: person | group | bill
     financeApp_payments      [{id,debtId,memberId?,amount,date,accountId,txId,note}]
   ============================================================= */
(function (root) {
  'use strict';

  const KEYS = {
    NAME: 'financeApp_userName',
    TRANSACTIONS: 'financeApp_transactions',
    LISTAPAY: 'financeApp_listapay',
    BUDGET: 'financeApp_monthlyBudget',
    ACCOUNTS: 'financeApp_accounts',
    PAYMENTS: 'financeApp_payments',
    SCHEMA: 'financeApp_schema',
  };
  const SCHEMA_VERSION = 2;
  const DEFAULT_ACCOUNT_ID = 'acc-cash';
  const MAX_AMOUNT = 1e12;

  const CATEGORIES = ['Food', 'Transport', 'Bills', 'Entertainment', 'Essential Expenses',
    'Financial', 'Education', 'Family Social', 'Salary', 'Others'];
  const ACCOUNT_TYPES = { cash: 'Cash', bank: 'Bank', ewallet: 'E-Wallet', card: 'Card' };

  /* ---------- low-level storage (never destroys unreadable data) ---------- */
  function ls() { return root.localStorage; }

  const warned = {};
  function readList(key) {
    const raw = ls().getItem(key);
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === 'object') : [];
    } catch (err) {
      // Keep a copy of the unreadable payload instead of silently losing it.
      try { if (ls().getItem(key + '_corrupt') === null) ls().setItem(key + '_corrupt', raw); } catch (e) { /* ignore */ }
      if (!warned[key]) { warned[key] = true; console.warn('Unreadable data in ' + key + ' (a copy was kept as ' + key + '_corrupt)', err); }
      return [];
    }
  }
  function writeList(key, list) { ls().setItem(key, JSON.stringify(list)); }
  function notify() {
    if (root.document && typeof root.CustomEvent === 'function') root.document.dispatchEvent(new root.CustomEvent('pw:change'));
  }

  /* ---------- utilities ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00');
    return !isNaN(d) && `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === s;
  }
  function generateId() { return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  const toCents = (n) => Math.round((Number(n) + Number.EPSILON) * 100);
  const fromCents = (c) => c / 100;
  const round2 = (n) => fromCents(toCents(n));
  function parseAmount(v) {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    if (!isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
    return round2(n);
  }
  const clean = (s, max) => String(s == null ? '' : s).trim().slice(0, max || 120);
  const fail = (error) => ({ ok: false, error });
  const ok = (extra) => Object.assign({ ok: true }, extra);

  /* ---------- raw getters/setters ---------- */
  const getAccounts = () => readList(KEYS.ACCOUNTS);
  const getTransactions = () => readList(KEYS.TRANSACTIONS);
  const getDebts = () => readList(KEYS.LISTAPAY);
  const getPayments = () => readList(KEYS.PAYMENTS);
  const saveAccounts = (l) => writeList(KEYS.ACCOUNTS, l);
  const saveTransactions = (l) => writeList(KEYS.TRANSACTIONS, l);
  const saveDebts = (l) => writeList(KEYS.LISTAPAY, l);
  const savePayments = (l) => writeList(KEYS.PAYMENTS, l);

  function getUserName() { return ls().getItem(KEYS.NAME) || 'Brien Inocencio'; }
  function setUserName(n) { ls().setItem(KEYS.NAME, clean(n, 40)); notify(); }
  function getMonthlyBudget() { const v = parseFloat(ls().getItem(KEYS.BUDGET)); return isFinite(v) && v >= 0 ? v : 0; }
  function setMonthlyBudget(a) { const v = parseFloat(a); ls().setItem(KEYS.BUDGET, String(isFinite(v) && v >= 0 ? round2(v) : 0)); notify(); }

  /* ---------- migration: safe, idempotent, never deletes user records ---------- */
  function migrate() {
    if (parseInt(ls().getItem(KEYS.SCHEMA), 10) >= SCHEMA_VERSION) return;

    let accounts = getAccounts();
    if (!accounts.length) {
      accounts = [{ id: DEFAULT_ACCOUNT_ID, name: 'Cash', type: 'cash', openingBalance: 0 }];
    }
    const defaultId = accounts[0].id;
    const accIds = new Set(accounts.map((a) => a.id));

    const txs = getTransactions().map((t) => {
      const amount = parseFloat(t.amount);
      return {
        id: t.id || generateId(),
        type: ['income', 'expense', 'transfer', 'lend', 'repay'].includes(t.type) ? t.type : 'expense',
        amount: isFinite(amount) && amount > 0 ? round2(amount) : 0,
        category: t.category || 'Others',
        date: isValidDate(t.date) ? t.date : todayISO(),
        description: t.description || '',
        accountId: accIds.has(t.accountId) ? t.accountId : defaultId,
        createdAt: t.createdAt || Date.now(),
      };
    });

    const payments = getPayments();
    const debts = getDebts().map((d) => {
      const direction = d.direction === 'i-owe' ? 'i-owe' : 'owed-to-me';
      const amount = parseFloat(d.amount);
      const entry = {
        id: d.id || generateId(),
        kind: ['person', 'group', 'bill'].includes(d.kind) ? d.kind : (direction === 'i-owe' ? 'bill' : 'person'),
        direction,
        name: d.name || 'Unnamed',
        amount: isFinite(amount) && amount > 0 ? round2(amount) : 0,
        dueDate: isValidDate(d.dueDate) ? d.dueDate : todayISO(),
        date: isValidDate(d.date) ? d.date : (d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : todayISO()),
        note: d.note || '',
        accountId: null, // legacy entries never touched an account; keep balances unchanged
        lendTxId: null,
        createdAt: d.createdAt || Date.now(),
      };
      if (entry.kind === 'group') entry.members = Array.isArray(d.members) ? d.members : [];
      // Legacy "paid" flag becomes a real (account-less) payment record so there is one source of truth.
      if (d.status === 'paid' && !payments.some((p) => p.debtId === entry.id)) {
        payments.push({ id: generateId(), debtId: entry.id, memberId: null, amount: entry.amount, date: todayISO(), accountId: null, txId: null, note: 'Marked paid (migrated)' });
      }
      return entry;
    });

    saveAccounts(accounts);
    saveTransactions(txs);
    saveDebts(debts);
    savePayments(payments);
    ls().setItem(KEYS.SCHEMA, String(SCHEMA_VERSION));
  }

  /* ---------- derived financial values ---------- */
  function txEffects(t) {
    const a = toCents(t.amount);
    switch (t.type) {
      case 'income': case 'repay': return [{ accountId: t.accountId, cents: a }];
      case 'transfer': return [{ accountId: t.accountId, cents: -a }, { accountId: t.toAccountId, cents: a }];
      default: return [{ accountId: t.accountId, cents: -a }]; // expense, lend
    }
  }
  function accountBalance(id, txs) {
    const acc = getAccounts().find((a) => a.id === id);
    if (!acc) return 0;
    let c = toCents(acc.openingBalance || 0);
    (txs || getTransactions()).forEach((t) => txEffects(t).forEach((e) => { if (e.accountId === id) c += e.cents; }));
    return fromCents(c);
  }
  function accountsWithBalances() {
    const txs = getTransactions();
    return getAccounts().map((a) => ({ ...a, balance: accountBalance(a.id, txs), txCount: txs.filter((t) => txEffects(t).some((e) => e.accountId === a.id)).length }));
  }
  const totalBalance = () => fromCents(accountsWithBalances().reduce((s, a) => s + toCents(a.balance), 0));

  function monthSummary(now) {
    now = now || new Date();
    const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    let income = 0, expense = 0; const categories = {};
    getTransactions().forEach((t) => {
      if (!t.date.startsWith(key)) return;
      if (t.type === 'income') income += toCents(t.amount);
      else if (t.type === 'expense') { expense += toCents(t.amount); categories[t.category] = (categories[t.category] || 0) + toCents(t.amount); }
    });
    Object.keys(categories).forEach((k) => { categories[k] = fromCents(categories[k]); });
    return { income: fromCents(income), expense: fromCents(expense), categories };
  }

  function debtView(d, payments) {
    payments = payments || getPayments();
    const mine = payments.filter((p) => p.debtId === d.id);
    const paid = fromCents(mine.reduce((s, p) => s + toCents(p.amount), 0));
    const outstanding = fromCents(Math.max(0, toCents(d.amount) - toCents(paid)));
    const members = (d.members || []).map((m) => {
      const mp = fromCents(mine.filter((p) => p.memberId === m.id).reduce((s, p) => s + toCents(p.amount), 0));
      return { ...m, paid: mp, outstanding: fromCents(Math.max(0, toCents(m.amount) - toCents(mp))) };
    });
    const overdue = outstanding > 0 && d.dueDate < todayISO();
    const status = outstanding === 0 ? 'paid' : overdue ? 'overdue' : paid > 0 ? 'partial' : 'unpaid';
    return { ...d, paid, outstanding, members, payments: mine, status };
  }
  const debtViews = () => { const p = getPayments(); return getDebts().map((d) => debtView(d, p)); };

  /* ---------- accounts CRUD ---------- */
  function validateAccount(input) {
    const name = clean(input.name, 40);
    if (!name) return fail('Account name is required.');
    if (!ACCOUNT_TYPES[input.type]) return fail('Choose an account type.');
    const ob = parseFloat(input.openingBalance === '' || input.openingBalance == null ? 0 : input.openingBalance);
    if (!isFinite(ob) || Math.abs(ob) > MAX_AMOUNT) return fail('Enter a valid balance.');
    return ok({ name, type: input.type, openingBalance: round2(ob) });
  }
  function accountNameTaken(name, exceptId) {
    return getAccounts().some((a) => a.id !== exceptId && a.name.toLowerCase() === name.toLowerCase());
  }
  function addAccount(input) {
    const v = validateAccount(input); if (!v.ok) return v;
    if (accountNameTaken(v.name)) return fail('You already have an account with that name.');
    const acc = { id: generateId(), name: v.name, type: v.type, openingBalance: v.openingBalance };
    const list = getAccounts(); list.push(acc); saveAccounts(list); notify();
    return ok({ item: acc });
  }
  function updateAccount(id, input) {
    const list = getAccounts(); const acc = list.find((a) => a.id === id);
    if (!acc) return fail('This account no longer exists.');
    const v = validateAccount(input); if (!v.ok) return v;
    if (accountNameTaken(v.name, id)) return fail('You already have an account with that name.');
    Object.assign(acc, { name: v.name, type: v.type, openingBalance: v.openingBalance });
    saveAccounts(list); notify(); return ok({ item: acc });
  }
  /** Deleting an account that has history requires a destination so no money is created or lost. */
  function deleteAccount(id, moveToId) {
    const list = getAccounts(); const acc = list.find((a) => a.id === id);
    if (!acc) return fail('This account no longer exists.');
    if (list.length === 1) return fail('You need at least one account.');
    const txs = getTransactions(); const pays = getPayments(); const debts = getDebts();
    const used = txs.some((t) => t.accountId === id || t.toAccountId === id) || pays.some((p) => p.accountId === id) || debts.some((d) => d.accountId === id);
    if (used) {
      const target = list.find((a) => a.id === moveToId && a.id !== id);
      if (!target) return fail('Choose an account to move its history to.');
      txs.forEach((t) => { if (t.accountId === id) t.accountId = target.id; if (t.toAccountId === id) t.toAccountId = target.id; });
      pays.forEach((p) => { if (p.accountId === id) p.accountId = target.id; });
      debts.forEach((d) => { if (d.accountId === id) d.accountId = target.id; });
      target.openingBalance = round2(toCents(target.openingBalance || 0) / 100 + toCents(acc.openingBalance || 0) / 100);
      // A transfer between the two merged accounts becomes a no-op; drop it so history stays honest.
      const keep = txs.filter((t) => !(t.type === 'transfer' && t.accountId === t.toAccountId));
      saveTransactions(keep); savePayments(pays); saveDebts(debts);
    }
    saveAccounts(list.filter((a) => a.id !== id)); notify(); return ok();
  }

  /* ---------- transactions CRUD (user-owned: income / expense / transfer) ---------- */
  let lastSig = { sig: '', at: 0 };
  function validateTx(input) {
    const type = input.type;
    if (!['income', 'expense', 'transfer'].includes(type)) return fail('Choose a transaction type.');
    const amount = parseAmount(input.amount); if (amount === null) return fail('Enter an amount greater than 0.');
    if (!isValidDate(input.date)) return fail('Pick a valid date.');
    const accounts = getAccounts();
    if (!accounts.some((a) => a.id === input.accountId)) return fail(type === 'transfer' ? 'Choose the account to transfer from.' : 'Choose an account.');
    const out = { type, amount, date: input.date, accountId: input.accountId, description: clean(input.description, 120) };
    if (type === 'transfer') {
      if (!accounts.some((a) => a.id === input.toAccountId)) return fail('Choose the account to transfer to.');
      if (input.toAccountId === input.accountId) return fail('Pick two different accounts.');
      out.toAccountId = input.toAccountId; out.category = 'Transfer';
    } else {
      if (!input.category) return fail('Choose a category.');
      out.category = clean(input.category, 40);
    }
    return ok({ value: out });
  }
  function addTransaction(input) {
    const v = validateTx(input); if (!v.ok) return v;
    const sig = JSON.stringify(v.value); const now = Date.now();
    if (sig === lastSig.sig && now - lastSig.at < 800) return fail('That transaction was just added.');
    lastSig = { sig, at: now };
    const t = { id: generateId(), ...v.value, createdAt: now };
    const list = getTransactions(); list.push(t); saveTransactions(list); notify();
    return ok({ item: t });
  }
  function updateTransaction(id, input) {
    const list = getTransactions(); const t = list.find((x) => x.id === id);
    if (!t) return fail('This transaction no longer exists. Refresh and try again.');
    if (t.link) return fail('This transaction belongs to ListaPay. Edit it there.');
    const v = validateTx(input); if (!v.ok) return v;
    delete t.toAccountId; Object.assign(t, v.value);
    saveTransactions(list); notify(); return ok({ item: t });
  }
  function deleteTransaction(id) {
    const t = getTransactions().find((x) => x.id === id);
    if (!t) return fail('This transaction no longer exists.');
    if (t.link && t.link.paymentId) return deletePayment(t.link.paymentId);
    if (t.link && t.link.debtId) { // the original loan outflow: the loan stays, it just is no longer recorded against an account
      const debts = getDebts(); const d = debts.find((x) => x.id === t.link.debtId);
      if (d) { d.accountId = null; d.lendTxId = null; saveDebts(debts); }
    }
    saveTransactions(getTransactions().filter((x) => x.id !== id)); notify(); return ok();
  }

  /* ---------- ListaPay: debts ---------- */
  function normalizeMembers(raw, existing) {
    const out = []; const seen = new Set();
    for (const m of raw || []) {
      const name = clean(m.name, 40); if (!name && (m.amount === '' || m.amount == null)) continue; // blank row
      const amount = parseAmount(m.amount);
      if (!name) return fail('Every member needs a name.');
      if (amount === null) return fail(`Enter an amount greater than 0 for ${name}.`);
      let id = m.id && (existing || []).some((e) => e.id === m.id) ? m.id : generateId();
      if (seen.has(id)) id = generateId(); seen.add(id);
      out.push({ id, name, amount });
    }
    if (!out.length) return fail('Add at least one member.');
    return ok({ members: out });
  }
  function validateDebt(input, existing) {
    const kind = existing ? existing.kind : input.kind;
    if (!['person', 'group', 'bill'].includes(kind)) return fail('Choose Person, Group or Bill.');
    const name = clean(input.name, 60); if (!name) return fail(kind === 'bill' ? 'Enter the bill name.' : 'Enter a name.');
    if (!isValidDate(input.dueDate)) return fail('Pick a valid due date.');
    const out = { kind, direction: kind === 'bill' ? 'i-owe' : 'owed-to-me', name, dueDate: input.dueDate, note: clean(input.note, 120) };
    if (kind === 'group') {
      const m = normalizeMembers(input.members, existing && existing.members); if (!m.ok) return m;
      out.members = m.members; out.amount = fromCents(m.members.reduce((s, x) => s + toCents(x.amount), 0));
    } else {
      const amount = parseAmount(input.amount); if (amount === null) return fail('Enter an amount greater than 0.');
      out.amount = amount;
    }
    if (kind !== 'bill') {
      const acc = input.accountId || null;
      if (acc && !getAccounts().some((a) => a.id === acc)) return fail('Choose a valid account.');
      out.accountId = acc;
    } else out.accountId = null;
    return ok({ value: out });
  }
  /** Re-derives every linked transaction from its owner so they can never drift apart. */
  function syncLinked(debtId) {
    const debts = getDebts(); const d = debts.find((x) => x.id === debtId); if (!d) return;
    let txs = getTransactions(); const pays = getPayments(); const today = todayISO();
    // loan outflow (reuse id/createdAt so history order stays stable across edits)
    const oldLend = txs.find((t) => t.link && t.link.debtId === debtId && !t.link.paymentId);
    txs = txs.filter((t) => t !== oldLend);
    d.lendTxId = null;
    if (d.direction === 'owed-to-me' && d.accountId) {
      const id = oldLend ? oldLend.id : generateId(); d.lendTxId = id;
      txs.push({ id, type: 'lend', amount: d.amount, accountId: d.accountId, category: 'Loan Given', date: d.date || today, description: `Lent to ${d.name}`, link: { debtId }, createdAt: oldLend ? oldLend.createdAt : Date.now() });
    }
    // payments
    pays.filter((p) => p.debtId === debtId).forEach((p) => {
      const old = txs.find((t) => t.id === p.txId);
      txs = txs.filter((t) => t !== old);
      p.txId = null;
      if (p.accountId) {
        const who = p.memberId ? ((d.members || []).find((m) => m.id === p.memberId) || {}).name : null;
        const id = old ? old.id : generateId(); p.txId = id;
        txs.push(d.direction === 'owed-to-me'
          ? { id, type: 'repay', amount: p.amount, accountId: p.accountId, category: 'Loan Repayment', date: p.date, description: who ? `Payment from ${who} (${d.name})` : `Payment from ${d.name}`, link: { debtId, paymentId: p.id }, createdAt: old ? old.createdAt : Date.now() }
          : { id, type: 'expense', amount: p.amount, accountId: p.accountId, category: 'Bills', date: p.date, description: `Paid ${d.name}`, link: { debtId, paymentId: p.id }, createdAt: old ? old.createdAt : Date.now() });
      }
    });
    saveTransactions(txs); savePayments(pays); saveDebts(debts);
  }
  function addDebt(input) {
    const v = validateDebt(input, null); if (!v.ok) return v;
    const sig = 'debt' + JSON.stringify(v.value); const now = Date.now();
    if (sig === lastSig.sig && now - lastSig.at < 800) return fail('That entry was just added.');
    lastSig = { sig, at: now };
    const d = { id: generateId(), ...v.value, date: todayISO(), lendTxId: null, createdAt: now };
    const list = getDebts(); list.push(d); saveDebts(list); syncLinked(d.id); notify();
    return ok({ item: d });
  }
  function updateDebt(id, input) {
    const list = getDebts(); const d = list.find((x) => x.id === id);
    if (!d) return fail('This entry no longer exists. Refresh and try again.');
    const v = validateDebt(input, d); if (!v.ok) return v;
    const pays = getPayments().filter((p) => p.debtId === id);
    const paid = pays.reduce((s, p) => s + toCents(p.amount), 0);
    if (toCents(v.value.amount) < paid) return fail(`Amount can't be less than the ${fromCents(paid).toFixed(2)} already paid.`);
    if (d.kind === 'group') {
      for (const p of pays) {
        const m = v.value.members.find((x) => x.id === p.memberId);
        if (!m) return fail('A member with recorded payments can’t be removed. Delete their payments first.');
      }
      for (const m of v.value.members) {
        const mp = pays.filter((p) => p.memberId === m.id).reduce((s, p) => s + toCents(p.amount), 0);
        if (toCents(m.amount) < mp) return fail(`${m.name}'s amount can't be less than what they already paid.`);
      }
    }
    Object.assign(d, v.value); saveDebts(list); syncLinked(id); notify();
    return ok({ item: d });
  }
  function deleteDebt(id) {
    const d = getDebts().find((x) => x.id === id); if (!d) return fail('This entry no longer exists.');
    const txIds = new Set(getTransactions().filter((t) => t.link && t.link.debtId === id).map((t) => t.id));
    saveTransactions(getTransactions().filter((t) => !txIds.has(t.id)));
    savePayments(getPayments().filter((p) => p.debtId !== id));
    saveDebts(getDebts().filter((x) => x.id !== id)); notify(); return ok();
  }

  /* ---------- ListaPay: payments ---------- */
  function paymentRoom(debt, memberId, exceptPaymentId) {
    const pays = getPayments().filter((p) => p.debtId === debt.id && p.id !== exceptPaymentId);
    if (debt.kind === 'group') {
      const m = (debt.members || []).find((x) => x.id === memberId); if (!m) return null;
      return toCents(m.amount) - pays.filter((p) => p.memberId === memberId).reduce((s, p) => s + toCents(p.amount), 0);
    }
    return toCents(debt.amount) - pays.reduce((s, p) => s + toCents(p.amount), 0);
  }
  function validatePayment(debt, input, exceptPaymentId) {
    const amount = parseAmount(input.amount); if (amount === null) return fail('Enter an amount greater than 0.');
    if (!isValidDate(input.date)) return fail('Pick a valid date.');
    const accountId = input.accountId || null;
    if (accountId && !getAccounts().some((a) => a.id === accountId)) return fail('Choose a valid account.');
    let memberId = null;
    if (debt.kind === 'group') { memberId = input.memberId; if (!(debt.members || []).some((m) => m.id === memberId)) return fail('Choose which member paid.'); }
    const room = paymentRoom(debt, memberId, exceptPaymentId);
    if (toCents(amount) > room) return fail(`That's more than the remaining ${fromCents(room).toFixed(2)}.`);
    return ok({ value: { amount, date: input.date, accountId, memberId, note: clean(input.note, 120) } });
  }
  function addPayment(debtId, input) {
    const d = getDebts().find((x) => x.id === debtId); if (!d) return fail('This entry no longer exists.');
    const v = validatePayment(d, input); if (!v.ok) return v;
    const sig = 'pay' + debtId + JSON.stringify(v.value); const now = Date.now();
    if (sig === lastSig.sig && now - lastSig.at < 800) return fail('That payment was just recorded.');
    lastSig = { sig, at: now };
    const p = { id: generateId(), debtId, txId: null, ...v.value };
    const pays = getPayments(); pays.push(p); savePayments(pays); syncLinked(debtId); notify();
    return ok({ item: p });
  }
  function updatePayment(id, input) {
    const pays = getPayments(); const p = pays.find((x) => x.id === id);
    if (!p) return fail('This payment no longer exists.');
    const d = getDebts().find((x) => x.id === p.debtId); if (!d) return fail('This entry no longer exists.');
    const v = validatePayment(d, { ...input, memberId: input.memberId || p.memberId }, id); if (!v.ok) return v;
    Object.assign(p, v.value); savePayments(pays); syncLinked(p.debtId); notify(); return ok({ item: p });
  }
  function deletePayment(id) {
    const p = getPayments().find((x) => x.id === id); if (!p) return fail('This payment no longer exists.');
    if (p.txId) saveTransactions(getTransactions().filter((t) => t.id !== p.txId));
    savePayments(getPayments().filter((x) => x.id !== id)); notify(); return ok();
  }

  /* ---------- data tools ---------- */
  function resetAll() {
    [KEYS.TRANSACTIONS, KEYS.LISTAPAY, KEYS.PAYMENTS, KEYS.ACCOUNTS, KEYS.BUDGET, KEYS.SCHEMA].forEach((k) => ls().removeItem(k));
    migrate(); notify();
  }
  function loadSampleData() {
    resetAll();
    const d = new Date(); const iso = (off) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
    const first = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    const gcash = addAccount({ name: 'GCash', type: 'ewallet', openingBalance: 2000 }).item;
    updateAccount(DEFAULT_ACCOUNT_ID, { name: 'Cash', type: 'cash', openingBalance: 6000 });
    const add = (t) => { lastSig = { sig: '', at: 0 }; return addTransaction(t); };
    add({ type: 'income', amount: 45000, category: 'Salary', date: first, description: 'Monthly Salary', accountId: gcash.id });
    add({ type: 'expense', amount: 3200, category: 'Food', date: iso(-3), description: 'Weekly Groceries', accountId: DEFAULT_ACCOUNT_ID });
    add({ type: 'expense', amount: 650, category: 'Transport', date: iso(-2), description: 'Beep Card Reload & Grab', accountId: DEFAULT_ACCOUNT_ID });
    add({ type: 'expense', amount: 1200, category: 'Entertainment', date: iso(-1), description: 'Weekend Dinner & Movies', accountId: gcash.id });
    lastSig = { sig: '', at: 0 };
    addDebt({ kind: 'person', name: 'Juan Dela Cruz', amount: 500, dueDate: iso(10), note: 'Lunch & load', accountId: DEFAULT_ACCOUNT_ID });
    lastSig = { sig: '', at: 0 };
    addDebt({ kind: 'person', name: 'Maria Santos', amount: 1200, dueDate: iso(15), note: '', accountId: gcash.id });
    lastSig = { sig: '', at: 0 };
    addDebt({ kind: 'group', name: 'Barkada Group', dueDate: iso(20), note: 'Beach trip', accountId: gcash.id, members: [{ name: 'Ana', amount: 1000 }, { name: 'Ben', amount: 1000 }, { name: 'Carl', amount: 1000 }] });
    lastSig = { sig: '', at: 0 };
    addDebt({ kind: 'bill', name: 'Electricity Bill', amount: 1500, dueDate: iso(12), note: 'Pay via GCash' });
    setMonthlyBudget(20000);
  }

  const api = {
    KEYS, CATEGORIES, ACCOUNT_TYPES, DEFAULT_ACCOUNT_ID,
    todayISO, isValidDate, toCents, fromCents, round2, parseAmount,
    migrate, getUserName, setUserName, getMonthlyBudget, setMonthlyBudget,
    getAccounts, getTransactions, getDebts, getPayments,
    accountsWithBalances, accountBalance, totalBalance, monthSummary, debtView, debtViews,
    addAccount, updateAccount, deleteAccount,
    addTransaction, updateTransaction, deleteTransaction,
    addDebt, updateDebt, deleteDebt, addPayment, updatePayment, deletePayment,
    paymentRoom, resetAll, loadSampleData,
  };
  root.PW = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
