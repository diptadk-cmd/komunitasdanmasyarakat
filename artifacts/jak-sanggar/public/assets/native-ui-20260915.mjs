import { defaults, pilihGrupProfil } from './native-ui-20260914-v3.mjs';
import { buildAutofill } from './native-autofill-20260915.mjs';
import { fieldMeta, normalizeFieldValue, toDateInput, fromDateInput } from './native-fields-20260915.mjs?v=help-2';
import { IMAGE_SLOTS, imageKindForField, imageAutofill, readImageFile, renderImages } from './native-images-20260915.mjs';
import { orderNativeCatalog } from './native-document-order-20260919.mjs';
import { documentWorkspaceCss } from './native-document-workspace-20260920.mjs';
export { defaults, pilihGrupProfil };

const css = `
.nf{--nf-ink:#173247;--nf-muted:#526a7d;--nf-line:#d9e4ea;--nf-base:#fff;--nf-soft:#f3f7fa;--nf-accent:#17675b;color:var(--nf-ink);font:inherit;line-height:1.5;padding:8px 0 28px}
.nf *{box-sizing:border-box}.nf h1,.nf h2,.nf h3,.nf p{margin:0}.nf h1{font-size:clamp(23px,2.5vw,30px);font-weight:750;line-height:1.3}.nf h2{font-size:clamp(20px,2vw,25px);font-weight:700;line-height:1.4;overflow-wrap:anywhere}.nf h3{font-size:17px;font-weight:700}.nf p{color:var(--nf-muted);max-width:72ch}.nf button,.nf input,.nf textarea,.nf select,.nf summary{font:inherit}.nf button,.nf summary{cursor:pointer}.nf button{border:1px solid var(--nf-line);border-radius:8px;background:var(--nf-base);color:var(--nf-ink);padding:9px 14px;min-height:42px;font-weight:600}.nf button:hover{border-color:var(--nf-accent)}.nf button:disabled{opacity:.55;cursor:wait}.nf button.nf-primary{background:var(--nf-accent);border-color:var(--nf-accent);color:white}.nf :focus-visible{outline:3px solid #2e9387;outline-offset:3px}.nf-head{margin:12px 0 24px;display:flex;justify-content:space-between;gap:20px;align-items:start}.nf-head p{margin-top:7px}.nf-steps{list-style:none;padding:0;margin:0 0 24px;display:flex;gap:24px;flex-wrap:wrap;color:var(--nf-muted);font-size:13px}.nf-steps li{display:flex;align-items:center;gap:8px}.nf-step{display:grid;place-items:center;width:26px;height:26px;background:var(--nf-ink);color:var(--nf-base);border-radius:50%;font-size:12px;font-weight:700}.nf-grid{display:grid;grid-template-columns:265px minmax(0,1fr);gap:24px;align-items:start}.nf-sidebar{background:var(--nf-base);border:1px solid var(--nf-line);border-radius:12px;overflow:visible;position:sticky;top:16px}.nf-sidebar-top{padding:18px;background:var(--nf-soft)}.nf-sidebar h2{font-size:17px;margin-bottom:16px}.nf label{display:block;font-weight:600;font-size:14px}.nf-sidebar label{margin:12px 0 6px}.nf select,.nf input,.nf textarea{color:var(--nf-ink);background:var(--nf-base);border:1px solid #aebfca;border-radius:7px;padding:10px 11px;width:100%;min-height:43px;line-height:1.5}.nf textarea{resize:vertical}.nf-list{max-height:580px;overflow:auto;padding:9px;display:grid;gap:4px}.nf-list button{border-color:transparent;text-align:left;font-size:13px;font-weight:500;line-height:1.5}.nf-list button[aria-pressed=true]{background:#e5f2ed;border-color:#9dc4b7;color:#15584d;font-weight:700}.nf-count{font-size:12px;margin-top:10px!important}.nf-main{min-width:0;background:var(--nf-base);border:1px solid var(--nf-line);border-radius:12px;padding:26px}.nf-document-label{font-size:13px;margin-bottom:8px!important}.nf-progress{margin:18px 0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--nf-muted)}.nf-progress progress{width:150px;height:7px;accent-color:var(--nf-accent)}.nf-autofill{background:#edf6f1;border-left:4px solid var(--nf-accent);padding:16px 18px;margin:20px 0;display:flex;gap:16px;align-items:center;justify-content:space-between}.nf-autofill strong{display:block;font-size:15px}.nf-autofill p{font-size:13px;margin-top:4px}.nf-autofill button{white-space:nowrap}.nf-toolbar{display:flex;gap:14px;align-items:end;margin:24px 0}.nf-searchfields{flex:1}.nf-searchfields label{margin-bottom:6px}.nf-filter{display:flex!important;align-items:center;gap:8px;white-space:nowrap;min-height:44px;font-weight:500!important}.nf-filter input{width:18px;min-height:18px;accent-color:var(--nf-accent)}.nf-section{border:0;border-top:1px solid var(--nf-line);padding:22px 0 4px;margin:0 0 18px;min-width:0}.nf-section legend{font-size:16px;font-weight:700;padding-right:12px;color:var(--nf-ink)}.nf-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 20px}.nf-field{min-width:0}.nf-field-wide{grid-column:1/-1}.nf-labelrow{display:flex;justify-content:space-between;gap:8px;align-items:start;margin-bottom:7px}.nf-help{position:relative;flex-shrink:0}.nf-help summary{list-style:none;border:1px solid #9bb2c1;border-radius:50%;width:23px;height:23px;display:grid;place-items:center;font-weight:700;color:var(--nf-muted);font-size:13px}.nf-help summary::-webkit-details-marker{display:none}.nf-help[open]{z-index:5}.nf-help-text{position:absolute;right:0;top:30px;width:min(320px,70vw);padding:15px;background:var(--nf-base);border:1px solid #9bb2c1;border-radius:8px;box-shadow:0 8px 26px #17324722;font-size:13px;line-height:1.6}.nf-help-text p+p{margin-top:9px}.nf-context{border-top:1px solid var(--nf-line);padding-top:8px;font-size:12px;overflow-wrap:anywhere}.nf-source{font-size:11px;color:var(--nf-accent);margin-top:5px}.nf-manual{font-size:11px;color:var(--nf-muted);margin-top:5px}.nf-custom{margin-top:7px}.nf-field .nf-choice{margin-top:5px;padding:3px 0;border:0;min-height:26px;font-size:12px;font-weight:500;text-decoration:underline;background:transparent}.nf-footer{border-top:1px solid var(--nf-line);padding-top:20px;margin-top:16px}.nf-footer h3{margin-bottom:5px}.nf-footer p{font-size:13px}.nf-actions{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0}.nf-secondary-actions{display:flex;gap:16px;align-items:center;justify-content:space-between;margin-top:16px;flex-wrap:wrap}.nf-secondary-actions button{font-size:12px;font-weight:500}.nf-status{border:1px solid #a3c4b6;border-radius:8px;padding:12px 15px;background:#edf6f1;color:#245c4b;margin:16px 0;font-size:14px}.nf-error{background:#fff1f2;color:#9f1239;border-color:#fecdd3}.nf-empty{padding:24px;background:var(--nf-soft);border-radius:8px}.nf-preview{margin-top:20px}.nf-preview iframe{display:block;width:100%;height:700px;border:1px solid var(--nf-line);border-radius:8px;margin-top:10px}.dark .nf{--nf-ink:#e1edf5;--nf-muted:#b3c5d1;--nf-line:#40586a;--nf-base:#172b3a;--nf-soft:#203849;--nf-accent:#197467}.dark .nf-autofill,.dark .nf-status{background:#173d36;color:#d9f4e9}.dark .nf-source{color:#91d7c2}.dark .nf-list button[aria-pressed=true]{background:#244d43;color:#d9f4e9}.dark .nf-error{background:#501e2a;color:#ffd2db}
@media(max-width:1100px){.nf-grid{grid-template-columns:230px minmax(0,1fr);gap:16px}.nf-main{padding:20px}.nf-fields{grid-template-columns:1fr}.nf-autofill{align-items:start;flex-direction:column}}
@media(max-width:760px){.nf-grid{grid-template-columns:1fr}.nf-sidebar{position:static}.nf-sidebar-top{padding:16px}.nf-list{max-height:220px}.nf-main{padding:18px}.nf-steps{gap:10px;font-size:12px}.nf-toolbar{align-items:stretch;flex-direction:column;gap:5px}.nf-actions button{flex:1 1 140px}.nf-preview iframe{height:500px}.nf-head{margin-bottom:18px}.nf-section{padding-top:16px}.nf-help-text{width:min(290px,76vw)}}
.nf-multiple{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px}.nf-multiple label{display:flex;align-items:center;gap:9px;border:1px solid var(--nf-line);border-radius:7px;padding:10px;font-weight:500;cursor:pointer}.nf-multiple input{width:18px;min-height:18px;flex-shrink:0;accent-color:var(--nf-accent)}.nf-multiple label:has(:checked){border-color:var(--nf-accent);background:var(--nf-soft)}.nf-multiple-note{font-size:12px;margin:0 0 8px!important}.nf-help summary{width:28px;height:28px}.nf-custom-label{font-size:12px!important;margin-top:10px}
`;
const empty = value => !String(value ?? '').trim() || /^[-–—]+$/.test(String(value).trim());
function download(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }

async function readRenderedDocument(response, format) {
  if (!response.ok) {
    let message = response.status === 401
      ? 'Sesi Anda telah berakhir. Masuk kembali lalu buat dokumen lagi.'
      : 'Layanan pembuat dokumen belum tersedia. Coba lagi sebentar.';
    try { const detail = await response.json(); if (typeof detail.error === 'string' && detail.error.trim()) message = detail.error; } catch {}
    throw new Error(message);
  }
  const label = format === 'word' ? 'Word' : 'PDF';
  const invalid = () => new Error(`Layanan pembuat dokumen belum mengirim file ${label} yang valid. Coba lagi sebentar atau hubungi pengelola jika masalah berulang.`);
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const allowed = format === 'word'
    ? ['', 'application/octet-stream', 'application/zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    : ['', 'application/octet-stream', 'application/pdf'];
  if (!allowed.includes(mime)) throw invalid();
  let blob;
  try { blob = await response.blob(); }
  catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw error;
    throw new Error('Unduhan dokumen terputus. Periksa koneksi lalu coba kembali.');
  }
  if (!blob || !Number.isFinite(blob.size) || blob.size < 8) throw invalid();
  const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (format === 'pdf') {
    const tail = await blob.slice(Math.max(0, blob.size - 1024)).text();
    if (String.fromCharCode(...header.slice(0, 5)) !== '%PDF-' || !tail.includes('%%EOF')) throw invalid();
  } else {
    // A DOCX is an OOXML ZIP package, not just an arbitrary ZIP response.
    // Check the central directory before accepting a download as a Word file.
    if (header[0] !== 0x50 || header[1] !== 0x4b || header[2] !== 3 || header[3] !== 4) throw invalid();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
      if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { end = offset; break; }
    }
    if (end < 0) throw invalid();
    const entries = view.getUint16(end + 10, true), directorySize = view.getUint32(end + 12, true), directoryStart = view.getUint32(end + 16, true);
    if (!entries || directoryStart + directorySize > end) throw invalid();
    const names = new Set();
    let offset = directoryStart;
    for (let index = 0; index < entries; index++) {
      if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw invalid();
      const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true);
      const next = offset + 46 + nameLength + extraLength + commentLength;
      if (next > directoryStart + directorySize) throw invalid();
      names.add(new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
      offset = next;
    }
    if (!names.has('[Content_Types].xml') || !names.has('word/document.xml')) throw invalid();
  }
  const expectedMime = format === 'word' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
  return blob.type === expectedMime ? blob : blob.slice(0, blob.size, expectedMime);
}

export function createTemplatePage(React, LetterheadBuilder, useAdapter) {
  const h = React.createElement;
  function Help({ name, text, context }) {
    const close = event => { const details = event.currentTarget.closest('details'); details.removeAttribute('open'); details.querySelector('summary').focus(); };
    return h('details', { className: 'nf-help', onKeyDown: event => { if (event.key === 'Escape') { event.preventDefault(); close(event); } } }, h('summary', { 'aria-label': `Penjelasan ${name}`, title: `Penjelasan ${name}` }, '?'), h('div', { className: 'nf-help-text', style: { maxHeight: '50vh', overflowY: 'auto' }, tabIndex: 0, role: 'region', 'aria-label': `Isi penjelasan ${name}` }, h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 } }, h('strong', null, name), h('button', { type: 'button', onClick: close, 'aria-label': `Tutup penjelasan ${name}`, style: { minWidth: 36, minHeight: 36, padding: '2px 8px', fontSize: 22 } }, '×')), text.split('\n\n').map((paragraph, index) => h('p', { key: index }, paragraph)), context && h('p', { className: 'nf-context' }, 'Dalam dokumen: ', context.replace(/\{\{[^}]+\}\}/g, '…'))));
  }
  return function NativeDocumentPage() {
    const adapter = useAdapter ? useAdapter() : {};
    const [catalog, setCatalog] = React.useState(null), [category, setCategory] = React.useState(''), [groupId, setGroup] = React.useState(''), [docId, setDoc] = React.useState('');
    const [search, setSearch] = React.useState(''), [fieldSearch, setFieldSearch] = React.useState(''), [onlyEmpty, setOnlyEmpty] = React.useState(false);
    const [drafts, setDrafts] = React.useState({}), [custom, setCustom] = React.useState({}), [busy, setBusy] = React.useState(''), [status, setStatus] = React.useState(''), [error, setError] = React.useState(''), [preview, setPreview] = React.useState('');
    const [imageDrafts, setImageDrafts] = React.useState({});
    const [letterheadOpen, setLetterheadOpen] = React.useState(false);
    const [pickerOpen, setPickerOpen] = React.useState(false), [view, setView] = React.useState('edit');
    const [activeSection, setActiveSection] = React.useState(null), [imagesOpen, setImagesOpen] = React.useState(false);
    const [sectionPages, setSectionPages] = React.useState({}), [activeFieldKey, setActiveFieldKey] = React.useState(null);
    const [pendingImageFocus, setPendingImageFocus] = React.useState(null), [pendingSectionFocus, setPendingSectionFocus] = React.useState(null);
    const reviewHeadingRef = React.useRef(null), pickerSearchRef = React.useRef(null);
    React.useEffect(() => { if (view === 'review') reviewHeadingRef.current?.focus(); }, [view]);
    React.useEffect(() => { if (pickerOpen) pickerSearchRef.current?.focus(); }, [pickerOpen]);
    React.useEffect(() => {
      if (imagesOpen && pendingImageFocus) {
        const target = document.getElementById('nf-upload-trigger-' + pendingImageFocus);
        target?.focus(); target?.scrollIntoView({ block: 'nearest' }); setPendingImageFocus(null);
      }
    }, [imagesOpen, pendingImageFocus]);
    React.useEffect(() => {
      if (pendingSectionFocus) { document.getElementById(pendingSectionFocus)?.focus(); setPendingSectionFocus(null); }
    }, [pendingSectionFocus, activeSection]);
    React.useEffect(() => {
      let cancelled = false;
      fetch('/dokumen-fix/catalog.json?v=20260915', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('Daftar dokumen belum tersedia. Muat ulang halaman.'); return r.json(); }).then(c => {
        if (cancelled) return;
        const orderedCatalog = orderNativeCatalog(c);
        const initial = pilihGrupProfil(orderedCatalog, adapter.profile);
        setCatalog(orderedCatalog); setCategory(initial?.category || ''); setGroup(initial?.id || ''); setDoc(initial?.documents[0]?.id || '');
      }).catch(e => !cancelled && setError(e.message));
      return () => { cancelled = true; };
    }, [adapter.profile?.id]);
    const categories = [...new Set(catalog?.groups.map(g => g.category) || [])];
    const groups = catalog?.groups.filter(g => g.category === category) || [], group = groups.find(g => g.id === groupId) || groups[0];
    const item = group?.documents.find(d => d.id === docId) || group?.documents[0];
    const saveKey = group ? `${adapter.profile?.id || 'kurator'}:native-fix-${group.id}` : '';
    const autofill = buildAutofill(adapter.profile, adapter.savedValues, saveKey, adapter.relatedSources);
    const edits = drafts[saveKey] || {};
    const values = { ...autofill.values, ...edits };
    const imageDefaults = imageAutofill(adapter.profile, adapter.savedValues, saveKey, adapter.relatedSources);
    const imageFallbacks = imageAutofill(adapter.profile, Object.fromEntries(Object.entries(adapter.savedValues || {}).filter(([key]) => key !== saveKey)), saveKey, adapter.relatedSources);
    const imageEdits = imageDrafts[saveKey] || {};
    const images = { ...imageDefaults.images, ...imageEdits };
    const sourceKey = JSON.stringify([saveKey, item?.id, values, images]);
    const latestSource = React.useRef(sourceKey); latestSource.current = sourceKey;
    const fields = item?.fields || [], isFieldEmpty = f => empty(values[f.key]) && !images[imageKindForField(f.key)], emptyFields = fields.filter(isFieldEmpty);
    const imageDirty = Object.entries(imageEdits).some(([key, value]) => value !== (imageDefaults.images[key] || ''));
    const dirty = imageDirty || Object.keys(edits).some(key => String(edits[key]) !== String(autofill.values[key] ?? ''));
    const unsaved = dirty || Object.entries(imageDrafts).some(([key, draft]) => key !== saveKey && key.startsWith(`${adapter.profile?.id}:`) && IMAGE_SLOTS.some(slot => Object.hasOwn(draft, slot.id) && draft[slot.id] !== (adapter.savedValues?.[key]?.[slot.key] || ''))) || Object.entries(drafts).some(([key, draft]) => key !== saveKey && key.startsWith(`${adapter.profile?.id}:`) && Object.entries(draft).some(([field, value]) => String(value) !== String(adapter.savedValues?.[key]?.[field] ?? '')));
    React.useEffect(() => { setPreview(''); setStatus(''); setError(''); }, [sourceKey]);
    React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
    React.useEffect(() => {
      if (!unsaved) return;
      const warn = event => { event.preventDefault(); event.returnValue = ''; };
      window.addEventListener('beforeunload', warn);
      return () => window.removeEventListener('beforeunload', warn);
    }, [unsaved]);
    function update(field, value) { setDrafts(previous => ({ ...previous, [saveKey]: { ...previous[saveKey], [field.key]: normalizeFieldValue(field, value) } })); }
    function updateImage(kind, value) { setImageDrafts(previous => ({ ...previous, [saveKey]: { ...previous[saveKey], [kind]: value } })); }
    async function uploadImage(slot, file) {
      if (!file || busy) return;
      const targetKey = saveKey;
      setBusy('image-' + slot.id); setError('');
      try { const value = await readImageFile(file, slot.id); setImageDrafts(previous => ({ ...previous, [targetKey]: { ...previous[targetKey], [slot.id]: value } })); }
      catch (e) { setError(e.message); } finally { setBusy(''); }
    }
    function resetEditor() { setView('edit'); setActiveSection(null); setSectionPages({}); setActiveFieldKey(null); setFieldSearch(''); setOnlyEmpty(false); setImagesOpen(false); setLetterheadOpen(false); }
    function chooseDocument(id) { setDoc(id); resetEditor(); setPickerOpen(false); setPendingSectionFocus('nf-document-title'); }
    function chooseGroup(id) { const selected = catalog.groups.find(g => g.id === id); if (!selected) return; setGroup(id); setDoc(selected.documents[0]?.id || ''); resetEditor(); }
    function returnToEditor() { setView('edit'); setPendingSectionFocus(filtering ? 'nf-field-search' : sections.length ? `nf-section-${Math.max(0, sections.indexOf(currentSection))}-toggle` : 'nf-document-title'); }
    function openReview() { setActiveFieldKey(null); setView('review'); setPickerOpen(false); return produce('pdf', true); }
    function chooseCategory(value) { setCategory(value); chooseGroup(catalog.groups.find(g => g.category === value).id); setSearch(''); }
    function fillEmpty() {
      const otherSaved = Object.fromEntries(Object.entries(adapter.savedValues || {}).filter(([key]) => key !== saveKey));
      const fallback = buildAutofill(adapter.profile, otherSaved, saveKey, adapter.relatedSources);
      const available = { ...fallback.values, ...Object.fromEntries(Object.entries(autofill.values).filter(([, value]) => !empty(value))) };
      const patch = Object.fromEntries(Object.entries(available).filter(([key, value]) => empty(values[key]) && !empty(value)));
      if (!Object.keys(patch).length) { setStatus('Semua data yang tersedia sudah terisi. Lengkapi isian lainnya sesuai keadaan sanggar.'); return; }
      setDrafts(previous => ({ ...previous, [saveKey]: { ...previous[saveKey], ...patch } }));
    }
    async function produce(format, isPreview = false, blank = false) {
      if (!item || busy) return;
      setBusy(blank ? 'blank' : isPreview ? 'preview' : format); setError(''); setStatus('');
      if (isPreview) setPreview('');
      try {
        const attachedImages = blank ? {} : await renderImages(images);
        const response = await fetch('/api/documents/render', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(75000), body: JSON.stringify({ format, html: '', nativeTemplate: { groupId: group.id, documentId: item.id, values: blank ? {} : values, ...(Object.keys(attachedImages).length ? { images: attachedImages } : {}) } }) });
        const blob = await readRenderedDocument(response, format);
        if (latestSource.current !== sourceKey) { setStatus('Isian telah berubah. Buat pratinjau atau unduh kembali untuk memakai isian terbaru.'); return; }
        if (isPreview) setPreview(URL.createObjectURL(blob));
        else { download(blob, item.title.toLocaleUpperCase('id-ID') + (!blank && emptyFields.length ? ' - Draf' : '') + (!blank && adapter.profile?.namaSanggar ? ' - ' + adapter.profile.namaSanggar : '') + (format === 'word' ? '.docx' : '.pdf')); setStatus(blank ? 'Template kosong berhasil diunduh.' : emptyFields.length ? `Draf berhasil diunduh. Lengkapi ${emptyFields.length} isian kosong sebelum digunakan.` : 'Dokumen berhasil diunduh.'); }
      } catch (e) { setError(e?.name === 'AbortError' || e?.name === 'TimeoutError' ? 'Pembuatan dokumen terlalu lama. Coba kembali sebentar lagi.' : e?.name === 'TypeError' ? 'Layanan pembuat dokumen tidak dapat dihubungi. Periksa koneksi lalu coba kembali.' : e?.message || 'Dokumen belum berhasil dibuat. Coba kembali.'); } finally { setBusy(''); }
    }
    async function save() {
      if (!adapter.save || busy) return;
      setBusy('save'); setError('');
      try { const savedImages = Object.fromEntries(IMAGE_SLOTS.filter(slot => Object.hasOwn(images, slot.id)).map(slot => [slot.key, images[slot.id]])); await adapter.save(saveKey, { ...values, ...savedImages }); if (latestSource.current === sourceKey) setStatus('Isian dan gambar tersimpan. Data yang sama siap digunakan pada formulir lain.'); else setStatus('Isian sebelumnya tersimpan. Simpan kembali untuk menyertakan perubahan terbaru.'); }
      catch { setError('Isian belum tersimpan. Periksa koneksi lalu coba kembali.'); } finally { setBusy(''); }
    }
    function renderField(field) {
      const meta = fieldMeta(field), value = values[field.key] ?? '', id = 'nf-field-' + field.key;
      const focusProps = { onFocus: () => setActiveFieldKey(field.key), onBlur: event => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveFieldKey(null); } };
      const imageKind = imageKindForField(field.key);
      if (imageKind) return h('div', { className: 'nf-field', key: field.key, ...focusProps }, h('div', { className: 'nf-labelrow' }, h('label', { htmlFor: id }, 'Keterangan ' + (imageKind === 'logo' ? 'logo' : 'stempel') + ' (opsional)'), h(Help, { name: meta.label, text: meta.help, context: field.context })), h('input', { id, value, onChange: event => update(field, event.target.value), placeholder: 'Contoh: desain yang disetujui pada rapat' }), h('p', { className: 'nf-count' }, images[imageKind] ? 'Gambar sudah terhubung dari bagian unggah.' : 'Unggah gambar pada bagian Logo, stempel, dan kop surat.'), h('a', { href: '#nf-image-' + imageKind, onClick: event => { event.preventDefault(); setImagesOpen(true); setPendingImageFocus(imageKind); } }, 'Buka unggah ' + (imageKind === 'logo' ? 'logo' : 'stempel')));
      const options = meta.options || [];
      const customKey = saveKey + ':' + field.key;
      const isCustom = custom[customKey] || (!empty(value) && !options.some(option => option.value === value));
      const source = Object.hasOwn(edits, field.key) ? 'Diubah di formulir ini' : autofill.sources[field.key];
      const props = { id, value, maxLength: 10000, onChange: event => update(field, event.target.value), 'aria-describedby': source && !empty(value) ? id + '-source' : undefined };
      let control;
      if (meta.multiple && options.length) {
        const selected = String(value).split('\n').map(part => part.trim()).filter(Boolean);
        const other = selected.filter(part => !options.some(option => option.value === part));
        const otherText = String(value).split('\n').filter(part => !options.some(option => option.value === part.trim())).join('\n');
        const known = options.filter(option => selected.includes(option.value)).map(option => option.value);
        const join = parts => [...new Set(parts)].join('\n');
        control = h(React.Fragment, null,
          h('p', { className: 'nf-multiple-note', id: id + '-hint' }, 'Boleh pilih lebih dari satu'),
          h('div', { className: 'nf-multiple', role: 'group', 'aria-label': meta.label, 'aria-describedby': id + '-hint' }, options.map((option, index) => h('label', { key: option.value }, h('input', { type: 'checkbox', id: index === 0 ? id : id + '-' + index, checked: selected.includes(option.value), onChange: event => update(field, join([...(event.target.checked ? [...known, option.value] : known.filter(part => part !== option.value)), ...other])) }), option.label))),
          h('label', { htmlFor: id + '-custom', className: 'nf-custom-label' }, 'Pilihan lain (tulis sendiri, satu per baris)'),
          h('textarea', { ...props, id: id + '-custom', rows: 2, value: otherText, className: 'nf-custom', onChange: event => update(field, [...known, event.target.value].filter(Boolean).join('\n')) }));
      } else if (meta.type === 'select' && options.length) {
        control = h(React.Fragment, null, h('select', { id, value: isCustom ? '__custom' : value, 'aria-describedby': props['aria-describedby'], onChange: event => {
          if (event.target.value === '__custom') setCustom(previous => ({ ...previous, [customKey]: true }));
          else { setCustom(previous => ({ ...previous, [customKey]: false })); update(field, event.target.value); }
        } }, h('option', { value: '' }, 'Pilih ' + meta.label.toLocaleLowerCase('id-ID')), options.map(option => h('option', { key: option.value, value: option.value }, option.label)), h('option', { value: '__custom' }, 'Tulis sendiri…')),
        isCustom && h('input', { ...props, id: id + '-custom', className: 'nf-custom', 'aria-label': meta.label + ' — isian sendiri', placeholder: 'Tuliskan pilihan yang sesuai' }));
      } else if (meta.type === 'date') {
        const known = toDateInput(value), manual = custom[customKey] ?? (!empty(value) && !known);
        control = h(React.Fragment, null, h('input', { ...props, type: manual ? 'text' : 'date', value: manual ? value : known, onChange: event => update(field, manual ? event.target.value : fromDateInput(event.target.value)), placeholder: manual ? 'Contoh: 15 September 2026' : undefined }), h('button', { type: 'button', className: 'nf-choice', onClick: () => setCustom(previous => ({ ...previous, [customKey]: !manual })) }, manual ? 'Gunakan kalender' : 'Ketik tanggal sendiri'));
      } else if (meta.type === 'time') {
        const known = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
        const manual = custom[customKey] ?? (!empty(value) && !known);
        control = h(React.Fragment, null, h('input', { ...props, type: manual ? 'text' : 'time', value: manual || known ? value : '', placeholder: manual ? 'Contoh: 09.00 WIB' : undefined }), h('button', { type: 'button', className: 'nf-choice', onClick: () => setCustom(previous => ({ ...previous, [customKey]: !manual })) }, manual ? 'Gunakan pemilih waktu' : 'Ketik waktu sendiri'));
      } else if (meta.type === 'textarea') control = h('textarea', { ...props, rows: 3 });
      else control = h('input', { ...props, type: meta.type === 'number' ? 'text' : meta.type || 'text', inputMode: meta.type === 'number' ? 'decimal' : undefined, style: meta.uppercase ? { textTransform: 'uppercase' } : undefined });
      return h('div', { className: 'nf-field' + (meta.type === 'textarea' ? ' nf-field-wide' : ''), key: field.key, ...focusProps }, h('div', { className: 'nf-labelrow' }, h('label', { htmlFor: id }, meta.label), h(Help, { name: meta.label, text: meta.help, context: field.context })), control, source && !empty(value) && h('div', { className: source === 'Diubah di formulir ini' ? 'nf-manual' : 'nf-source', id: id + '-source' }, source));
    }
    const filterTerm = fieldSearch.trim().toLocaleLowerCase('id-ID');
    const shown = fields.filter(field => (!onlyEmpty || isFieldEmpty(field) || activeFieldKey === field.key) && (!filterTerm || (fieldMeta(field).label + ' ' + field.key).toLocaleLowerCase('id-ID').includes(filterTerm)));
    const sections = [...new Set(fields.map(field => fieldMeta(field).group))];
    const shownSections = [...new Set(shown.map(field => fieldMeta(field).group))];
    const currentSection = activeSection ?? sections[0];
    const filtering = !!filterTerm || onlyEmpty;
    const documents = group?.documents.filter(doc => doc.title.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))) || [];
    const filledCount = fields.length - emptyFields.length;
    const sourcedCount = fields.filter(field => !empty(values[field.key]) && autofill.sources[field.key] && !Object.hasOwn(edits, field.key)).length;
    const draftNote = !fields.length ? 'Dokumen ini tidak memerlukan isian. Buka pratinjau untuk memeriksa isinya.' : emptyFields.length ? `Masih ada ${emptyFields.length} isian kosong. Unduhan akan ditandai sebagai draf.` : 'Semua isian terisi. Periksa dokumen sebelum digunakan.';
    const saveButton = adapter.save && h('button', { type: 'button', disabled: !!busy, onClick: save }, busy === 'save' ? 'Menyimpan…' : 'Simpan isian');
    const blankButton = h('button', { type: 'button', disabled: !!busy, onClick: () => produce('word', false, true) }, busy === 'blank' ? 'Menyiapkan template…' : 'Unduh template kosong');

    function imageFields() {
      return h('div', { className: 'nf-images-content' }, h('p', { className: 'nf-count' }, 'Opsional. Gunakan gambar profil atau unggah gambar untuk dokumen ini.'),
        h('div', { className: 'nf-fields' }, IMAGE_SLOTS.map(slot => h('div', { key: slot.id, id: 'nf-image-' + slot.id, className: 'nf-image-card' },
          h('div', { className: 'nf-labelrow' }, h('strong', null, slot.label), h(Help, { name: slot.label, text: slot.help })),
          images[slot.id] ? h('img', { src: images[slot.id], alt: 'Pratinjau ' + slot.label.toLowerCase() }) : h('p', { className: 'nf-count' }, 'Belum ada gambar'),
          h('input', { id: 'nf-upload-' + slot.id, type: 'file', accept: 'image/png,image/jpeg,image/webp,image/avif', hidden: true, onChange: event => { const file = event.target.files?.[0]; event.target.value = ''; void uploadImage(slot, file); } }),
          h('div', { className: 'nf-actions' }, h('button', { type: 'button', id: 'nf-upload-trigger-' + slot.id, disabled: !!busy, onClick: () => document.getElementById('nf-upload-' + slot.id).click() }, busy === 'image-' + slot.id ? 'Memproses gambar…' : (images[slot.id] ? 'Ganti ' : 'Unggah ') + slot.label.toLowerCase()), images[slot.id] && h('button', { type: 'button', disabled: !!busy, onClick: () => updateImage(slot.id, '') }, 'Lepas gambar')),
          slot.id === 'letterhead' && LetterheadBuilder && h('button', { type: 'button', disabled: !!busy, onClick: () => setLetterheadOpen(true) }, 'Buat kop dari identitas'),
          imageFallbacks.images[slot.id] && images[slot.id] !== imageFallbacks.images[slot.id] && h('button', { type: 'button', disabled: !!busy, className: 'nf-choice', onClick: () => updateImage(slot.id, imageFallbacks.images[slot.id]) }, 'Gunakan gambar tersimpan'),
          h('p', { className: 'nf-count' }, Object.hasOwn(imageEdits, slot.id) ? 'Perubahan gambar pada formulir ini' : imageDefaults.sources[slot.id] || 'PNG, JPG, WebP, atau AVIF; maksimal 8 MB.')))));
    }

    return h('section', { className: 'nf nf-workspace', 'data-testid': 'native-template-page', 'data-version': '20260920', 'data-view': view },
      h('style', null, css + documentWorkspaceCss),
      h('header', { className: 'nf-workspace-header' },
        h('div', { className: 'nf-document-copy' }, h('p', { className: 'nf-document-meta' }, group?.label || 'Dokumen sanggar'), h('h1', { id: 'nf-document-title', tabIndex: -1 }, item?.title || 'Dokumen sanggar')),
        h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' } },
          LetterheadBuilder && h('button', { type: 'button', id: 'nf-letterhead-builder-open', className: 'nf-picker-toggle', disabled: !item || !!busy, onClick: () => setLetterheadOpen(true) }, 'Buat kop surat'),
          h('button', { type: 'button', className: 'nf-picker-toggle', disabled: !catalog, 'aria-expanded': pickerOpen, 'aria-controls': 'nf-document-picker', onClick: () => setPickerOpen(previous => !previous) }, pickerOpen ? 'Tutup pilihan dokumen' : 'Ganti dokumen'))),
      LetterheadBuilder && item && h(React.Suspense, { fallback: letterheadOpen ? h('p', { role: 'status' }, 'Memuat pembuat kop surat…') : null }, h(LetterheadBuilder, {
        key: saveKey, open: letterheadOpen, profile: adapter.profile, initialLogo: images.logo,
        onClose: () => setLetterheadOpen(false),
        onApply: dataUrl => {
          if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl) || dataUrl.length > 550000) { setError('Kop surat belum valid. Buat ulang kop sebelum digunakan.'); return; }
          updateImage('letterhead', dataUrl); setLetterheadOpen(false); setView('edit'); setImagesOpen(true);
          setPendingImageFocus('letterhead');
        },
      })),
      pickerOpen && catalog && h('section', { id: 'nf-document-picker', className: 'nf-picker', 'aria-label': 'Pilihan dokumen' },
        h('div', { className: 'nf-picker-filters' },
          h('div', null, h('label', { htmlFor: 'nf-category' }, 'Kedudukan sanggar'), h('select', { id: 'nf-category', value: category, onChange: event => chooseCategory(event.target.value) }, categories.map(value => h('option', { key: value, value }, value)))),
          groups.length > 1 && h('div', null, h('label', { htmlFor: 'nf-group' }, 'Bentuk badan'), h('select', { id: 'nf-group', value: group.id, onChange: event => chooseGroup(event.target.value) }, groups.map(value => h('option', { key: value.id, value: value.id }, value.label.split(' / ').pop())))),
          h('div', null, h('label', { htmlFor: 'nf-search' }, 'Cari dokumen'), h('input', { ref: pickerSearchRef, id: 'nf-search', type: 'search', value: search, onChange: event => setSearch(event.target.value), placeholder: 'Contoh: berita acara' }))),
        h('p', { className: 'nf-count' }, `${documents.length} dokumen tersedia`),
        h('nav', { className: 'nf-list', 'aria-label': 'Daftar dokumen' }, documents.map(doc => h('button', { key: doc.id, type: 'button', 'aria-pressed': item?.id === doc.id, onClick: () => chooseDocument(doc.id) }, doc.title)), !documents.length && h('p', { className: 'nf-empty' }, 'Dokumen tidak ditemukan. Coba kata lain.')),
        h('div', { className: 'nf-picker-footer' }, blankButton)),
      error && h('div', { role: 'alert', className: 'nf-status nf-error' }, error),
      status && h('div', { role: 'status', className: 'nf-status' }, status),
      !catalog ? h('p', { role: 'status' }, 'Memuat dokumen…') : item && h(React.Fragment, null,
        h('nav', { className: 'nf-mode-bar', 'aria-label': 'Tahap dokumen' },
          h('button', { type: 'button', 'aria-current': view === 'edit' ? 'step' : undefined, onClick: returnToEditor }, '1. Lengkapi isian'),
          h('span', { 'aria-current': view === 'review' ? 'step' : undefined }, '2. Periksa & unduh')),
        view === 'edit' ? h('div', { className: 'nf-editor' },
          h('div', { className: 'nf-editor-overview' }, h('h2', null, 'Lengkapi isian'), fields.length > 0 ? h('div', { className: 'nf-progress-compact' }, h('progress', { max: fields.length || 1, value: filledCount, 'aria-label': 'Kelengkapan isian dokumen' }), h('span', null, `${filledCount} dari ${fields.length} terisi`)) : h('p', { className: 'nf-count' }, 'Dokumen ini tidak memerlukan isian.')),
          fields.length > 0 && h('div', { className: 'nf-autofill-inline' }, h('p', null, sourcedCount ? `${sourcedCount} isian sudah terisi dari data sanggar. Periksa satu bagian setiap kali.` : 'Lengkapi satu bagian setiap kali. Isian tetap ada saat berpindah bagian.'), h('button', { type: 'button', onClick: fillEmpty }, 'Isi otomatis yang kosong')),
          fields.length > 0 && h('div', { className: 'nf-toolbar' }, h('div', { className: 'nf-searchfields' }, h('label', { htmlFor: 'nf-field-search' }, 'Cari isian'), h('input', { id: 'nf-field-search', type: 'search', value: fieldSearch, onChange: event => setFieldSearch(event.target.value), placeholder: 'Cari nama, nomor, tanggal…' })), h('label', { className: 'nf-filter' }, h('input', { type: 'checkbox', checked: onlyEmpty, onChange: event => setOnlyEmpty(event.target.checked) }), 'Hanya yang kosong')),
          filtering ? h('div', { className: 'nf-search-results' },
            h('div', { className: 'nf-search-result-caption' }, h('p', null, `${shown.length} isian sesuai pencarian`), h('button', { type: 'button', onClick: () => { setFieldSearch(''); setOnlyEmpty(false); setPendingSectionFocus('nf-field-search'); } }, 'Tampilkan semua bagian')),
            shownSections.map(section => h('fieldset', { className: 'nf-section', key: section }, h('legend', null, section), h('div', { className: 'nf-fields' }, shown.filter(field => fieldMeta(field).group === section).map(renderField)))),
            !shown.length && h('p', { className: 'nf-empty' }, onlyEmpty && !emptyFields.length ? 'Semua isian sudah terisi. Dokumen siap diperiksa.' : 'Tidak ada isian yang cocok. Ubah pencarian atau matikan filter.')) :
            h('div', { className: 'nf-sections' }, sections.map((section, index) => {
              const sectionFields = fields.filter(field => fieldMeta(field).group === section), open = currentSection === section;
              const complete = sectionFields.filter(field => !isFieldEmpty(field)).length, sectionId = `nf-section-${index}`;
              const totalPages = Math.ceil(sectionFields.length / 6), page = Math.min(sectionPages[section] ?? 0, totalPages - 1);
              const pageFields = sectionFields.slice(page * 6, page * 6 + 6);
              return h('section', { key: section, className: 'nf-section-card' + (open ? ' is-open' : '') },
                h('h3', null, h('button', { type: 'button', id: sectionId + '-toggle', className: 'nf-section-toggle', 'aria-expanded': open, 'aria-controls': sectionId, onClick: () => setActiveSection(open ? '' : section) }, h('span', { className: 'nf-section-title' }, section), h('span', { className: 'nf-section-count' }, `${complete}/${sectionFields.length} terisi`), h('span', { className: 'nf-chevron', 'aria-hidden': true }, open ? '−' : '+'))),
                open && h('div', { id: sectionId, className: 'nf-section-body', role: 'region', 'aria-labelledby': sectionId + '-toggle' }, h('div', { className: 'nf-fields' }, pageFields.map(renderField)),
                  totalPages > 1 && h('div', { className: 'nf-section-pagination', 'aria-label': 'Halaman isian ' + section },
                    h('button', { type: 'button', disabled: page === 0, onClick: () => { setSectionPages(previous => ({ ...previous, [section]: page - 1 })); setPendingSectionFocus(sectionId + '-toggle'); } }, 'Isian sebelumnya'),
                    h('span', { role: 'status' }, `Bagian ${page + 1} dari ${totalPages}`),
                    h('button', { type: 'button', disabled: page === totalPages - 1, onClick: () => { setSectionPages(previous => ({ ...previous, [section]: page + 1 })); setPendingSectionFocus(sectionId + '-toggle'); } }, 'Isian berikutnya')),
                  page === totalPages - 1 && index < sections.length - 1 && h('button', { type: 'button', className: 'nf-section-next', onClick: () => { setActiveSection(sections[index + 1]); setPendingSectionFocus(`nf-section-${index + 1}-toggle`); } }, 'Lanjut ke bagian berikutnya')));
            })),
          h('details', { className: 'nf-images-disclosure', open: imagesOpen, onToggle: event => setImagesOpen(event.currentTarget.open) }, h('summary', null, 'Logo, stempel, dan kop surat', h('span', null, 'Opsional')), imageFields()),
          h('footer', { className: 'nf-edit-actions' }, h('div', { className: 'nf-draft-note' }, h('p', null, draftNote), h('p', { className: 'nf-count', role: 'status' }, dirty ? 'Ada perubahan yang belum disimpan.' : 'Isian siap diperiksa.')), h('div', { className: 'nf-action-buttons' }, saveButton, h('button', { type: 'button', disabled: !!busy, className: 'nf-primary', onClick: openReview }, busy === 'preview' ? 'Menyiapkan pratinjau…' : 'Pratinjau')))) :
          h('div', { className: 'nf-review' },
            h('div', { className: 'nf-review-topbar' }, h('div', null, h('h2', { ref: reviewHeadingRef, tabIndex: -1 }, 'Periksa dokumen'), h('p', null, 'Periksa isi dan lampiran sebelum mengunduh.')), h('button', { type: 'button', onClick: returnToEditor }, 'Kembali ke isian')),
            h('div', { className: 'nf-review-layout' },
              h('section', { className: 'nf-preview-stage', 'aria-label': 'Pratinjau dokumen', 'aria-busy': busy === 'preview' }, preview ? h('iframe', { title: 'Pratinjau dokumen beserta lampiran', src: preview }) : h('div', { className: 'nf-preview-placeholder', role: 'status' }, h('strong', null, busy === 'preview' ? 'Menyiapkan pratinjau…' : 'Pratinjau belum tersedia'), h('p', null, busy === 'preview' ? 'Dokumen dan lampiran sedang disusun.' : 'Buat pratinjau kembali setelah memeriksa isian.'), h('button', { type: 'button', disabled: !!busy, onClick: () => produce('pdf', true) }, busy === 'preview' ? 'Menyiapkan pratinjau…' : 'Pratinjau'))),
              h('aside', { className: 'nf-review-summary', 'aria-label': 'Ringkasan dokumen' },
                h('h3', null, 'Siap diunduh'), h('p', { className: 'nf-document-meta' }, group.label), h('strong', null, item.title),
                h('p', { className: 'nf-draft-note' }, draftNote), h('p', { className: 'nf-count' }, fields.length ? `${filledCount} dari ${fields.length} isian terisi. Lampiran sudah tergabung.` : 'Dokumen tanpa isian. Lampiran sudah tergabung.'), preview && h('a', { className: 'nf-open-pdf', href: preview, target: '_blank', rel: 'noopener noreferrer' }, 'Buka PDF penuh'),
                h('div', { className: 'nf-review-downloads' }, h('button', { type: 'button', disabled: !!busy, className: 'nf-primary', onClick: () => produce('word') }, busy === 'word' ? 'Membuat Word…' : 'Unduh Word dengan isian'), h('button', { type: 'button', disabled: !!busy, onClick: () => produce('pdf') }, busy === 'pdf' ? 'Membuat PDF…' : 'Unduh PDF')),
                h('div', { className: 'nf-review-save' }, saveButton, h('p', { className: 'nf-count', role: 'status' }, dirty ? 'Ada perubahan yang belum disimpan.' : 'Isian tetap bisa diubah sebelum diunduh.'), blankButton))))));
  };
}
