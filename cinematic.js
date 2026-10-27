const video = document.querySelector('#film');
const surface = document.querySelector('#film-frame');
const paint = surface.getContext('2d', { alpha: false });
const poster = document.querySelector('#poster');
const status = document.querySelector('#load-status');
const loadText = document.querySelector('#load-text');
const motion = document.querySelector('#motion');
const retry = document.querySelector('#retry');
const word = document.querySelector('#room-word');
const sound = document.querySelector('#sound');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const journey = document.querySelector('#journey');
const about = document.querySelector('#about-space');
const bgm = document.querySelector('#bgm');
const debugEl = document.querySelector('#debug');

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };

let chapters = [];
let reduced = preference.matches;
let target = 0;
let current = 0;
let presented = 0;
let lastTime = 0;
let ready = false;
let loading = false;
let hasFrame = false;
let objectURL = null;
let aborter = null;
let fps = 24;
let frameCount = 1815;
let lastRequested = -1;
let lastRequestedTime = 0;
let firstRequest = true;
let frameCallback = null;
let pendingTime = 0;
let seekedCount = 0;
let lastSeekedTime = 0;
let rvfcCount = 0;
let slowSeeks = 0;
let timedOut = false;
let manifest = {
  duration: 75.625,
  fps: 24,
  frameCount: 1883,
  video: 'assets/walkthrough.mp4',
  posters: ['assets/poster-0.jpg'],
  chapters: null
};
let specs = [];

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines = value => String(value || '').split('<br>').map(escape).join('<br>');

function readScroll() {
  target = clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
}

function go(p) {
  scrollTo({ top: p * (document.documentElement.scrollHeight - innerHeight), behavior: reduced ? 'instant' : 'smooth' });
}

function setStatus(msg) {
  loadText.textContent = msg;
}
function bindStatic() {
  sound.addEventListener('click', () => {
    if (bgm.paused) {
      bgm.play().catch(() => {});
      sound.setAttribute('aria-pressed', 'true');
      sound.textContent = 'Tắt âm thanh';
    } else {
      bgm.pause();
      sound.setAttribute('aria-pressed', 'false');
      sound.textContent = 'Bật âm thanh';
    }
  });

  motion.addEventListener('click', () => setReduced(!reduced));

  preference.addEventListener('change', event => setReduced(event.matches));

  retry.addEventListener('click', () => {
    timedOut = false;
    slowSeeks = 0;
    if (ready) {
      lastRequested = -1;
      firstRequest = true;
      frameShown(video.currentTime);
    } else {
      load();
    }
  });

  about.querySelector('.close-dialog').onclick = () => about.close();
  about.addEventListener('click', event => {
    if (event.target === about) {
      const r = about.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) about.close();
    }
  });

  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', () => {
    readScroll();
    if (ready) frameShown(video.currentTime);
  });
  addEventListener('pointerup', prime);
  addEventListener('keydown', prime);
  addEventListener('pageshow', () => { if (ready) frameShown(video.currentTime); });
  addEventListener('pagehide', event => {
    if (!event.persisted) {
      aborter?.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    }
  });
}

function installChapters(items) {
  specs = items;
  journey.innerHTML = items.map((item, i) => {
    const tag = i === 0 ? 'h1' : 'h2';
    return `<article class="chapter${item.compact ? ' compact' : ''}" data-chapter="${i}" data-start="${item.start}"><p class="eyebrow">${escape(item.eyebrow)}</p><${tag}>${escape(item.title)}<br><em>${escape(item.accent)}</em></${tag}><p class="description">${lines(item.description)}</p>${i === 0 ? '<div class="scroll-cue"><span>↓</span> CUỘN ĐỂ BƯỚC VÀO</div>' : ''}${i === items.length - 1 ? '<div class="last-actions"><button id="about-button">VỀ CHÚNG TÔI</button><button id="restart">↺ ĐẦU</button></div>' : ''}</article>`;
  }).join('');
  chapters = [...document.querySelectorAll('.chapter')];

  const restartBtn = document.querySelector('#restart');
  if (restartBtn) restartBtn.onclick = () => { go(0); };

  const aboutButton = document.querySelector('#about-button');
  if (aboutButton) aboutButton.onclick = () => document.querySelector('#about-space').showModal();

  document.body.classList.add('full-tour');
  updateChapters(0);
}

function updateChapters(progress) {
  let activeIndex = 0;
  specs.forEach((s, i) => {
    if (progress >= (s.start || 0) - 0.02) activeIndex = i;
  });
  chapters.forEach((ch, i) => {
    ch.classList.toggle('active', i === activeIndex);
  });
  const spec = specs[activeIndex];
  if (spec && spec.word) {
    word.innerHTML = spec.word;
  }
  return activeIndex;
}

function frameShown(time) {
  try {
    if (video.videoWidth && (surface.width !== video.videoWidth || surface.height !== video.videoHeight)) {
      surface.width = video.videoWidth;
      surface.height = video.videoHeight;
    }
    paint.drawImage(video, 0, 0, surface.width, surface.height);
  } catch (e) { return; }
  presented = clamp(time / Math.max(0.001, video.duration - 1 / fps));
  hasFrame = true;
  surface.classList.add('ready');
  poster.classList.add('fade');
  status.hidden = true;
}

function observeFrame() {
  if (!('requestVideoFrameCallback' in video)) return;
  frameCallback = video.requestVideoFrameCallback((_, metadata) => {
    rvfcCount++;
    frameShown(metadata.mediaTime);
    observeFrame();
  });
}

video.addEventListener('loadedmetadata', () => {
  if (video.videoWidth) {
    surface.width = video.videoWidth;
    surface.height = video.videoHeight;
  }
  ready = true;
  fps = manifest.fps || fps;
  frameCount = manifest.frameCount || Math.round(video.duration * fps);
  lastRequested = -1;
  firstRequest = true;
  if ('requestVideoFrameCallback' in video && frameCallback === null) observeFrame();
});

video.addEventListener('loadeddata', () => {
  frameShown(video.currentTime);
});

video.addEventListener('seeked', () => {
  seekedCount++;
  lastSeekedTime = video.currentTime;
  const delay = performance.now() - pendingTime;
  slowSeeks = delay > 500 ? slowSeeks + 1 : 0;
  frameShown(video.currentTime);
  if (slowSeeks >= 15) useStills('Máy đang tua chậm · đang dùng ảnh theo chặng');
});

video.addEventListener('error', () => {
  ready = false;
  useStills('Trình duyệt chưa mở được clip. Thử tải lại.');
});

function useStills(message) {
  timedOut = true;
  surface.classList.remove('ready');
  poster.style.opacity = 1;
  setStatus(message);
  retry.hidden = false;
}

function prime() {
  if (reduced || !ready || hasFrame) return;
  try {
    video.play().then(() => {
      video.pause();
      lastRequested = -1;
      firstRequest = true;
    }).catch(() => {
      setStatus('Chạm vào trang để bắt đầu');
    });
  } catch (e) {
    setStatus('Chạm vào trang để bắt đầu');
  }
}

function setReduced(val) {
  reduced = val;
  motion.setAttribute('aria-pressed', String(val));
  motion.textContent = val ? 'Bật chuyển động' : 'Giảm chuyển động';
  document.documentElement.classList.toggle('reduced-motion', val);
  if (val) {
    current = target;
    if (ready) frameShown(video.currentTime);
  }
}

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - (lastTime || now)) / 1000, 0.1);
  lastTime = now;
  current = reduced ? target : current + (target - current) * (1 - Math.exp(-dt / 0.10));
  if (ready && !reduced && !timedOut) {
    const index = Math.min(frameCount - 1, Math.round(current * (frameCount - 1)));
    if (!video.seeking && (index !== lastRequested || firstRequest)) {
      firstRequest = false;
      lastRequested = index;
      pendingTime = performance.now();
      lastRequestedTime = Math.min(video.duration - 0.001, (index + 0.5) / fps);
      video.currentTime = lastRequestedTime;
    }
    if (video.seeking && performance.now() - pendingTime > 15000) {
      useStills('Tạm dừng ảnh tĩnh · bấm thử lại để tiếp tục');
    }
  }
  const progress = (reduced || timedOut) ? target : (hasFrame ? presented : current);
  if (debugEl) {
    const seekable = Array.from({length: video.seekable.length}, (_,i) => `${video.seekable.start(i).toFixed(1)}-${video.seekable.end(i).toFixed(1)}`).join(',') || 'none';
    const buffered = Array.from({length: video.buffered.length}, (_,i) => `${video.buffered.start(i).toFixed(1)}-${video.buffered.end(i).toFixed(1)}`).join(',') || 'none';
    debugEl.textContent =
      `ready=${ready} hasFrame=${hasFrame} timedOut=${timedOut}
` +
      `scrollY=${Math.round(scrollY)} sh=${document.documentElement.scrollHeight} ih=${innerHeight}
` +
      `target=${target.toFixed(3)} current=${current.toFixed(3)} presented=${presented.toFixed(3)}
` +
      `rs=${video.readyState} net=${video.networkState} dur=${(video.duration||0).toFixed(1)} seeking=${video.seeking}
` +
      `slowSeeks=${slowSeeks} lastReq=${lastRequested} lastReqTime=${lastRequestedTime.toFixed(2)} frameCount=${frameCount}
` +
      `seekedCount=${seekedCount} lastSeeked=${lastSeekedTime.toFixed(2)} rvfcCount=${rvfcCount}
` +
      `seekable=[${seekable}] buffered=[${buffered}]
` +
      (video.error ? `VIDEO ERROR: ${video.error.code} ${video.error.message}` : '');
  }
  document.body.classList.toggle('end-state', progress >= 0.92);
  updateChapters(progress);
  render(progress);
  
}

function render(progress) {
  if (hasFrame) {
    surface.classList.add('ready');
    poster.classList.add('fade');
  }
}

async function load() {
  if (loading) return;
  loading = true;
  setStatus('Đang chuẩn bị không gian…');
  retry.hidden = true;
  timedOut = false;
  slowSeeks = 0;

  try {
    const response = await fetch('manifest.json', { cache: 'no-cache' });
    if (response.ok) {
      manifest = await response.json();
    }
    if (manifest.chapters) installChapters(manifest.chapters);
    if (manifest.posters && manifest.posters[0]) poster.src = manifest.posters[0];
    fps = manifest.fps || fps;
    frameCount = manifest.frameCount || Math.round((manifest.duration || 75.625) * fps);
  } catch (e) {
    // keep defaults
  }

  if (objectURL) {
    URL.revokeObjectURL(objectURL);
    objectURL = null;
  }

  video.src = manifest.video || 'assets/walkthrough.mp4';
  video.load();
  loading = false;
}

addEventListener('error', e => {
  console.error('JS ERROR', e);
});
addEventListener('unhandledrejection', e => {
  console.error('PROMISE', e.reason);
});


async function init() {
  reduced = preference.matches;
  bindStatic();
  await load();
  readScroll();
  current = target;
  setReduced(reduced);
  requestAnimationFrame(tick);
}

init();

