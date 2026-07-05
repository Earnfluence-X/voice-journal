// sw.js - Service Worker for PWA
const CACHE_NAME = 'voice-journal-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://placehold.co/192x192/6C63FF/FFFFFF?text=VJ',
    'https://placehold.co/512x512/6C63FF/FFFFFF?text=VJ'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});