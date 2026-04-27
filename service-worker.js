self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    self.clients.claim();
});

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'NHAI Update', message: 'New message received' };
    self.registration.showNotification(data.title, {
        body: data.message,
        icon: '/assets/icon.png'
    });
});
