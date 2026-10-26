const assert = require('assert');
const mem = {}; globalThis.localStorage = { getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v)}, removeItem:k=>{delete mem[k]} };
const PW = require('./store.js');
let passed=0; const t=(name,fn)=>{ try{ Object.keys(mem).forEach(k=>delete mem[k]); fn(); passed++; console.log('PASS',name);}catch(e){console.log('FAIL',name,'\n  ',e.message);process.exitCode=1;} };
const wait=()=>{ const e=Date.now()+850; while(Date.now()<e); }; // clear duplicate guard
const eq=(a,b,m)=>assert.strictEqual(Math.round(a*100)/100,b,m);
const D='2026-10-10';
const cash=()=>PW.DEFAULT_ACCOUNT_ID;

t('legacy migration preserves data & balance',()=>{
  mem[PW.KEYS.TRANSACTIONS]=JSON.stringify([{id:'a',type:'income',amount:1000,category:'Salary',date:'2026-10-01',description:'x',createdAt:1},{id:'b',type:'expense',amount:250.5,category:'Food',date:'2026-10-02',description:'y',createdAt:2}]);
  mem[PW.KEYS.LISTAPAY]=JSON.stringify([{id:'l1',direction:'owed-to-me',name:'Jun',amount:2500,dueDate:'2026-10-20',note:'',status:'unpaid',createdAt:1},{id:'l2',direction:'i-owe',name:'Meralco',amount:1850,dueDate:'2026-10-15',status:'paid',createdAt:2}]);
  PW.migrate(); PW.migrate();
  eq(PW.totalBalance(),749.5); assert.equal(PW.getTransactions().length,2);
  const v=PW.debtViews(); assert.equal(v.find(x=>x.id==='l1').status!=='paid',true); assert.equal(v.find(x=>x.id==='l2').status,'paid');
  assert.equal(v.find(x=>x.id==='l1').kind,'person'); assert.equal(v.find(x=>x.id==='l2').kind,'bill');
  assert.equal(PW.getPayments().length,1,'migration idempotent');
  eq(PW.totalBalance(),749.5);
});
t('malformed storage is safe and preserved',()=>{
  mem[PW.KEYS.TRANSACTIONS]='{not json'; PW.migrate();
  assert.deepEqual(PW.getTransactions(),[]); assert.equal(mem[PW.KEYS.TRANSACTIONS+'_corrupt'],'{not json');
});
t('income/expense affect account; transfer is neutral for income/expense',()=>{
  PW.migrate(); const b=PW.addAccount({name:'Bank',type:'bank',openingBalance:500}).item;
  PW.addTransaction({type:'income',amount:1000,category:'Salary',date:D,accountId:cash()}); wait();
  PW.addTransaction({type:'expense',amount:300,category:'Food',date:D,accountId:cash()});wait();
  eq(PW.accountBalance(cash()),700);
  const r=PW.addTransaction({type:'transfer',amount:200,date:D,accountId:cash(),toAccountId:b.id}); assert(r.ok);
  eq(PW.accountBalance(cash()),500); eq(PW.accountBalance(b.id),700); eq(PW.totalBalance(),1200);
  const now=new Date(2026,9,15); const s=PW.monthSummary(now); eq(s.income,1000); eq(s.expense,300);
  assert(!PW.addTransaction({type:'transfer',amount:5,date:D,accountId:cash(),toAccountId:cash()}).ok);
});
t('validation: bad amount/date/account/category rejected',()=>{
  PW.migrate();
  for(const bad of [{amount:0},{amount:-5},{amount:'abc'},{amount:1e13},{date:'2026-02-31'},{accountId:'nope'},{category:''}]){
    assert(!PW.addTransaction({type:'expense',amount:10,category:'Food',date:D,accountId:cash(),...bad}).ok, JSON.stringify(bad)); wait();
  }
  assert.equal(PW.getTransactions().length,0);
});
t('duplicate rapid submit blocked',()=>{
  PW.migrate(); const i={type:'expense',amount:10,category:'Food',date:D,accountId:cash()};
  assert(PW.addTransaction(i).ok); assert(!PW.addTransaction(i).ok); assert.equal(PW.getTransactions().length,1);
});
t('update & delete tx recalculates',()=>{
  PW.migrate(); const tx=PW.addTransaction({type:'expense',amount:100,category:'Food',date:D,accountId:cash()}).item;
  eq(PW.totalBalance(),-100);
  assert(PW.updateTransaction(tx.id,{type:'income',amount:400,category:'Salary',date:D,accountId:cash()}).ok); eq(PW.totalBalance(),400);
  assert(PW.deleteTransaction(tx.id).ok); eq(PW.totalBalance(),0);
  assert(!PW.updateTransaction('ghost',{}).ok);
});
t('lend deducts; partial/full repay; no overpay',()=>{
  PW.migrate(); PW.updateAccount(cash(),{name:'Cash',type:'cash',openingBalance:1000});
  const d=PW.addDebt({kind:'person',name:'Juan',amount:500,dueDate:'2026-12-01',accountId:cash()}).item;
  eq(PW.totalBalance(),500); assert.equal(PW.getTransactions().filter(x=>x.type==='lend').length,1);
  assert(!PW.addPayment(d.id,{amount:600,date:D,accountId:cash()}).ok); wait();
  assert(PW.addPayment(d.id,{amount:200,date:D,accountId:cash()}).ok); wait();
  eq(PW.totalBalance(),700); let v=PW.debtView(PW.getDebts()[0]); eq(v.outstanding,300); assert.equal(v.status,'partial');
  assert(PW.addPayment(d.id,{amount:300,date:D,accountId:cash()}).ok);
  eq(PW.totalBalance(),1000); v=PW.debtView(PW.getDebts()[0]); eq(v.outstanding,0); assert.equal(v.status,'paid');
  assert(!PW.addPayment(d.id,{amount:1,date:D,accountId:cash()}).ok,'no negative debt');
  const s=PW.monthSummary(new Date(2026,9,15)); eq(s.income,0); eq(s.expense,0); // lending/repay are not income/expense
});
t('edit loan amount/account reverses & reapplies once',()=>{
  PW.migrate(); const b=PW.addAccount({name:'B',type:'bank',openingBalance:1000}).item; PW.updateAccount(cash(),{name:'Cash',type:'cash',openingBalance:1000});
  const d=PW.addDebt({kind:'person',name:'J',amount:500,dueDate:'2026-12-01',accountId:cash()}).item; eq(PW.accountBalance(cash()),500);
  assert(PW.updateDebt(d.id,{name:'J',amount:800,dueDate:'2026-12-01',accountId:cash()}).ok); eq(PW.accountBalance(cash()),200);
  assert(PW.updateDebt(d.id,{name:'J',amount:800,dueDate:'2026-12-01',accountId:b.id}).ok); eq(PW.accountBalance(cash()),1000); eq(PW.accountBalance(b.id),200);
  assert.equal(PW.getTransactions().filter(x=>x.type==='lend').length,1);
  assert(PW.updateDebt(d.id,{name:'J',amount:800,dueDate:'2026-12-01',accountId:null}).ok); eq(PW.totalBalance(),2000);
  PW.addPayment(d.id,{amount:300,date:D,accountId:cash()});
  assert(!PW.updateDebt(d.id,{name:'J',amount:200,dueDate:'2026-12-01'}).ok,'cannot go below paid');
});
t('edit/delete payment reverses effect',()=>{
  PW.migrate(); const d=PW.addDebt({kind:'person',name:'J',amount:500,dueDate:'2026-12-01',accountId:null}).item;
  const p=PW.addPayment(d.id,{amount:100,date:D,accountId:cash()}).item; eq(PW.totalBalance(),100);
  assert(PW.updatePayment(p.id,{amount:250,date:D,accountId:cash()}).ok); eq(PW.totalBalance(),250);
  assert(!PW.updatePayment(p.id,{amount:501,date:D,accountId:cash()}).ok); eq(PW.totalBalance(),250);
  assert(PW.deletePayment(p.id).ok); eq(PW.totalBalance(),0); eq(PW.debtView(PW.getDebts()[0]).outstanding,500);
});
t('delete debt unwinds lend + payments',()=>{
  PW.migrate(); PW.updateAccount(cash(),{name:'Cash',type:'cash',openingBalance:1000});
  const d=PW.addDebt({kind:'person',name:'J',amount:500,dueDate:'2026-12-01',accountId:cash()}).item; PW.addPayment(d.id,{amount:100,date:D,accountId:cash()});
  eq(PW.totalBalance(),600); assert(PW.deleteDebt(d.id).ok); eq(PW.totalBalance(),1000); assert.equal(PW.getTransactions().length,0); assert.equal(PW.getPayments().length,0);
});
t('deleting linked txs from Transactions page stays consistent',()=>{
  PW.migrate(); PW.updateAccount(cash(),{name:'Cash',type:'cash',openingBalance:1000});
  const d=PW.addDebt({kind:'person',name:'J',amount:500,dueDate:'2026-12-01',accountId:cash()}).item; const p=PW.addPayment(d.id,{amount:100,date:D,accountId:cash()}).item;
  assert(!PW.updateTransaction(PW.getPayments()[0].txId,{type:'income',amount:1,category:'x',date:D,accountId:cash()}).ok,'linked tx not editable here');
  PW.deleteTransaction(PW.getPayments()[0].txId); eq(PW.totalBalance(),500); eq(PW.debtView(PW.getDebts()[0]).outstanding,500);
  PW.deleteTransaction(PW.getTransactions().find(x=>x.type==='lend').id); eq(PW.totalBalance(),1000); assert.equal(PW.getDebts()[0].lendTxId,null);
});
t('group: member totals, per-member payments, edits',()=>{
  PW.migrate(); PW.updateAccount(cash(),{name:'Cash',type:'cash',openingBalance:5000});
  const g=PW.addDebt({kind:'group',name:'Barkada',dueDate:'2026-12-01',accountId:cash(),members:[{name:'A',amount:1000},{name:'B',amount:500}]}).item;
  eq(g.amount,1500); eq(PW.totalBalance(),3500); const [A,B]=g.members;
  assert(!PW.addPayment(g.id,{amount:100,date:D,accountId:cash()}).ok,'member required'); wait();
  assert(!PW.addPayment(g.id,{amount:600,date:D,accountId:cash(),memberId:B.id}).ok,'over member balance'); wait();
  assert(PW.addPayment(g.id,{amount:500,date:D,accountId:cash(),memberId:B.id}).ok);
  let v=PW.debtViews()[0]; eq(v.outstanding,1000); eq(v.members.find(m=>m.id===B.id).outstanding,0); eq(PW.totalBalance(),4000);
  assert(!PW.updateDebt(g.id,{name:'Barkada',dueDate:'2026-12-01',accountId:cash(),members:[{id:A.id,name:'A',amount:1000}]}).ok,'cannot drop paid member');
  assert(PW.updateDebt(g.id,{name:'Barkada',dueDate:'2026-12-01',accountId:cash(),members:[{id:A.id,name:'A',amount:700},{id:B.id,name:'B',amount:500},{name:'C',amount:300}]}).ok);
  v=PW.debtViews()[0]; eq(v.amount,1500); eq(PW.totalBalance(),3500+500); // lend now 1500 => 3500, plus 500 repaid
});
t('bill payment is an expense; delete reverses',()=>{
  PW.migrate(); PW.updateAccount(cash(),{name:'Cash',type:'cash',openingBalance:2000});
  const b=PW.addDebt({kind:'bill',name:'Meralco',amount:1500,dueDate:'2026-12-01'}).item; eq(PW.totalBalance(),2000);
  const p=PW.addPayment(b.id,{amount:1500,date:'2026-10-05',accountId:cash()}).item; eq(PW.totalBalance(),500);
  eq(PW.monthSummary(new Date(2026,9,5)).expense,1500); PW.deletePayment(p.id); eq(PW.totalBalance(),2000);
});
t('account edit/delete never creates or destroys money',()=>{
  PW.migrate(); const b=PW.addAccount({name:'Bank',type:'bank',openingBalance:300}).item;
  PW.addTransaction({type:'income',amount:100,category:'Salary',date:D,accountId:b.id}); eq(PW.totalBalance(),400);
  assert(PW.updateAccount(b.id,{name:'Bank',type:'bank',openingBalance:300}).ok); eq(PW.totalBalance(),400);
  assert(!PW.deleteAccount(b.id).ok,'needs destination');
  assert(PW.deleteAccount(b.id,cash()).ok); eq(PW.totalBalance(),400); eq(PW.accountBalance(cash()),400);
  assert(!PW.deleteAccount(cash()).ok,'last account protected');
  assert(!PW.addAccount({name:'cash',type:'cash'}).ok,'dup name');
});
t('sample data loads consistently',()=>{
  PW.migrate(); PW.loadSampleData(); assert(PW.getDebts().length===4); assert(PW.getAccounts().length===2);
  const sum=PW.accountsWithBalances().reduce((s,a)=>s+a.balance,0); eq(sum,PW.totalBalance());
});
console.log(passed+' passed');
