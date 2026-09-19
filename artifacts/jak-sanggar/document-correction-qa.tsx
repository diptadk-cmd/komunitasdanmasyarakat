import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import './src/index.css';
import {PagedDocumentPreview} from './src/components/dokumen/PagedDocumentPreview';
import {TEMPLATE_DOKUMEN, bentukById} from './src/lib/dokumen-admin';
import {rakitDokumenAdministrasi} from './src/lib/dokumen-administrasi-render';
import {bangunHtmlUnduhanDokumen, buatBlobDokumenWord, buatBlobDokumenPdf} from './src/lib/dokumen-export';
import {validasiFormDokumen} from './src/lib/dokumen-form';
import type {SanggarUser} from './src/lib/types';

const sg = {id:'qa-local',namaSanggar:'Sanggar Uji Dokumen',namaKetua:'Ketua Pengujian',alamat:'Jalan Contoh Nomor 10, Jakarta',wilayah:{provinsi:'DKI Jakarta'},legalitas:'Non Badan Hukum',nip:'123456789012345678'} as SanggarUser;
const nilai = {nomor:'001/UJI/IX/2026',keperluan:'pengujian format dokumen',periode:'2026–2029',susunanPengurus:'Ketua: Ketua Pengujian\nSekretaris: Sekretaris Pengujian\nBendahara: Bendahara Pengujian',tanggalPenetapan:'1 September 2026',namaInduk:'Organisasi Induk Pengujian',alamatInduk:'Jalan Induk Nomor 1, Jakarta',pimpinanInduk:'Pimpinan Pengujian',jabatanPimpinanInduk:'Ketua Organisasi Induk',tugasUnit:'Menyelenggarakan latihan dan pertunjukan seni.'};
const cases = ['keterangan-kedudukan','sk-pengurus','penetapan-unit'];
function App(){
 const [id,setId]=useState(cases[0]); const [status,setStatus]=useState('');
 const template=TEMPLATE_DOKUMEN.find(t=>t.id===id)!;
 const bodyHtml=rakitDokumenAdministrasi(template,{sg,bentuk:bentukById(id==='penetapan-unit'?'unit-non-bh':'mandiri-non-bh'),v:nilai});
 const options={title:'UJI '+template.judul,bodyHtml};
 const html=bangunHtmlUnduhanDokumen(options);
 const validation=validasiFormDokumen(template.fields,nilai,sg);
 async function download(format:'word'|'pdf'){
  setStatus('Membuat '+format);
  try {const blob=await (format==='word'?buatBlobDokumenWord(options):buatBlobDokumenPdf(options));
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`uji-${id}.${format==='word'?'docx':'pdf'}`;a.click();setStatus(`Berhasil ${format}: ${blob.size} byte`);}catch(e){setStatus(String(e));}
 }
 return <main style={{padding:20}}><h1>Uji koreksi dokumen — data sintetis</h1><label>Dokumen <select value={id} onChange={e=>setId(e.target.value)}>{cases.map(c=><option key={c}>{c}</option>)}</select></label><p>Validasi: {validation.lengkap?'lengkap':'belum lengkap'}</p><button onClick={()=>download('word')}>Unduh Word uji</button>{' '}<button onClick={()=>download('pdf')}>Unduh PDF uji</button><p role="status">{status}</p><PagedDocumentPreview documentHtml={html}/></main>
}
createRoot(document.getElementById('root')!).render(<App/>);
