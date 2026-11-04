const CACHE = 'autohelp-pwa-v4';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (new URL(request.url).pathname.startsWith('/.netlify/')) return;
  if (request.headers.has('authorization') || request.headers.has('range')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/',copy)))}return response}).catch(() => caches.match('/')));
    return;
  }
  if (SHELL.includes(new URL(request.url).pathname)) {
    event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}return response}).catch(()=>caches.match(request)));
  }
});

self.addEventListener('push',event=>{
 let payload={title:'AutoHelp AI',body:'Проверь обслуживание автомобиля.'};
 try{const data=event.data?.json();if(data&&typeof data==='object')payload=data}catch{}
 const title=String(payload.title||'AutoHelp AI').slice(0,90);
 const body=String(payload.body||'Проверь обслуживание автомобиля.').slice(0,250);
 event.waitUntil(self.registration.showNotification(title,{body,icon:'/icons/icon.svg',badge:'/icons/icon.svg',tag:'autohelp-maintenance',data:{url:'/'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
 const existing=clients.find(c=>new URL(c.url).origin===self.location.origin);
 if(existing){await existing.focus();return}
 return self.clients.openWindow('/');
 }));
});
