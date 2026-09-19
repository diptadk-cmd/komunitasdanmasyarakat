import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { recordManualCash, recordDistributionCash, payHonorCash, validateIuranCash, jakartaInputDate } from '../src/lib/cash-records.ts';

test('form date uses Jakarta calendar across UTC midnight and year boundaries', () => {
  assert.equal(jakartaInputDate(new Date('2026-09-19T19:00:00Z')), '2026-09-20');
  assert.equal(jakartaInputDate(new Date('2026-09-19T16:59:59Z')), '2026-09-19');
  assert.equal(jakartaInputDate(new Date('2026-09-19T17:00:00Z')), '2026-09-20');
  assert.equal(jakartaInputDate(new Date('2026-12-31T17:00:00Z')), '2027-01-01');
});

const receipt = 'data:image/png;base64,' + (await readFile(new URL('../../../services/document-renderer/test-assets/logo.png', import.meta.url))).toString('base64');
const idFactory = () => { let id = 0; return () => `new-${++id}`; };
function state() {
  return {
    users: [{id:'sg',role:'sanggar',saldo:1000},{id:'other-sg',role:'sanggar',saldo:300},{id:'p',role:'pelatih',sanggarId:'sg',status:'aktif'},{id:'s',role:'seniman',sanggarId:'sg',status:'aktif'}],
    kas: [{id:'opening',sanggarId:'sg',tanggal:1,keterangan:'Saldo awal',debit:1000,kredit:0,saldo:1000,refType:'manual',refId:'old'},{id:'other-opening',sanggarId:'other-sg',tanggal:1,keterangan:'Saldo awal',debit:300,kredit:0,saldo:300,refType:'manual',refId:'other-old'}],
    transaksi: [], distribusi: [], activity: [],
    pengajuanHonor: [{id:'h',sanggarId:'sg',pelatihId:'p',jumlahSesi:1,honorPerSesi:200,total:200,status:'pending',createdAt:1}],
    iuran: [{id:'i',sanggarId:'sg',senimanId:'s',judul:'September',nominal:100,status:'pending',buktiDataUrl:receipt,createdAt:1}],
  };
}
const manual = {id:'t',sanggarId:'sg',jenis:'pemasukan',tanggal:'2026-09-20',kategori:'Donasi',nominal:250,sumberAtauTujuan:'Donatur',keterangan:'Dukungan seni',buktiDataUrl:receipt,createdAt:1234};
function assertCashInvariant(db) {
  for (const user of db.users.filter(user => user.role === 'sanggar')) {
    assert.equal(user.saldo, db.kas.filter(row => row.sanggarId === user.id).reduce((sum,row) => sum+row.debit-row.kredit,0));
  }
}

test('manual transaction keeps receipt, ledger ref and balance in one mutation', () => {
  const db=state(); recordManualCash(db,manual,idFactory());
  assert.equal(db.transaksi.length,1);
  assert.equal(db.transaksi[0].buktiDataUrl,receipt);
  assert.equal(db.kas.at(-1).refId,db.transaksi[0].id);
  assert.equal(db.kas.at(-1).debit,250);
  assert.equal(db.users[0].saldo,1250);
  assert.equal(db.activity.length,1);
  assertCashInvariant(db);
  const before=structuredClone(db);
  assert.throws(()=>recordManualCash(db,manual,idFactory()),/sudah tercatat/);
  assert.deepEqual(db,before);
});

test('distribution stores each valid recipient and ledger exact sum with receipt reference', () => {
  const db=state(); recordDistributionCash(db,{sanggarId:'sg',title:'Pementasan',rows:[{id:'p',nominal:'200'},{id:'s',nominal:'300'}],receipt,now:1234},idFactory());
  assert.deepEqual(db.distribusi.map(row=>[row.penerimaId,row.penerimaRole,row.nominal]),[['p','pelatih',200],['s','seniman',300]]);
  assert.ok(db.distribusi.every(row=>row.buktiTransferDataUrl===receipt));
  assert.equal(db.kas.at(-1).kredit,500);
  assert.equal(db.kas.at(-1).refId,db.distribusi[0].id);
  assertCashInvariant(db);
});

test('invalid second recipient rejects entire distribution without partial record or ledger', () => {
  for(const rows of [[{id:'p',nominal:'200'},{id:'missing',nominal:'300'}],[{id:'p',nominal:'200'},{id:'p',nominal:'300'}],[{id:'p',nominal:'200'},{id:'s',nominal:'-1'}],[{id:'p',nominal:String(Number.MAX_SAFE_INTEGER)},{id:'s',nominal:'1'}]]) {
    const db=state(), before=structuredClone(db);
    assert.throws(()=>recordDistributionCash(db,{sanggarId:'sg',title:'Pentas',rows,receipt,now:1},idFactory()));
    assert.deepEqual(db,before);
  }
});

test('recipient becoming inactive during upload is rechecked against save snapshot', () => {
  const db=state(); db.users.find(user=>user.id==='s').status='nonaktif'; const before=structuredClone(db);
  assert.throws(()=>recordDistributionCash(db,{sanggarId:'sg',title:'Pentas',rows:[{id:'s',nominal:'100'}],receipt,now:1},idFactory()),/anggota aktif/);
  assert.deepEqual(db,before);
});

test('unsafe next ledger balance leaves transaction, receipt and saldo unchanged', () => {
  const db=state(); db.kas[0].debit=Number.MAX_SAFE_INTEGER; db.kas[0].saldo=Number.MAX_SAFE_INTEGER; db.users[0].saldo=Number.MAX_SAFE_INTEGER;
  const before=structuredClone(db);
  assert.throws(()=>recordManualCash(db,manual,idFactory()),/Saldo baru/);
  assert.deepEqual(db,before);
});

test('honor and iuran update status plus ledger once, and reject stale approvals', () => {
  const db=state(), ids=idFactory();
  payHonorCash(db,'sg','h',receipt,ids,55);
  assert.equal(db.pengajuanHonor[0].buktiTransferDataUrl,receipt);
  assert.equal(db.pengajuanHonor[0].status,'disetujui');
  validateIuranCash(db,'sg','i',true,ids,56);
  assert.equal(db.iuran[0].status,'lunas');
  assert.equal(db.users[0].saldo,900);
  assertCashInvariant(db);
  const before=structuredClone(db);
  assert.throws(()=>payHonorCash(db,'sg','h',receipt,ids),/sudah diproses/);
  assert.throws(()=>validateIuranCash(db,'sg','i',true,ids),/sudah diproses/);
  assert.deepEqual(db,before);
});

test('foreign account and invalid receipt cannot partly update payment status', () => {
  const db=state(), before=structuredClone(db);
  assert.throws(()=>payHonorCash(db,'other-sg','h',receipt,idFactory()));
  assert.throws(()=>payHonorCash(db,'sg','h','filename.png',idFactory()));
  assert.deepEqual(db,before);
});
