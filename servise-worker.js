// Increment this CACHE_NAME any time you change your static files (HTML, CSS, JS, images, manifest)
const CACHE_NAME = 'my-pwa-cache-v5'; // <-- IMPORTANT: INCREMENT THIS VERSION!
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/images/icon.png', // Ensure these paths match your actual icon files
    '/images/bell.png', // Ensure these paths match your actual icon files
    // Add any other static assets you want to cache here for offline access
];

// --- Install Event ---
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing Service Worker ...', event);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting()) // Activates the new service worker immediately
    );
});

// --- Activate Event ---
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating Service Worker ....', event);
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                // Delete old caches that are not the current CACHE_NAME
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim()) // Ensures the service worker takes control of clients immediately
    );
});

// --- Fetch Event (Offline Support Strategy: Cache-First, then Network) ---
self.addEventListener('fetch', (event) => {
    // For navigation requests (e.g., loading an HTML page), try network first, then fallback to cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // If network fails for navigation, return the cached index.html
                return caches.match('/index.html');
            })
        );
    } else {
        // For other assets (CSS, JS, images, etc.), try cache first, then network
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    if (response) {
                        return response; // Found in cache, return it
                    }
                    // If not in cache, try fetching from the network
                    return fetch(event.request).then(networkResponse => {
                        // Cache dynamic requests (e.g., new images loaded after initial cache)
                        return caches.open(CACHE_NAME).then(cache => {
                            // Only cache successful responses (status 200) and not opaque responses
                            if (networkResponse.status === 200 && networkResponse.type === 'basic') {
                                cache.put(event.request, networkResponse.clone());
                            }
                            return networkResponse;
                        });
                    }).catch(() => {
                        // If network fails and not in cache, you could serve a generic fallback image etc.
                        console.warn('[Service Worker] Fetch failed for:', event.request.url);
                        // For this example, we'll just let the request fail if not in cache and no network
                        // You could add specific fallbacks here for images, etc.
                        // Example: if (event.request.url.includes('.png')) { return caches.match('/images/offline.png'); }
                    });
                })
        );
    }
});

// --- Push Event (Push Notifications Receiver) ---
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push Received.');
    let notificationData = {};

    try {
        notificationData = event.data.json(); // Try to parse as JSON
    } catch (e) {
        // If not JSON, treat as plain text or default
        notificationData = {
            title: 'New Notification',
            body: event.data.text() || 'You have new content!',
            icon: '/images/icon.png' // Default icon if none provided
        };
    }

    const title = notificationData.title || 'My PWA Notification';
    const options = {
        body: notificationData.body || 'You have new content!',
        icon: notificationData.icon || '/images/icon.png', // Ensure this path matches your icon
        badge: '/images/icon.png', // Small icon shown in notification tray (Android)
        tag: notificationData.tag || 'pwa-notification', // Groups notifications, replaces previous with same tag
        data: notificationData.data || { url: '/' } // Custom data to pass to click event
    };

    // Show the notification
    event.waitUntil(self.registration.showNotification(title, options));
});

// --- Notification Click Event ---
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification click received.');
    event.notification.close(); // Close the notification after click

    // Get the URL to open from the notification's data, or default to home page
    const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                // If a window with the target URL is already open, focus it
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});