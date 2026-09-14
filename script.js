/* =========================================================
   GANESH CHATHURTHI — DIGITAL TEMPLE
   script.js — vanilla JS, no dependencies
   ========================================================= */
(() => {
  'use strict';

  /* ---------- shared state ---------- */
  const state = {
    soundOn: localStorage.getItem('ganesh_sound') !== 'off',
    hasEntered: false,
    offerings: new Set(),
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  /* ---------- helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safePlay(audioEl) {
    if (!audioEl || !state.soundOn) return;
    try {
      audioEl.currentTime = audioEl.currentTime; // no-op guard
      const p = audioEl.play();
      if (p && p.catch) p.catch(() => { /* file missing or blocked — ignore quietly */ });
    } catch (e) { /* ignore */ }
  }

  /* =========================================================
     1. LOADING SCREEN
     ========================================================= */
  window.addEventListener('load', () => {
    const loader = $('#loading-screen');
    setTimeout(() => {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.style.display = 'none';
        $('#welcome-overlay').classList.remove('hidden');
      }, 850);
    }, 1600);
  });

  /* =========================================================
     2. WELCOME OVERLAY / ENTER CELEBRATION
     ========================================================= */
  const enterBtn = $('#enter-btn');
  const welcomeOverlay = $('#welcome-overlay');
  const bgAudio = $('#audio-bg');
  const bgVideoWrap = $('#video-wrap');
  const bgVideo = $('#bg-video');

  enterBtn.addEventListener('click', () => {
    state.hasEntered = true;
    welcomeOverlay.style.opacity = '0';
    setTimeout(() => welcomeOverlay.classList.add('hidden'), 500);

    // start background music
    if (state.soundOn) {
      bgAudio.muted = false;
      bgAudio.volume = 0.55;
      safePlay(bgAudio);
    }

    // reveal + start background video loop, muted-safe autoplay first
    bgVideoWrap.classList.remove('hidden');
    bgVideo.muted = false;
    const playPromise = bgVideo.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(() => {
        // fall back to muted autoplay, unmute on next interaction
        bgVideo.muted = true;
        bgVideo.play().catch(() => {});
        const unmuteOnce = () => { bgVideo.muted = !state.soundOn ? true : false; document.removeEventListener('click', unmuteOnce); };
        document.addEventListener('click', unmuteOnce, { once: true });
      });
    }

    initParticles(); // start particle animation only after entry (perf + gesture)
  });

  $('#video-close').addEventListener('click', () => {
    bgVideoWrap.classList.add('hidden');
    bgVideo.pause();
  });

  /* =========================================================
     3. SOUND TOGGLE (with localStorage)
     ========================================================= */
  const soundBtn = $('#sound-toggle');
  const soundIcon = $('#sound-icon');

  function refreshSoundIcon() {
    soundIcon.textContent = state.soundOn ? '🔊' : '🔇';
  }
  refreshSoundIcon();

  soundBtn.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    localStorage.setItem('ganesh_sound', state.soundOn ? 'on' : 'off');
    refreshSoundIcon();

    if (state.soundOn) {
      if (state.hasEntered) safePlay(bgAudio);
      bgVideo.muted = false;
    } else {
      bgAudio.pause();
      bgVideo.muted = true;
    }
  });

  /* =========================================================
     4. NAVIGATION — scroll style + mobile menu + smooth active link
     ========================================================= */
  const navbar = $('#navbar');
  const navToggle = $('#nav-toggle');
  const navLinks = $('#nav-links');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  $all('a[data-nav]').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });

  /* =========================================================
     5. CURSOR GLOW (desktop only)
     ========================================================= */
  const cursorGlow = $('#cursor-glow');
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    window.addEventListener('mousemove', (e) => {
      cursorGlow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
    }, { passive: true });
  }

  /* =========================================================
     6. SCROLL REVEAL for cards / sections
     ========================================================= */
  const revealTargets = $all('.glow-card, .glass-card, .offering-card, .ganesha-stage, .aarti-stage');
  revealTargets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealTargets.forEach(el => io.observe(el));

  /* =========================================================
     7. HERO FLOATING PETALS + DIYAS
     ========================================================= */
  function spawnHeroFloaters() {
    const layer = $('#hero-petals-diyas');
    const symbols = ['🌸', '🌺', '🪔', '✨'];
    const count = window.innerWidth < 700 ? 10 : 18;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      const isDiya = Math.random() > 0.7;
      el.className = isDiya ? 'mini-diya' : 'petal';
      el.textContent = symbols[isDiya ? 2 : Math.floor(Math.random() * 2)];
      const left = Math.random() * 100;
      const delay = Math.random() * 10;
      const duration = 10 + Math.random() * 8;
      el.style.left = left + '%';
      el.style.top = '-40px';
      el.style.animation = `petal-fall ${duration}s linear ${delay}s infinite`;
      layer.appendChild(el);
    }
  }
  // inject the keyframes for petal fall (kept in JS since positions are dynamic)
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes petal-fall {
      0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity:0; }
      8%   { opacity:1; }
      100% { transform: translateY(110vh) translateX(40px) rotate(280deg); opacity:0.15; }
    }
  `;
  document.head.appendChild(styleTag);
  spawnHeroFloaters();

  /* =========================================================
     8. AMBIENT PARTICLE SYSTEM (canvas)
     ========================================================= */
  const canvas = $('#particle-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rafId = null;
  let particleBoost = 0;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  const baseColors = ['#ffcf6e', '#ff8a3d', '#ff6ec7', '#a56dff', '#4fc3f7', '#4be3a0'];

  function makeParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.6 + Math.random() * 1.8,
      speed: 0.15 + Math.random() * 0.4,
      drift: (Math.random() - 0.5) * 0.3,
      color: baseColors[Math.floor(Math.random() * baseColors.length)],
      alpha: 0.25 + Math.random() * 0.55
    };
  }

  function initParticles() {
    if (rafId) return; // already running
    const count = window.innerWidth < 700 ? 26 : 55;
    particles = Array.from({ length: count }, makeParticle);
    loopParticles();
  }

  function loopParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const total = particleBoost > 0 ? [...particles, ...boostParticles] : particles;

    total.forEach(p => {
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (particleBoost > 0) {
      particleBoost--;
      boostParticles.forEach(p => { p.y -= p.speed; });
      boostParticles = boostParticles.filter(p => p.y > -20);
    }

    if (!document.hidden) {
      rafId = requestAnimationFrame(loopParticles);
    } else {
      rafId = null;
    }
  }

  let boostParticles = [];
  function burstParticles(x, y, count = 18) {
    for (let i = 0; i < count; i++) {
      boostParticles.push({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 60,
        r: 1 + Math.random() * 2.4,
        speed: 0.6 + Math.random() * 1.4,
        color: baseColors[Math.floor(Math.random() * baseColors.length)]
      });
    }
    particleBoost = 60;
    if (!rafId) loopParticles();
  }

  // pause/resume on tab visibility change (perf)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.hasEntered && !rafId) loopParticles();
  });

  /* =========================================================
     9. DIGITAL BLESSING
     ========================================================= */
  const nameInput = $('#name-input');
  const blessingBtn = $('#blessing-btn');
  const blessingWarning = $('#blessing-warning');
  const blessingCard = $('#blessing-card');
  const blessingTextEl = $('#blessing-text');
  const audioBell = $('#audio-bell');

  function buildBlessingMessage(name) {
    return `🙏 Dear ${name},\n\nMay Lord Ganesha bless you with wisdom,\ncourage, success and happiness.\n\nMay every obstacle become an opportunity\nand every dream become reality.\n\nGanpati Bappa Morya! 🐘✨`;
  }

  function typeText(el, text, speed = 22) {
    el.textContent = '';
    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    cursor.textContent = '\u00A0';
    el.appendChild(cursor);

    const timer = setInterval(() => {
      if (i < text.length) {
        cursor.insertAdjacentText('beforebegin', text[i]);
        i++;
      } else {
        clearInterval(timer);
        cursor.remove();
      }
    }, speed);
  }

  blessingBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      blessingWarning.classList.remove('hidden');
      nameInput.focus();
      setTimeout(() => blessingWarning.classList.add('hidden'), 3200);
      return;
    }
    blessingWarning.classList.add('hidden');
    blessingCard.classList.remove('hidden');
    typeText(blessingTextEl, buildBlessingMessage(name));
    safePlay(audioBell);
    const rect = blessingCard.getBoundingClientRect();
    burstParticles(rect.left + rect.width / 2, rect.top + 40, 24);
    blessingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') blessingBtn.click();
  });

  /* =========================================================
     10. INTERACTIVE GANESHA
     ========================================================= */
  const ganeshaTouch = $('#ganesha-touch');
  const ganeshaPulse = $('.ganesha-pulse');
  const ganeshaChant = $('#ganesha-chant');
  const offeringsRing = $('#ganesha-offerings');

  function triggerGaneshaBlessing() {
    safePlay(audioBell);
    ganeshaPulse.classList.remove('active');
    void ganeshaPulse.offsetWidth; // restart animation
    ganeshaPulse.classList.add('active');

    ganeshaChant.classList.remove('hidden');
    ganeshaChant.style.animation = 'none';
    void ganeshaChant.offsetWidth;
    ganeshaChant.style.animation = '';

    const rect = ganeshaTouch.getBoundingClientRect();
    burstParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, 26);

    setTimeout(() => ganeshaChant.classList.add('hidden'), 1800);
  }
  ganeshaTouch.addEventListener('click', triggerGaneshaBlessing);

  /* =========================================================
     11. DIGITAL POOJA — offerings
     ========================================================= */
  const offeringMeta = {
    flower: { emoji: '🌺', audio: '#audio-flower' },
    diya:   { emoji: '🪔', audio: '#audio-diya' },
    banana: { emoji: '🍌', audio: '#audio-offering' },
    modak:  { emoji: '🍬', audio: '#audio-offering' },
    durva:  { emoji: '🌿', audio: '#audio-offering' }
  };
  const offeringMessage = $('#offering-message');
  let offeringMsgTimer = null;

  function placeOfferingToken(type) {
    const meta = offeringMeta[type];
    const token = document.createElement('span');
    token.className = 'offering-token';
    token.textContent = meta.emoji;
    // place randomly around the ganesha ring
    const angle = Math.random() * Math.PI * 2;
    const radius = 42 + Math.random() * 12; // percent-ish
    token.style.left = `calc(50% + ${Math.cos(angle) * radius}% )`;
    token.style.top = `calc(50% + ${Math.sin(angle) * radius}% )`;
    offeringsRing.appendChild(token);
  }

  $all('.offering-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.offering;
      card.classList.add('selected');
      state.offerings.add(type);
      placeOfferingToken(type);
      safePlay($(offeringMeta[type].audio));

      offeringMessage.classList.remove('hidden');
      clearTimeout(offeringMsgTimer);
      offeringMsgTimer = setTimeout(() => offeringMessage.classList.add('hidden'), 2600);
    });
  });

  $('#clear-offerings').addEventListener('click', () => {
    state.offerings.clear();
    offeringsRing.innerHTML = '';
    $all('.offering-card').forEach(c => c.classList.remove('selected'));
    offeringMessage.classList.add('hidden');
  });

  /* =========================================================
     12. AARTI / DIVINE LIGHT
     ========================================================= */
  const aartiDiya = $('#aarti-diya');
  const aartiRays = $('.aarti-rays');
  const aartiText = $('#aarti-text');
  const audioAarti = $('#audio-aarti');

  aartiDiya.addEventListener('click', () => {
    const lighting = !aartiDiya.classList.contains('lit');
    aartiDiya.classList.toggle('lit', lighting);
    aartiRays.classList.toggle('lit', lighting);
    if (lighting) {
      aartiText.classList.remove('hidden');
      safePlay(audioAarti);
      document.body.style.setProperty('--ink', '#33163f');
      const rect = aartiDiya.getBoundingClientRect();
      burstParticles(rect.left + rect.width / 2, rect.top, 20);
    } else {
      aartiText.classList.add('hidden');
      document.body.style.setProperty('--ink', '#1a0f2e');
    }
  });

})();
