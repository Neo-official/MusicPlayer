var files = [
	'./',
	'./index.html',
	'./index.js',
	'./css/style.css',
	'./css/raleway.css',
	'./css/material-icons.css',
	'./fonts/material-icons-Round.woff2',
	'./fonts/Raleway.woff2',
	'./img/0.png',
	'./manifest.json',
	'./icons/icon-512.png',
	'./icons/icon-256.png',
	'./icons/icon-128.png',
	'./icons/icon-96.png',
	'./icons/icon-72.png',
	'./icons/icon-64.png',
];

self.addEventListener('activate', function (event) {
	// Delete all caches that aren't named in CURRENT_CACHES.
	// While there is only one cache in this example, the same logic will handle the case where
	// there are multiple versioned caches.
	var expectedCacheNamesSet = new Set(...files);
	event.waitUntil(
		caches.keys().then(function (cacheNames) {
			return Promise.all(
				cacheNames.map(function (cacheName) {
					if (!expectedCacheNamesSet.has(cacheName)) {
						// If this cache name isn't present in the set of "expected" cache names, then delete it.
						console.log('Deleting out of date cache:', cacheName);
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
});

self.addEventListener('install', (e) => {
	e.waitUntil(
		caches.open('Music Player').then((cache) => cache.addAll(files)),
	);
});

self.addEventListener('fetch', function (event) {
	console.log('Handling fetch event for', event.request.url);

	event.respondWith(
		caches.open('Music Player').then(function (cache) {
			return cache.match(event.request).then(function (response) {
				if (response) {
					// If there is an entry in the cache for event.request, then response will be defined
					// and we can just return it. Note that in this example, only font resources are cached.
					console.log(' Found response in cache:', response);

					return response;
				}

				// Otherwise, if there is no entry in the cache for event.request, response will be
				// undefined, and we need to fetch() the resource.
				console.log(' No response for %s found in cache. About to fetch ' +
					'from network...', event.request.url);

				// We call .clone() on the request since we might use it in a call to cache.put() later on.
				// Both fetch() and cache.put() "consume" the request, so we need to make a copy.
				// (see https://developer.mozilla.org/en-US/docs/Web/API/Request/clone)
				return fetch(event.request.clone()).then(function (response) {
					console.log('  Response for %s from network is: %O',
						event.request.url, response);

					if (response.status < 400 &&
						response.headers.has('content-type') &&
						response.headers.get('content-type')) {
						// We call .clone() on the response to save a copy of it to the cache. By doing so, we get to keep
						// the original response object which we will return back to the controlled page.
						// (see https://developer.mozilla.org/en-US/docs/Web/API/Request/clone)
						console.log('  Caching the response to', event.request.url);
						cache.put(event.request, response.clone());
					} else {
						console.log('  Not caching the response to', event.request.url);
					}

					// Return the original response object, which will be used to fulfill the resource request.
					return response;
				});
			}).catch(function (error) {
				// This catch() will handle exceptions that arise from the match() or fetch() operations.
				// Note that a HTTP error response (e.g. 404) will NOT trigger an exception.
				// It will return a normal response object that has the appropriate error code set.
				console.error('  Error in fetch handler:', error);

				throw error;
			});
		})
	);
});