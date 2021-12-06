let $ = id => document.querySelector(id);

function setup () {
	initializeServiceWorker();
	checkForInstallApp();
	initializeDragAndDrop();
	initializeNotification();
	MusicPlayer.initialize();
}

window.onload = () => setup();

function initializeDragAndDrop () {
	let inputFile = $('#input-file');

	window.ondragover = event => {
		event.preventDefault();
		$('.dropzone').classList.add('show');

	};

	$('.dropzone').ondragleave = event => {
		event.preventDefault();
		event.stopPropagation();
		$('.dropzone').classList.remove('show');
	};

	inputFile.onchange = event => {
		// console.log(event);
		event.preventDefault();
		let {files} = event.target;
		if (!files.length) return;
		$('#menulist').classList.remove('show');

		MusicPlayer.addFiles(files);
	};

	window.ondrop = event => {
		// console.log(event);
		event.preventDefault();
		let {files} = event.dataTransfer;
		$('.dropzone').classList.remove('show');
		$('#menulist').classList.remove('show');

		MusicPlayer.addFiles(files);
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

function initializeNotification () {
	if ('mediaSession' in navigator) {
		navigator.mediaSession.setActionHandler('play', () => {
			navigator.mediaSession.playbackState = "playing";
			MusicPlayer.play();
		});
		navigator.mediaSession.setActionHandler('pause', () => {
			navigator.mediaSession.playbackState = "paused";
			MusicPlayer.pause();
		});
		navigator.mediaSession.setActionHandler('stop', () => {
			navigator.mediaSession.playbackState = "paused";
			MusicPlayer.stop();
		});
		navigator.mediaSession.setActionHandler('seekbackward', (details) => {
			MusicPlayer.seekbackward(details.seekOffset || 10);
		});
		navigator.mediaSession.setActionHandler('seekforward', (details) => {
			MusicPlayer.seekforward(details.seekOffset || 10);
		});
		navigator.mediaSession.setActionHandler('seekto', (details) => {
			let {audio} = MusicPlayer;
			if (details.fastSeek && 'fastSeek' in audio) {
				audio.fastSeek(details.seekTime);
				return;
			}
			MusicPlayer.updateAudioTime(details.seekTime);
		});
		navigator.mediaSession.setActionHandler('previoustrack', () => MusicPlayer.previous());
		navigator.mediaSession.setActionHandler('nexttrack', () => MusicPlayer.next());
		// navigator.mediaSession.setActionHandler('skipad', function () { /* Code excerpted. */ });
	}
}

function checkForInstallApp () {
	window.addEventListener('beforeinstallprompt', (event) => {
		// Prevent the mini-info-bar from appearing on mobile.
		event.preventDefault();
		console.log('👍', 'preinstallation', event);
		// Stash the event so it can be triggered later.
		window.deferredPrompt = event;
		// Remove the 'hidden' class from the installation button container.
		// divInstall.classList.toggle('hidden', false);
	});

	window.addEventListener('appinstalled', (event) => {
		console.log('👍', 'App Installed', event);
		// Clear the deferredPrompt so it can be garbage collected
		window.deferredPrompt = null;
	});
}

function int (number = 0) {
	return Math.floor(number) || 0;
}

function timeToClock (time = 0) {
	time    = int(time);
	let sec = int(time % 60);
	let min = int(time / 60);
	return min + ':' + (sec < 10 ? '0' : '') + sec;
}

function shuffle (array, bool) {
	array = bool ? array : array.slice();

	let rnd, i = array.length;
	while (1 < i--) {
		rnd = int(Math.random() * i);

		// swap a,b = b,a
		[array[i], array[rnd]] = [array[rnd], array[i]];
	}

	return array;
}

class MusicPlayer {
	static audio            = new Audio("");
	static queue            = [];
	static songs            = [];
	static currentSongIndex = 0;
	static isSeeking        = false;

	static initialize () {
		let {audio} = this;

		audio.src      = '';
		audio.autoplay = false;
		audio.pause();
		audio.volume       = 0.15;
		audio.ontimeupdate = () => this.update();
		audio.oncanplay    = () => this.oncanplay();
		audio.onplay       = () => this.onplay();
		audio.onpause      = () => this.onpause();
		audio.onended      = () => this.onended();


		$('.next').onclick     = () => this.next();
		$('.forward').onclick  = () => this.seekforward(10);
		$('.play').onclick     = () => this.togglePlayPause();
		$('.backward').onclick = () => this.seekbackward(10);
		$('.previous').onclick = () => this.previous();
		$('.repeat').onclick   = () => this.repeat();
		$('.shuffle').onclick  = () => this.shuffle();
		$('#menu').onclick     = () => $('#menulist').classList.toggle('show');
		$('#list').onclick     = () => $('#playlist').classList.toggle('show');


		let seekBar         = $('#seekbar');
		seekBar.min         = 0;
		seekBar.max         = 100;
		let mouseIsDown     = false;
		seekBar.onmousedown = () => mouseIsDown = true;
		seekBar.onmouseup   = () => mouseIsDown = false;
		// seekBar.onchange = () => this.updateAudioTime();
		seekBar.onmousemove = () => (this.isSeeking = mouseIsDown) && this.updateAudioTime(seekBar.value / 100 * this.audio.duration);
	}

	static addFiles (files) {
		for (const file of files) {
			this.addFile(file);
			// console.log('... file: ', file);
		}
	}

	static addFile (file) {

		if (!file.type.includes('audio'))
			return;

		let {audio, songs, queue} = this;

		file.src = URL.createObjectURL(file);

		let song = new Media({
			id: this.length, name: file.name, src: file.src, file: file
		});
		//if list is empty then ready audio to play
		if (this.isListEmpty()) audio.src = song.src;

		songs.push(song);
		queue.push(this.length);
	}

	static isListEmpty () {
		return !this.length;
	}

	static isListEnded () {
		return this.length - 1 <= this.currentSongIndex;
	}

	static onListEnded () {
		return this.currentSongIndex = this.length - 1;
	}

	static isListStart () {
		return this.currentSongIndex <= 0;
	}

	static onListStart () {
		return this.currentSongIndex = 0;
	}

	static isChange () {
		return this.audio.src !== (this.currentSong?.src || '');
	}

	static onChange () {

		if (this.isListEmpty()) return false;

		if (this.isListStart()) this.onListStart();

		if (this.isListEnded()) this.onListEnded();

		let {audio, currentSong, paused} = this;

		if (this.isChange()) {
			audio.src = currentSong.src || '';
			this.pause();

			if (!paused)
				this.play();

			return true;
		}

		return false;
	}

	static get length () {
		return this.queue.length;
	}

	/**
	 *
	 * @returns {Media}
	 */
	static get currentSong () {
		return this.songs[this.queue[this.currentSongIndex]];
	}

	static get paused () {
		return this.audio.paused;
	}

	static next () {
		this.currentSongIndex++;
		this.onChange();
	}

	static play () {
		return this.audio.play();
	}

	static pause () {
		return this.audio.pause();
	}

	static previous () {
		this.currentSongIndex--;
		this.onChange();
	}

	static togglePlayPause () {
		if (this.isListEmpty()) return;
		if (this.paused) this.play(); else this.pause();
	}

	static stop () {
		this.pause();
		this.audio.currentTime = 0;

	}

	static seekbackward (value) {
		this.audio.currentTime = this.audio.currentTime - value;
	}

	static seekforward (value) {
		this.audio.currentTime = this.audio.currentTime + value;
	}

	static repeat () {
		this.repeatMode   = !this.repeatMode;
		this.audio.loop   = this.repeatMode;
		let repeatElement = $('.repeat');
		if (this.repeatMode) {
			repeatElement.innerHTML = 'repeat_one';
			repeatElement.classList.add('on');
		} else {
			repeatElement.innerHTML = 'repeat';
			repeatElement.classList.remove('on');
		}
	}

	static shuffle () {
		this.shuffleMode = !this.shuffleMode;

		if (this.shuffleMode) shuffle(this.queue, true); else this.queue.sort((a, b) => a - b);

		// console.log(this.shuffleMode, this.queue);
		let shuffleElement = $('.shuffle');
		if (this.shuffleMode) {
			shuffleElement.innerHTML = 'shuffle_on';
			shuffleElement.classList.add('on');
		} else {
			shuffleElement.innerHTML = 'shuffle';
			shuffleElement.classList.remove('on');
		}
		this.currentSongIndex = 0;
		this.onChange();
	}

	static oncanplay () {
		let {currentSong, audio} = this,
		    durationTime = timeToClock(audio.duration);

		currentSong.time = durationTime;

		$('.durationtime').innerHTML = durationTime;
		$('.title').innerHTML        = currentSong.name || 'Unknown';
		$('.artist').innerHTML       = (currentSong.artist || 'Unknown') + ' - ' + (currentSong.album || 'Unknown');

		if ('mediaSession' in navigator) navigator.mediaSession.metadata = currentSong.metaData;

	}

	static onplay () {
		$('.music').classList.add('playing');
		$('.play').innerHTML = 'pause';
	}

	static onpause () {
		$('.music').classList.remove('playing');
		$('.play').innerHTML = 'play_arrow';
	}

	static onended () {
		this.next();
		this.play();
	}

	static updateAudioTime (value = 0) {
		if (this.isListEmpty()) return;
		let {audio} = this;

		if ('fastSeek' in audio) {
			audio.fastSeek(value);
			return;
		}
		audio.currentTime = value;
	}

	static update () {

		if (this.isListEmpty()) return;

		let {audio, currentSongIndex, length, isSeeking} = this;

		$('.currenttime').innerHTML = timeToClock(audio.currentTime);
		$('.counter').innerHTML     = (length !== 0) * (currentSongIndex + 1) + '/' + length;
		if (!isSeeking) $('#seekbar').value = (int(audio.currentTime) / int(audio.duration)) * 100 || 0;

		if ('mediaSession' in navigator) {
			navigator.mediaSession.setPositionState({
				duration: audio.duration || 0, playbackRate: audio.playbackRate, position: audio.currentTime || 0
			});
		}
	}

}

class Media {
	constructor ({
		             id = 0,
		             name,
		             title = name,
		             artist = 'Unknown',
		             album = 'Unknown',
		             albumArt = './img/0.png',
		             src = '',
		             file
	             }) {
		this.id       = id;
		this.name     = name;
		this.title    = title;
		this.artist   = artist;
		this.album    = album;
		this.albumArt = albumArt;
		this.src      = src;
		this.file     = file;
		this.duration = 0;

		this.elements = this.initialize();
		if ('mediaSession' in navigator) {
			this.metaData = new MediaMetadata({
				title: this.title, artist: this.artist, album: this.album, artwork: [
					{src: this.albumArt, sizes: '96x96', type: 'image/png'},
					{src: this.albumArt, sizes: '128x128', type: 'image/png'},
					{src: this.albumArt, sizes: '192x192', type: 'image/png'},
					{src: this.albumArt, sizes: '256x256', type: 'image/png'},
					{src: this.albumArt, sizes: '384x384', type: 'image/png'},
					{src: this.albumArt, sizes: '512x512', type: 'image/png'},
				]
			});
		}
	}

	set time (value) {
		this.elements.duration.innerHTML = value;

		this.duration = value;
		return this.duration;
	}

	initialize () {
		let songElement = $('.song').cloneNode(true);
		let elements    = {
			song    : songElement,
			title   : songElement.querySelector('.title'),
			artist  : songElement.querySelector('.artist'),
			duration: songElement.querySelector('.time'),
			albumArt: songElement.querySelector('.albumArt')
		};

		elements.song.onclick       = () => {
			MusicPlayer.currentSongIndex = this.id;
			MusicPlayer.onChange();
			$('#playlist').classList.remove('show');
		};
		elements.title.innerHTML    = this.title;
		elements.artist.innerHTML   = this.artist + '-' + this.album;
		elements.duration.innerHTML = this.duration;

		elements.albumArt.style.backgroundImage = 'url(' + this.albumArt + ')';
		$('#playlist').appendChild(songElement);
		return elements;
	}
}
