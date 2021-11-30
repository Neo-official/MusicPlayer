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
		let {audio} = this,
		    play    = $('.play');

		audio.src      = '';
		audio.autoplay = false;
		audio.pause();
		audio.volume       = 0.5;
		audio.ontimeupdate = () => this.update();
		audio.onplay       = () => {
			$('.music').classList.add('playing');
			play.innerHTML = 'pause';
		};
		audio.onpause      = () => {
			$('.music').classList.remove('playing');
			play.innerHTML = 'play_arrow';
		};

		audio.onended = () => {
			this.next();
		};


		$('.next').onclick    = () => this.next();
		play.onclick          = () => this.togglePlayPause();
		$('.previus').onclick = () => this.pervius();
		$('.repeat').onclick  = () => this.repeat();
		$('.shuffle').onclick = () => this.shuffle();
		let menuList          = $('#menulist');
		$('#menu').onclick    = () => menuList.classList.toggle('show');


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

		//if list is empty then ready audio to play
		if (this.isListEmpty())
			this.audio.src = file.src;

		this.files.push(file);
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
		// check list is not empty
		if (!this.songs) return;

		if (this.isListStart())
			this.onListStart();

		if (this.isListEnded())
			this.onListEnded();

		let {audio, currentSong, paused} = this;

		if (this.isChange()) {
			audio.src = currentSong?.src || '';
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
		this.repeatMode = !this.repeatMode;

		this.audio.loop        = this.repeatMode;
		$('.repeat').innerHTML = this.repeatMode ? 'repeat_one' : 'repeat';
	}

	static shuffle () {
		this.shuffleMode = !this.shuffleMode;

		if (this.shuffleMode)
			shuffle(this.queue, true);
		else
			this.queue.sort((a, b) => a - b);

		// console.log(this.shuffleMode, this.queue);

		$('.shuffle').innerHTML = this.shuffleMode ? 'shuffle_on' : 'shuffle';
		this.currentSongIndex   = 0;
		this.onChange();
	}

	static updateAudioTime () {
		this.audio.currentTime = $('#seekbar').value / 100 * this.audio.duration;
	}

	static update () {
		let {audio, currentSong, currentSongIndex, songs, isSeeking} = this;

		let curtime = timeToClock(audio.currentTime);
		let durtime = timeToClock(audio.duration);

		$('.curtime').innerHTML = curtime;
		$('.durtime').innerHTML = durtime;
		$('.counter').innerHTML = (songs !== 0) * (currentSongIndex + 1) + '/' + songs;
		if (!isSeeking)
			$('#seekbar').value = (int(audio.currentTime) / int(audio.duration)) * 100 || 0;

		$('.title').innerHTML  = currentSong?.name || 'Unknown';
		$('.artist').innerHTML = (currentSong?.artist || 'Unknown') + ' - ' + (currentSong?.album || 'Unknown');

	}

}
