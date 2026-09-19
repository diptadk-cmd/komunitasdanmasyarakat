export async function renderDocument(format, html, options={}) {
 const parsed=new DOMParser().parseFromString(html,'text/html');
 parsed.querySelectorAll('script,iframe,object,embed,base').forEach(e=>e.remove());
 await Promise.all([...parsed.images].map(async img=>{
  if(img.src.startsWith('data:'))return;
  const url=new URL(img.getAttribute('src'),location.origin);
  if(url.origin!==location.origin){throw new Error('Simpan logo atau gambar ke aplikasi sebelum membuat dokumen.');}
  const response=await fetch(url,{credentials:'same-origin'});
  if(!response.ok)throw new Error('Gambar dokumen gagal dimuat. Periksa logo pada profil.');
  const blob=await response.blob();
  img.src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
 }));
 const response=await fetch('/api/documents/render',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({format,html:'<!DOCTYPE html>'+parsed.documentElement.outerHTML,title:options.title,pageMarginsMm:options.pageMarginsMm,footer:options.footer})});
 if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||'Generator dokumen belum tersedia. Coba lagi.');}
 const blob=await response.blob();
 const name=String(options.fileName||options.title||'Dokumen').replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').trim().slice(0,120);
 const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${name}.${format==='word'?'docx':'pdf'}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return blob;
}
