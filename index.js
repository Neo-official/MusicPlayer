let $ = id => document.querySelector(id);

function setup () {
	initializeServiceWorker();
	checkForInstallApp();
	initializeDragAndDrop();
	MusicPlayer.initialize();
}

window.onload = () => setup();

function initializeDragAndDrop () {
	window.ondragover         = event => {
		event.preventDefault();
		$('.dropzone').classList.add('show');

	};
	window.ondrag             = event => {
		console.log(event);
	};
	$('#input-file').onchange = window.ondrop = event => {
		console.log(event);
		event.preventDefault();
		if (!event.dataTransfer) {
			let {files} = event.target;
			for (let i = 0; i < files.length; i++) {
				MusicPlayer.addFile(files[i]);
				// console.log('... file[' + i + '].name = ' + files[i].name);
			}

			return true;
		}
		$('.dropzone').classList.remove('show');
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
	static files            = [];
	static currentSongIndex = 0;
	static isSeeking        = false;

	static initialize () {
		let {audio} = this,
		play = $('.play');

		audio.src      = '';
		audio.autoplay = false;
		audio.pause();
		audio.ontimeupdate = () => this.update();
		audio.onplay       = () => play.innerHTML = 'pause';
		audio.onpause       = () => play.innerHTML = 'play_arrow';


		$('.next').onclick    = () => this.next();
		play.onclick    = () => this.togglePlayPause();
		$('.previus').onclick = () => this.pervius();
		$('.repeat').onclick  = () => this.repeat();
		$('.shuffle').onclick = () => this.shuffle();

		let seekBar         = $('#seekbar');
		seekBar.min         = 0;
		seekBar.max         = 100;
		let mouseIsDown     = false;
		seekBar.onmousedown = () => mouseIsDown = true;
		seekBar.onmouseup   = () => mouseIsDown = false;
		// seekBar.onchange = () => this.updateAudioTime();
		seekBar.onmousemove = () => (this.isSeeking = mouseIsDown) && this.updateAudioTime();
	}

	static addFile (file) {
		file.src = URL.createObjectURL(file);

		if (this.songs === 0)
			this.audio.src = file.src;

		this.files.push(file);
		this.queue.push(this.files.length - 1);
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
		return this.files[this.queue[this.currentSongIndex]];
	}

	static get paused () {
		return this.audio.paused;
	}

	static next () {
		this.currentSongIndex++;
		this.isChange();
	}

	static play () {
		return this.audio.play();
	}

	static pause () {
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

	static repeat () {
		this.repeatMode = !this.repeatMode;

		this.audio.loop        = this.repeatMode;
		$('.repeat').innerHTML = this.repeatMode ? 'repeat_one' : 'repeat';
	}

	static shuffle () {
		this.shuffleMode = !this.shuffleMode;

		if (this.shuffleMode)
			shuffle(this.queue, true);
		else
			this.queue.sort((a, b) => b - a);

		$('.shuffle').innerHTML = this.shuffleMode ? 'shuffle_on' : 'shuffle';
	}

	static updateAudioTime () {
		this.audio.currentTime = $('#seekbar').value / 100 * this.audio.duration;
	}

	static update () {
		let {audio, currentSong, isSeeking} = this;

		let curtime = timeToClock(audio.currentTime);
		let durtime = timeToClock(audio.duration);

		$('.curtime').innerHTML = curtime;
		$('.durtime').innerHTML = durtime;
		if (isSeeking) return;
		$('#seekbar').value = (int(audio.currentTime) / int(audio.duration)) * 100;

		$('.title').innerHTML  = currentSong.name;
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

function shuffle (array, bool) {
	array = bool ? array : array.slice();

	let rnd,
	    length = array.length;
	while (length > 1) {
		rnd = int(Math.random() * length);

		swap(array[--length], array[rnd]);
	}

	return array;
}

function swap (a, b) {
	[a, b] = [b, a];
}