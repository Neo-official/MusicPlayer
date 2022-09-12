// import * as mmd from 'music-metadata-browser'
// noinspection JSUnresolvedFunction,JSUnresolvedVariable

let DEFAULT_IMAGE = './img/0.jpg';
let DEFAULT_BLOB;
let $             = id => document.querySelector(id);

function setup () {
  initializeServiceWorker();
  checkForInstallApp();
  initializeDragAndDrop();
  initializeNotification();
  MusicPlayer.initialize();

  fetch(DEFAULT_IMAGE).then(async r => DEFAULT_BLOB = await r.blob());
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

function getItem (item) {
  return JSON.parse(window.localStorage.getItem(item));
}

function setItem (item, value) {
  return window.localStorage.setItem(item, JSON.stringify(value));
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

function dataURItoBlob (dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  const byteString = atob(dataURI.split(',')[1]);
  // separate out the mime component
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  const ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (let i = 0; i < byteString.length; i++) {
	ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  return new Blob([ab], {type: mimeString});

}

function imageDataToBlob (data) {
  return data == null ? DEFAULT_BLOB : dataURItoBlob(imageDataToBase64(data));
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

	const playList   = $('#play-list');
	const searchList = $('#search-list');

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
	$('#search').onclick = () => searchList.classList.toggle('show');
	searchInput.onkeyup  = () => this.search(searchInput.value);

	playList.onscroll = (event) => {
	  if (event === null || event === undefined) return false;
	  event && event.preventDefault();
	  const list   = event.target;
	  let padding  = 128;
	  let songs    = [...list.querySelectorAll('.song')];
	  let elements = songs.filter(song => (list.scrollTop - padding) < song.offsetTop && !((list.scrollTop + padding + list.parentElement.scrollHeight) < song.offsetTop));
	  for (const song of elements) {
		song.onscrolled();
	  }
	  elements = songs.filter(song => !elements.includes(song));
	  for (const song of elements) {
		song.onunscrolled();
	  }
	  // console.log('scrolled', elements);
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

  static addFiles (files = []) {
	files = [...files];

	let {audio, songs, queue} = this;

	const _songs = getItem('songs') || [];

	const loadNextFile = () => {
	  if (!files.length)
		this.sort((a, b) => songs[b].file.lastModified - songs[a].file.lastModified);

	  main().then(r => r);
	};

	const createSong = props => {
	  props = {...props, ...(_songs.find(song => song.name === props.name) || {})};

	  const song = songs.find(song => song.name === props.name);
	  if (song || props.isDeleted) {
		console.warn(`${props.name} song ${props.isDeleted ? 'deleted :)' : 'already on the list'}`);
	  }
	  else {
		const song = new Media(props);

		//if list is Empty then ready audio to play
		if (this.isListEmpty()) {
		  audio.src = song.src;
		  this.onChange();
		}

		songs.push(song);
		queue.push(this.length);
	  }

	  loadNextFile();
	};

	const main = async () => {
	  const file      = files.shift();
	  // error
	  const onError   = (error) => {
		createSong({
		  id  : this.length,
		  name: file.name,
		  src : file.src,
		  file: file
		});
		console.warn(':(', error.type, error.info);
	  };
	  // success
	  const onSuccess = (tag) => {
		// console.log(tag);
		const imageBlob = imageDataToBlob(tag.tags.picture?.data);
		createSong({
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

	  };

	  this.addFile(file, onSuccess, onError);
	};

	loadNextFile();
  }

  static addFile (file, onSuccess, onError) {
	// check file type as audio/*
	if (!file || !file.type.includes('audio'))
	  return;

	// file source doesn't exist, so we give them a source as Blob()
	if (!file.src)
	  file.src = URL.createObjectURL(file);

	new jsmediatags.Reader(file)
	  .setTagsToRead(["title", "artist", "album", "picture"])
	  .read({onSuccess, onError});

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
	this.audio.play().then(() => true);
	return true;
  }

  static pause () {
	return this.audio.pause();
  }

  static previous () {
	this.currentSongIndex--;
	this.onChange();
  }

  static togglePlayPause () {
	if (this.isListEmpty()) return $('#input-file').click();
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
	  repeatElement.textContent = 'repeat_one';
	  repeatElement.classList.add('on');
	}
	else {
	  repeatElement.textContent = 'repeat';
	  repeatElement.classList.remove('on');
	}
  }

  static shuffle () {
	this.shuffleMode = !this.shuffleMode;

	if (this.shuffleMode)
	  shuffle(this, true);
	else this.sort((a, b) => a - b);

	// console.log(this.shuffleMode, this.queue);
	let shuffleElement = $('.shuffle');
	if (this.shuffleMode) {
	  shuffleElement.textContent = 'shuffle_on';
	  shuffleElement.classList.add('on');
	}
	else {
	  shuffleElement.textContent = 'shuffle';
	  shuffleElement.classList.remove('on');
	}
	this.currentSongIndex = 0;
	this.onChange();
  }

  static onload () {
	let {currentSong, audio} = this,
		durationTime         = timeToClock(audio.duration);

	let cover        = $('#cover');
	let albumArt     = $('#albumArt');
	currentSong.time = durationTime;

	$('.durationtime').textContent = durationTime;
	$('.title').textContent        = currentSong.title || 'Unknown';
	$('.artist').textContent       = (currentSong.artist || 'Unknown') + ' - ' + (currentSong.album || 'Unknown');

	cover.textContent    = '';
	albumArt.textContent = '';

	cover.append(currentSong.image.cloneNode());
	albumArt.append(currentSong.image.cloneNode());

	if ('mediaSession' in navigator)
	  navigator.mediaSession.metadata = currentSong.metaData;

  }

  static onplay () {
	$('.music').classList.add('playing');
	$('.play').textContent = 'pause';
  }

  static onpause () {
	$('.music').classList.remove('playing');
	$('.play').textContent = 'play_arrow';
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

	$('.currenttime').textContent = timeToClock(audio.currentTime);
	$('.counter').textContent     = (length !== 0) * (currentSongIndex + 1) + '/' + length;
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

	if (!value.length) return false;

	// console.log(value);
	let result =
		  this.songs.filter(song =>
			song.title.trim().toLowerCase().includes(value) ||
			song.artist.trim().toLowerCase().includes(value) ||
			song.album.trim().toLowerCase().includes(value)
		  );

	let searchList = $('#result');

	searchList.textContent = '';
	if (result.length) {
	  searchList.classList.remove('empty');

	  for (const song of result) {
		song.elements.song.onscrolled();
		searchList.appendChild(song.elements.song.cloneNode(true));
	  }

	  return true;
	}
	else {
	  searchList.classList.add('empty');
	  searchList.textContent += 'No Result';
	}
	return false;
  }

  static sort (callback) {
	// console.log('resort');
	const {queue, songs} = this;
	const playList       = $('#play-list');
	// console.log(queue, songs.map(s=>s.id));
	queue.sort(callback);
	const nodes = queue.map(songId => songs[songId].elements.song);
	// console.log(queue);

	playList.textContent = '';
	playList.append(...nodes);

	playList.onscroll(undefined);
  }
}

// noinspection JSCheckFunctionSignatures
class Media {
  constructor ({
				 id = 0,
				 name,
				 title = name,
				 artist = 'Unknown',
				 album = 'Unknown',
				 image = null,
				 albumArt = DEFAULT_IMAGE,
				 src = '',
				 file,
				 isDeleted = false
			   }) {
	this.id         = id;
	this.name       = name;
	this.title      = title;
	this.artist     = artist;
	this.album      = album;
	this.image      = image;
	this.image      = new Image();
	this.albumArt   = albumArt;
	this.src        = src;
	this.file       = file;
	this.isDeleted  = isDeleted;
	this.duration   = 0;
	const audio     = new Audio(src);
	audio.oncanplay = () => this.time = timeToClock(audio.duration || 0);

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
	this.elements.duration.textContent = value;

	this.duration = value;
	return this.duration;
  }

  toJSON () {
	const {id, name, title, album, artist, albumArt, duration, isDeleted} = this;
	return {
	  id,
	  name,
	  title,
	  album,
	  artist,
	  albumArt,
	  duration,
	  isDeleted
	};
  }

  removeImage () {
	console.log(`(${this.name}) song Image removed`);
	this.albumArt = DEFAULT_IMAGE;
	return this.save();
  }

  remove () {
	console.log(`(${this.name}) song removed`);
	this.isDeleted = true;
	return this.save();
  }

  save () {
	console.log(`(${this.name}) song saved`);
	const songs = getItem('songs') || [];
	const song  = songs.find(s => s.name === this.name);
	// song = {...song, ...this};
	if (song) {
	  for (const key in song)
		if (song.hasOwnProperty(key))
		  song[key] = this[key];
	}
	else songs.push(this);

	setItem('songs', songs);
	return this;
  }

  initialize () {
	const songElement = $('.song').cloneNode(true);
	const playList    = $('#play-list');
	const elements    = {
	  song    : songElement,
	  title   : songElement.querySelector('.title'),
	  artist  : songElement.querySelector('.artist'),
	  duration: songElement.querySelector('.time'),
	  albumArt: songElement.querySelector('.albumArt')
	};
	elements.song.classList.add(this.id);
	this.image.src     = this.albumArt;
	this.image.onload  = () => {
	  if (elements.song.offsetTop <= playList.offsetHeight)
		elements.song.onscrolled();
	};
	this.image.loading = 'lazy';

	playList.prepend(songElement);

	elements.song.onclick = () => {
	  // console.log(this.id, MusicPlayer.currentSongIndex);
	  MusicPlayer.currentSongIndex = this.id;
	  // console.log(this.id, MusicPlayer.currentSongIndex);
	  MusicPlayer.onChange();
	  $('#play-list').classList.remove('show');
	  $('#search-list').classList.remove('show');
	  MusicPlayer.play();
	};

	elements.song.onscrolled   = () => {
	  elements.albumArt.textContent = "";
	  elements.albumArt.append(this.image);
	};
	elements.song.onunscrolled = () => {
	  elements.albumArt.textContent = "";
	};

	elements.title.textContent    = this.title;
	elements.artist.textContent   = this.artist + '-' + this.album;
	elements.duration.textContent = this.duration;

	return elements;
  }
}
