self.addEventListener('push', function (event) {
    if (event.data) {
        try {
            const data = event.data.json();
            event.waitUntil(
                self.registration.showNotification(data.title || 'EduTrack', {
                    body: data.body || '',
                    icon: data.icon || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="1em" font-size="80">🎓</text></svg>',
                    badge: data.badge || '',
                    data: data.data || { url: '/' }
                })
            );
        } catch (e) {
            // Push data is not JSON
            event.waitUntil(
                self.registration.showNotification('EduTrack', {
                    body: event.data.text(),
                    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="1em" font-size="80">🎓</text></svg>',
                    data: { url: '/' }
                })
            );
        }
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const urlToFocus = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('dashboard.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToFocus);
            }
        })
    );
});
