let $ = id => document.querySelector(id);

function setup () {
	initializeServiceWorker();
	checkForInstallApp();
	initializeDragAndDrop();
	MusicPlayer.initialize();
}

window.onload = () => setup();

function initializeDragAndDrop () {
	let inputFile              = document.getElementById('input-file');
	window.ondragover          = event => {
		event.preventDefault();
		$('.dropzone').classList.add('show');

	};
	$('.dropzone').ondragleave = event => {
		event.preventDefault();
		event.stopPropagation();
		$('.dropzone').classList.remove('show');
	};
	inputFile.onchange         = event => {
		// console.log(event);
		event.preventDefault();
		$('#menulist').classList.remove('show');
		let {files} = event.target;
		for (const file of files) {
			MusicPlayer.addFile(file);
			// console.log('... filename);
		}

	};
	window.ondrop              = event => {
		console.log(event);
		let {files} = event.dataTransfer;
		$('.dropzone').classList.remove('show');

		// Use DataTransfer interface to access the file(s)
		inputFile.files = files;

		event.preventDefault();

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

	let rnd,
	    i = array.length;
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
	static files            = [];
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


		$('.next').onclick    = () => this.next();
		$('.play').onclick    = () => this.togglePlayPause();
		$('.previus').onclick = () => this.pervius();
		$('.repeat').onclick  = () => this.repeat();
		$('.shuffle').onclick = () => this.shuffle();
		$('#menu').onclick    = () => $('#menulist').classList.toggle('show');
		$('#list').onclick    = () => $('#playlist').classList.toggle('show');


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
		let song = new Song({
			id  : this.songs,
			name: file.name,
			src : file.src,
			file: file
		});
		//if list is empty then ready audio to play
		if (this.isListEmpty())
			this.audio.src = song.src;

		this.files.push(song);
		this.queue.push(this.files.length - 1);
	}

	static isListEmpty () {
		return !this.songs;
	}

	static isListEnded () {
		return this.songs - 1 <= this.currentSongIndex;
	}

	static onListEnded () {
		return this.currentSongIndex = this.songs - 1;
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

		if (this.isListEmpty())
			return false;

		if (this.isListStart())
			this.onListStart();

		if (this.isListEnded())
			this.onListEnded();

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
		this.onChange();
	}

	static play () {
		return this.audio.play();
	}

	static pause () {
		return this.audio.pause();
	}

	static pervius () {
		this.currentSongIndex--;
		this.onChange();
	}

	static togglePlayPause () {
		if (this.isListEmpty()) return;
		if (this.paused)
			this.play();
		else this.pause();
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

		if (this.shuffleMode)
			shuffle(this.queue, true);
		else
			this.queue.sort((a, b) => a - b);

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
		    durtime              = timeToClock(audio.duration);

		currentSong.time = durtime;

		$('.durtime').innerHTML = durtime;
		$('.title').innerHTML   = currentSong.name || 'Unknown';
		$('.artist').innerHTML  = (currentSong.artist || 'Unknown') + ' - ' + (currentSong.album || 'Unknown');

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

	static updateAudioTime () {
		if (this.isListEmpty()) return;
		this.audio.currentTime = $('#seekbar').value / 100 * this.audio.duration;
	}

	static update () {
		let {audio, currentSongIndex, songs, isSeeking} = this;

		$('.curtime').innerHTML = timeToClock(audio.currentTime);
		$('.counter').innerHTML = (songs !== 0) * (currentSongIndex + 1) + '/' + songs;
		if (!isSeeking)
			$('#seekbar').value = (int(audio.currentTime) / int(audio.duration)) * 100 || 0;

	}

}

class Song {
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
	}

	set time (value) {
		this.elements.time.innerHTML = value;

		this.duration = value;
		return this.duration;
	}

	initialize () {
		let songElement = $('.song').cloneNode(true);
		let elements    = {
			song    : songElement,
			title   : songElement.querySelector('.title'),
			artist  : songElement.querySelector('.artist'),
			time    : songElement.querySelector('.time'),
			albumArt: songElement.querySelector('.albumArt')
		};

		elements.song.onclick     = () => {
			MusicPlayer.currentSongIndex = this.id;
			MusicPlayer.onChange();
			$('#playlist').classList.remove('show');
		};
		elements.title.innerHTML  = this.title;
		elements.artist.innerHTML = this.artist + '-' + this.album;
		elements.time.innerHTML   = this.duration;

		elements.albumArt.style.backgroundImage = 'url(' + this.albumArt + ')';
		$('#playlist').appendChild(songElement);
		return elements;
	}
}
