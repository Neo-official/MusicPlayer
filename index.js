let $ = id => document.querySelector(id);

function setup () {
	initializeServiceWorker();
	checkForInstallApp();
	initializeDragAndDrop();
	MusicPlayer.initialize();
}

window.onload = () => setup();

function initializeDragAndDrop () {
	window.ondragover = event => {
		event.preventDefault();
	};
	window.ondrag     = event => {
		console.log(event);
	};
	window.ondrop     = event => {
		// console.log(event);
		event.preventDefault();
		let {items, files} = event.dataTransfer;
		if (items) {
			// Use DataTransferItemList interface to access the file(s)
			for (let i = 0; i < items.length; i++) {
				// If dropped items aren't files, reject them
				if (items[i].kind === 'file') {
					MusicPlayer.addFile(items[i].getAsFile());
					// var file = items[i].getAsFile();
					// console.log('... file[' + i + '].name = ' + file.name);
				}
			}
		} else {
			// Use DataTransfer interface to access the file(s)
			for (let i = 0; i < files.length; i++) {
				MusicPlayer.addFile(files[i]);
				// console.log('... file[' + i + '].name = ' + files[i].name);
			}
		}
	};
}

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

class MusicPlayer {
	static audio            = new Audio("");
	static queue            = [];
	static currentSongIndex = 0;

	static initialize () {
		this.audio.src      = '';
		this.audio.autoplay = false;
		this.audio.pause();
		this.audio.ontimeupdate = () => this.update();


		$('.next').onclick    = () => this.next();
		$('.play').onclick    = () => this.togglePlayPause();
		$('.pervius').onclick = () => this.pervius();

		let seekBar = $('#seekbar');
		seekBar.min = 0;
		seekBar.max = 100;
	}

	static addFile (file) {
		file.src = URL.createObjectURL(file);
		if (this.songs === 0)
			this.audio.src = file.src;
		this.queue.push(file);
	}

	static isChange () {
		let {audio, currentSong} = this;
		if (audio.src !== currentSong.src) {
			audio.src    = currentSong.src;
			let {paused} = this;
			audio.pause();
			if (paused)
				this.play();

			return true;
		}

		return false;
	}

	static get songs () {
		return this.queue.length;
	}

	static get currentSong () {
		return this.queue[this.currentSongIndex];
	}

	static get paused () {
		return this.audio.paused;
	}

	static next () {
		this.currentSongIndex++;
		this.isChange();
	}

	static play () {
		$('.play').innerHTML = 'pause';
		return this.audio.play();
	}

	static pause () {
		$('.play').innerHTML = 'play_arrow';
		return this.audio.pause();
	}

	static pervius () {
		this.currentSongIndex--;
		this.isChange();
	}

	static togglePlayPause () {
		if (!this.songs) return;
		if (this.paused)
			this.play();
		else this.pause();
	}

	static update () {
		let {audio, currentSong} = this;

		let curtime = timeToClock(audio.currentTime);
		let durtime = timeToClock(audio.duration);

		$('.curtime').innerHTML = curtime;
		$('.durtime').innerHTML = durtime;

		$('#seekbar').value = (int(audio.currentTime) / int(audio.duration)) * 100;

		$('.title').innerHTML = currentSong.name;
		$('.artist').innerHTML = '';
	}

}

function int (number = 0) {
	return Math.floor(number) || 0;
}

function timeToClock (time = 0) {
	time    = int(time);
	let sec = int(time % 60);
	let min = int(time / 60);
	return (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
}