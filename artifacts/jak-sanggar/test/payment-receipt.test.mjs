import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { readPaymentReceipt, receiptExtension, validateDistributionRows, paymentAmount, paymentTotal } from '../src/lib/payment-receipt.ts';

test('receipt preserves exact PDF bytes through upload and download data URL', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('Bukti pembayaran QA');
  const content = await pdf.save();
  const value = await readPaymentReceipt(new File([content], 'bukti.pdf', { type: 'application/pdf' }));
  assert.equal(receiptExtension(value), 'pdf');
  const restored = Buffer.from(value.split(',')[1], 'base64');
  assert.deepEqual(new Uint8Array(restored), content);
  assert.equal((await PDFDocument.load(restored)).getPageCount(), 1);
});
test('receipt rejects empty, oversized, disguised, and executable uploads', async () => {
  for (const file of [new File([], 'empty.png', {type:'image/png'}), new File([new Uint8Array(2097153)], 'large.png', {type:'image/png'}), new File(['<html>bad</html>'], 'fake.pdf', {type:'application/pdf'}), new File(['<svg/>'], 'bad.svg', {type:'image/svg+xml'})]) await assert.rejects(readPaymentReceipt(file));
  for (const value of ['bukti.pdf', 'javascript:alert(1)', 'data:text/html;base64,SGk=', '/../../secret']) assert.equal(receiptExtension(value), null);
});
test('valid image receipt bytes survive the round trip', async () => {
  const bytes = new Uint8Array(await readFile(new URL('../../../services/document-renderer/test-assets/logo.png', import.meta.url)));
  const value = await readPaymentReceipt(new File([bytes], 'bukti.png', {type:'image/png'}));
  assert.equal(receiptExtension(value), 'png');
  assert.deepEqual(new Uint8Array(Buffer.from(value.split(',')[1], 'base64')), bytes);
});

test('receipt rejects truncated image containers and fake PDF headers', async () => {
  const png = await readFile(new URL('../../../services/document-renderer/test-assets/logo.png', import.meta.url));
  for (const bytes of [png.subarray(0,8), png.subarray(0,-12)]) await assert.rejects(readPaymentReceipt(new File([bytes], 'partial.png', {type:'image/png'})), /tidak utuh/);
  await assert.rejects(readPaymentReceipt(new File(['%PDF-1.7\nQA receipt\n%%EOF'], 'fake.pdf', {type:'application/pdf'})), /PDF bukti tidak dapat dibuka/);
});

test('nominal rupiah and aggregate reject unsafe, fractional, and overflowing values', () => {
  for (const value of ['1e308', '9007199254740992', '1.5', '', '-10', 'Infinity']) assert.throws(() => paymentAmount(value));
  assert.equal(paymentAmount('150000'),150000);
  assert.throws(() => paymentTotal([Number.MAX_SAFE_INTEGER,1]), /Total nominal/);
  assert.throws(() => validateDistributionRows([{id:'p',nominal:'1e308'},{id:'s',nominal:'1e308'}],['p','s']));
  assert.throws(() => validateDistributionRows([{id:'p',nominal:String(Number.MAX_SAFE_INTEGER)},{id:'s',nominal:'1'}],['p','s']), /Total nominal/);
});
test('distribution validates every recipient before calculating the ledger output', () => {
  const valid = validateDistributionRows([{id:'p',nominal:'150000'},{id:'s',nominal:'200000'}], ['p','s']);
  assert.equal(valid.reduce((total,row)=>total+row.nominal,0),350000);
  for(const rows of [[], [{id:'p',nominal:'-1'}], [{id:'p',nominal:'Infinity'}], [{id:'other',nominal:'100'}], [{id:'p',nominal:'100'},{id:'p',nominal:'200'}], [{id:'p',nominal:'100'},{id:'s',nominal:''}]]) assert.throws(()=>validateDistributionRows(rows,['p','s']));
});
