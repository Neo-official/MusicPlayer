function setup () {
	initializeServiceWorker();
	checkForInstallApp();
}

window.onload = () => setup();
window.ondrag;
window.ondrop;
window.ondrag;

function initializeServiceWorker () {
	if ('serviceWorker' in navigator) {
		// declaring scope manually
		navigator.serviceWorker.register('./sw.js', {scope: './'}).then(function (registration) {
			console.log('Service worker registration succeeded:', registration);
		}, /*catch*/ function (error) {
			console.log('Service worker registration failed:', error);
		});
	} else {
		console.log('Service workers are not supported.');
	}
}

function checkForInstallApp () {
	window.addEventListener('beforeinstallprompt', (event) => {
		// Prevent the mini-infobar from appearing on mobile.
		event.preventDefault();
		console.log('👍', 'beforeinstallprompt', event);
		// Stash the event so it can be triggered later.
		window.deferredPrompt = event;
		// Remove the 'hidden' class from the install button container.
		// divInstall.classList.toggle('hidden', false);
	});

	window.addEventListener('appinstalled', (event) => {
		console.log('👍', 'App Installed', event);
		// Clear the deferredPrompt so it can be garbage collected
		window.deferredPrompt = null;
	});
}

