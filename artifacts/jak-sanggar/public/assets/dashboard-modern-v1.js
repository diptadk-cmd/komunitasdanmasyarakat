document.body.classList.add('jak-modern');
let lastRoute='';
const status=document.createElement('div');status.className='jak-sync-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
function refresh(){
 const main=document.querySelector('main');
 const login=document.querySelector('[data-testid="input-username"]');
 const wrapper=login?.closest('.min-h-screen');if(wrapper)wrapper.dataset.jakLogin='true';
 if(!main){status.remove();return;}
 if(!status.isConnected)document.body.append(status);
 let pending=0;try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('jaksanggar_sync_outbox_v1:'))continue;const value=JSON.parse(localStorage.getItem(key)||'[]');pending+=Array.isArray(value)?value.length:0;}}catch{}
 const label=!navigator.onLine?'Offline · perubahan menunggu koneksi':pending?`${pending} perubahan menunggu server`:'Terhubung ke server';
 if(status.textContent!==label)status.textContent=label;status.dataset.pending=String(!navigator.onLine||pending>0);
 if(lastRoute!==location.pathname){document.querySelectorAll('.jak-dashboard-art').forEach(e=>e.remove());lastRoute=location.pathname;}
 const heading=main.querySelector('h1,h2');
 if(heading&&/^(Dasbor|Dashboard|Beranda)/i.test(heading.textContent.trim())&&!main.querySelector('.jak-dashboard-art')){
  const figure=document.createElement('figure');figure.className='jak-dashboard-art';
  const img=document.createElement('img');img.src='/assets/dashboard-betawi-20260910.png';img.alt='Ilustrasi modern kesenian Betawi, ondel-ondel, dan tari';img.width=1991;img.height=790;
  const caption=document.createElement('figcaption');const small=document.createElement('small');small.textContent='Jak Sanggar';caption.append(small,document.createTextNode('Ruang tumbuh seni dan budaya.'));
  figure.append(img,caption);
  const host=main.querySelector('.page-enter')||main;host.prepend(figure);
 }
}
setInterval(refresh,1200);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);refresh();
