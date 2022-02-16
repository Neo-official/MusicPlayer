// import * as mmd from 'music-metadata-browser'
let DEFAULT_IMAGE = './img/0.png';
let DEFAULT_BLOB;
let $             = id => document.querySelector(id);

function setup () {
  initializeServiceWorker();
  checkForInstallApp();
  initializeDragAndDrop();
  initializeNotification();
  MusicPlayer.initialize();

  fetch(DEFAULT_IMAGE).then(r => DEFAULT_BLOB = r.blob());
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
	$('#menu-list').classList.remove('show');

	MusicPlayer.addFiles(files);
  };

  window.ondrop = event => {
	// console.log(event);
	event.preventDefault();
	let {files} = event.dataTransfer;
	$('.dropzone').classList.remove('show');
	$('#menu-list').classList.remove('show');

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
  }
  else {
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

/*
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
 }*/

function shuffle (array, copy = false) {
  return (copy ? array : [...array]).sort(() => Math.random() - 0.5);
}

function imageDataToBase64 (data = []) {
  data = data.map(x => String.fromCharCode(x)).join('');
  data = window.btoa(data);
  return data ? 'data:image/png;base64,' + data : DEFAULT_IMAGE;
}

function imageDataToBlob (data) {
  return data == null ? DEFAULT_BLOB : new Blob([data], {type: 'image/png'});
}

function blobToUrl (blob) {
  return typeof blob === "string" ? DEFAULT_IMAGE : URL.createObjectURL(blob);
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
	audio.volume = 0.15;

	audio.ontimeupdate = () => this.update();
	audio.oncanplay    = () => this.onload();
	audio.onplay       = () => this.onplay();
	audio.onpause      = () => this.onpause();
	audio.onended      = () => this.onended();

	let playList = $('#play-list');

	$('.next').onclick     = () => this.next();
	$('.forward').onclick  = () => this.seekforward(10);
	$('.play').onclick     = () => this.togglePlayPause();
	$('.backward').onclick = () => this.seekbackward(10);
	$('.previous').onclick = () => this.previous();
	$('.repeat').onclick   = () => this.repeat();
	$('.shuffle').onclick  = () => this.shuffle();
	$('#menu').onclick     = () => $('#menu-list').classList.toggle('show');
	$('#list').onclick     = () => playList.classList.toggle('show');

	let searchInput      = $('#search-list #search-input');
	$('#search').onclick = () => $('#search-list').classList.toggle('show');
	searchInput.onkeyup  = () => this.search(searchInput.value);

	playList.onscroll   = () => {
	  let elements = [...document.querySelectorAll('#play-list .song')].filter(song => (playList.scrollTop - 42) < song.offsetTop && !((playList.scrollTop - 42 + playList.parentElement.scrollHeight) < song.offsetTop));
	  for (const song of elements) {
		song.onscrolled();
	  }
	  console.log('scrolled', elements);
	};
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
	// check file type as audio/*
	if (!file.type.includes('audio'))
	  return;

	let {audio, songs, queue} = this;

	// file source doesn't exist, so we give them a source as Blob()
	file.src = URL.createObjectURL(file);

	setTimeout(() => {
	  new jsmediatags.Reader(file)
		.setTagsToRead(["title", "artist", "album", "picture"])
		.read({
		  onSuccess: tag => {
			// console.log(tag);
			let imageBlob = imageDataToBlob(tag.tags.picture?.data);
			let song      = new Media({
			  id      : this.length,
			  name    : file.name,
			  src     : file.src,
			  file    : file,
			  title   : tag.tags.title,
			  artist  : tag.tags.artist,
			  album   : tag.tags.album,
			  image   : imageBlob,
			  albumArt: blobToUrl(imageBlob)
			});
			//if list is empty then ready audio to play
			if (this.isListEmpty())
			  audio.src = song.src;

			songs.push(song);
			queue.push(this.length);

		  },
		  onError  : error => {
			let song = new Media({
			  id  : this.length,
			  name: file.name,
			  src : file.src,
			  file: file
			});
			//if list is empty then ready audio to play
			if (this.isListEmpty())
			  audio.src = song.src;

			songs.push(song);
			queue.push(this.length);

			console.log(':(', error.type, error.info);
		  }
		});
	}, 10);
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
	if (this.paused)
	  this.play();
	else this.pause();
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
	}
	else {
	  repeatElement.innerHTML = 'repeat';
	  repeatElement.classList.remove('on');
	}
  }

  static shuffle () {
	this.shuffleMode = !this.shuffleMode;

	if (this.shuffleMode)
	  shuffle(this.queue, true);
	else this.queue.sort((a, b) => a - b);

	// console.log(this.shuffleMode, this.queue);
	let shuffleElement = $('.shuffle');
	if (this.shuffleMode) {
	  shuffleElement.innerHTML = 'shuffle_on';
	  shuffleElement.classList.add('on');
	}
	else {
	  shuffleElement.innerHTML = 'shuffle';
	  shuffleElement.classList.remove('on');
	}
	this.currentSongIndex = 0;
	this.onChange();
  }

  static onload () {
	let {currentSong, audio} = this,
		durationTime         = timeToClock(audio.duration);

	currentSong.time = durationTime;

	$('.durationtime').innerHTML = durationTime;
	$('.title').innerHTML        = currentSong.title || 'Unknown';
	$('.artist').innerHTML       = (currentSong.artist || 'Unknown') + ' - ' + (currentSong.album || 'Unknown');
	if (currentSong.albumArt) {
	  $('.albumArt').style.backgroundImage             = 'url(' + currentSong.albumArt + ')';
	  $('.albumArt:not(.cover)').style.backgroundImage = 'url(' + currentSong.albumArt + ')';
	}
	else {
	  $('.albumArt').style.backgroundImage             = '';
	  $('.albumArt:not(.cover)').style.backgroundImage = '';
	}
	if ('mediaSession' in navigator)
	  navigator.mediaSession.metadata = currentSong.metaData;

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
	if (!isSeeking)
	  $('#seekbar').value = (int(audio.currentTime) / int(audio.duration)) * 100 || 0;

	if ('mediaSession' in navigator) {
	  navigator.mediaSession.setPositionState({
		duration    : audio.duration || 0,
		playbackRate: audio.playbackRate,
		position    : audio.currentTime || 0
	  });
	}
  }

  static search (value = '') {
	value = value.trim().toLowerCase();

	if (!value.length) return;

	console.log(value);
	let result =
		  this.songs.filter(song =>
			song.title.toLowerCase().includes(value) ||
			song.artist.toLowerCase().includes(value) ||
			song.album.toLowerCase().includes(value)
		  );

	let searchList = $('#search-list #result');

	searchList.innerHTML = '';
	if (result.length) {
	  searchList.classList.remove('empty');

	  for (const {elements: {song}} of result)
		searchList.appendChild(song);

	}
	else {
	  searchList.classList.add('empty');
	  searchList.innerHTML += 'No Result';
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
				 image = null,
				 albumArt = './img/0.png',
				 src = '',
				 file
			   }) {
	this.id       = id;
	this.name     = name;
	this.title    = title;
	this.artist   = artist;
	this.album    = album;
	this.image    = image;
	this.albumArt = albumArt;
	this.src      = src;
	this.file     = file;
	this.duration = 0;

	this.elements = this.initialize();

	if ('mediaSession' in navigator) {
	  this.metaData = new MediaMetadata({
		title  : this.title,
		artist : this.artist,
		album  : this.album,
		artwork: [
		  {src: this.albumArt, sizes: '96x96', type: 'image/png'},
		  {src: this.albumArt, sizes: '128x128', type: 'image/png'},
		  {src: this.albumArt, sizes: '192x192', type: 'image/png'},
		  {src: this.albumArt, sizes: '256x256', type: 'image/png'},
		  {src: this.albumArt, sizes: '384x384', type: 'image/png'},
		  {src: this.albumArt, sizes: '512x512', type: 'image/png'}
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

	elements.song.onclick    = () => {
	  MusicPlayer.currentSongIndex = this.id;
	  MusicPlayer.onChange();
	  $('#play-list').classList.remove('show');
	  $('#search-list').classList.remove('show');
	  MusicPlayer.play();
	};
	elements.song.onscrolled = () => {
	  elements.albumArt.style.backgroundImage = 'url(' + this.albumArt + ')';
	};

	elements.title.innerHTML    = this.title;
	elements.artist.innerHTML   = this.artist + '-' + this.album;
	elements.duration.innerHTML = this.duration;

	let playList = $('#play-list');

	if (playList.offsetTop <= elements.song.offsetTop)
	  elements.song.onscrolled();

	playList.appendChild(songElement);
	return elements;
  }
}
