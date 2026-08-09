/* Last Light — a self-contained canvas arcade shooter. No assets, build step or dependencies. */

(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const BEST_KEY = 'last-light-best';

  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = false;
  let paused = false;
  let gameOver = false;
  let lastTime = 0;
  let elapsed = 0;
  let wave = 1;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let health = 100;
  let waveKills = 0;
  let waveTarget = 12;
  let spawnClock = 0;
  let spawnGap = .84;
  let fireClock = 0;
  let shake = 0;
  let waveBannerTimer = 0;
  let toastTimer = 0;
  let combo = 0;
  let comboTimer = 0;
  let muted = false;
  let audioContext = null;
  let pointer = { x: .5, y: .77, down: false, active: false };
  const keys = new Set();
  const bullets = [];
  const enemies = [];
  const particles = [];
  const floaters = [];
  const powerups = [];
  const stars = [];

  const player = { x: .5, y: .84, targetX: .5, radius: 25, invuln: 0, muzzle: 0, move: 0 };

  const enemyTypes = {
    runner: { hp: 1, speed: 42, radius: 17, color: '#ff668e', accent: '#ffbfcc', score: 100, damage: 8 },
    striker: { hp: 2, speed: 31, radius: 21, color: '#a28cff', accent: '#e3dcff', score: 180, damage: 13 },
    brute: { hp: 5, speed: 18, radius: 31, color: '#ffbd62', accent: '#fff0bd', score: 420, damage: 25 },
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, rect.width);
    height = Math.max(500, rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!stars.length) for (let i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + .2, a: Math.random() * .65 + .15, drift: Math.random() * .08 + .02 });
  }

  function random(min, max) { return Math.random() * (max - min) + min; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function screenX(x) { return x * width; }
  function screenY(y) { return y * height; }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function fmt(value) { return String(Math.max(0, Math.floor(value))).padStart(6, '0'); }

  function startAudio() {
    if (muted) return;
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  }

  function beep(frequency, duration, type = 'sine', volume = .035) {
    if (muted || !audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(50, frequency * .58), audioContext.currentTime + duration);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function resetGame() {
    enemies.length = 0; bullets.length = 0; particles.length = 0; floaters.length = 0; powerups.length = 0;
    wave = 1; score = 0; health = 100; waveKills = 0; waveTarget = 12; spawnClock = .15; spawnGap = .84;
    shake = 0; combo = 0; comboTimer = 0; elapsed = 0; gameOver = false; paused = false;
    player.x = .5; player.targetX = .5; player.invuln = 0; player.muzzle = 0;
    updateHud();
    showScreen(null);
    announceWave();
  }

  function showScreen(id) {
    ['startScreen', 'pauseScreen', 'gameOverScreen'].forEach((screenId) => $(screenId).classList.toggle('screen--active', screenId === id));
  }

  function announceWave() {
    $('waveBanner').classList.add('show');
    $('bannerWave').textContent = `WAVE ${String(wave).padStart(2, '0')}`;
    $('bannerDetail').textContent = wave === 1 ? 'Hold to fire' : `${waveTarget} hostiles incoming`;
    waveBannerTimer = 2.4;
  }

  function updateHud() {
    $('score').textContent = fmt(score);
    $('best').textContent = fmt(Math.max(best, score));
    $('wave').textContent = String(wave).padStart(2, '0');
    $('healthText').textContent = `${Math.ceil(health)}%`;
    $('healthFill').style.width = `${clamp(health, 0, 100)}%`;
    $('healthFill').style.background = health < 30 ? 'linear-gradient(90deg,#ff527e,#ffaf70)' : 'linear-gradient(90deg,#59e5ff,#a5f8ff)';
  }

  function showToast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    toastTimer = 1.4;
  }

  function spawnEnemy() {
    const roll = Math.random();
    let kind = 'runner';
    if (wave >= 3 && roll > .79) kind = 'brute';
    else if (wave >= 2 && roll > .55) kind = 'striker';
    const type = enemyTypes[kind];
    const lane = Math.round(random(1, 8)) / 10;
    enemies.push({ kind, x: clamp(lane + random(-.04, .04), .1, .9), y: -.08, hp: type.hp + Math.floor(wave / 5), maxHp: type.hp + Math.floor(wave / 5), radius: type.radius / 650, wobble: random(0, TAU), phase: random(0, TAU), speed: type.speed * (1 + wave * .065), hit: 0, flash: 0 });
  }

  function spawnFormation() {
    const amount = Math.min(7, 3 + Math.floor(wave / 2));
    for (let i = 0; i < amount; i++) setTimeout(() => { if (running && !gameOver) spawnEnemy(); }, i * 90);
  }

  function aimAngle() {
    const dx = pointer.x - player.x;
    const dy = pointer.y - player.y;
    return Math.atan2(dy, dx);
  }

  function fire() {
    const angle = aimAngle();
    const speed = .98;
    bullets.push({ x: player.x + Math.cos(angle) * .035, y: player.y + Math.sin(angle) * .035, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.4, radius: .006, trail: [] });
    player.muzzle = .11;
    fireClock = .13;
    beep(270 + Math.random() * 40, .06, 'sawtooth', .018);
    for (let i = 0; i < 3; i++) particles.push({ x: player.x + Math.cos(angle) * .045, y: player.y + Math.sin(angle) * .045, vx: Math.cos(angle) * random(.1, .3) + random(-.12, .12), vy: Math.sin(angle) * random(.1, .3) + random(-.12, .12), life: .24, maxLife: .24, size: random(.004, .009), color: i === 0 ? '#fff5c9' : '#ff7097' });
  }

  function hitEnemy(enemy, bullet) {
    const type = enemyTypes[enemy.kind];
    enemy.hp--;
    enemy.hit = .1;
    enemy.flash = .1;
    burst(bullet.x, bullet.y, type.color, 4, .1);
    if (enemy.hp <= 0) destroyEnemy(enemy);
    else beep(130, .04, 'square', .012);
  }

  function destroyEnemy(enemy) {
    const type = enemyTypes[enemy.kind];
    const index = enemies.indexOf(enemy);
    if (index !== -1) enemies.splice(index, 1);
    combo = comboTimer > 0 ? combo + 1 : 1;
    comboTimer = 2;
    const multiplier = Math.min(5, combo);
    const earned = type.score * multiplier;
    score += earned;
    waveKills++;
    burst(enemy.x, enemy.y, type.color, enemy.kind === 'brute' ? 26 : 14, .38);
    floaters.push({ x: enemy.x, y: enemy.y, text: `+${earned}`, color: multiplier > 1 ? '#ffd36b' : '#fff', life: 1, vy: -.08 });
    if (multiplier > 1) floaters.push({ x: enemy.x, y: enemy.y - .035, text: `${multiplier}× COMBO`, color: '#59e5ff', life: 1, vy: -.05 });
    if (Math.random() < .1) powerups.push({ x: enemy.x, y: enemy.y, type: Math.random() < .6 ? 'heal' : 'overdrive', radius: .019, spin: 0, life: 8 });
    shake = Math.min(13, shake + (enemy.kind === 'brute' ? 7 : 2));
    beep(type.score > 300 ? 90 : 170, .09, 'square', .024);
    if (waveKills >= waveTarget) nextWave();
  }

  function nextWave() {
    wave++;
    waveKills = 0;
    waveTarget = 10 + wave * 4;
    spawnGap = Math.max(.27, .84 - wave * .045);
    health = clamp(health + 9, 0, 100);
    showToast(`WAVE CLEAR  +9% CORE REPAIR`);
    announceWave();
    beep(420, .16, 'triangle', .035);
  }

  function burst(x, y, color, count, life) {
    for (let i = 0; i < count; i++) {
      const angle = random(0, TAU);
      const speed = random(.08, .36);
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: random(life * .5, life), maxLife: life, size: random(.0025, .009), color });
    }
  }

  function damagePlayer(amount) {
    if (player.invuln > 0) return;
    health -= amount;
    player.invuln = .6;
    shake = Math.min(15, shake + 9);
    burst(player.x, player.y, '#ff5b8f', 18, .4);
    showToast(`CORE HIT  −${amount}%`);
    beep(72, .2, 'sawtooth', .04);
    updateHud();
    if (health <= 0) endGame();
  }

  function endGame() {
    gameOver = true;
    running = false;
    best = Math.max(best, score);
    localStorage.setItem(BEST_KEY, String(best));
    $('finalScore').textContent = fmt(score);
    $('finalWave').textContent = String(wave).padStart(2, '0');
    $('gameOverTitle').textContent = score >= best && score > 0 ? 'You found the signal.' : 'The light went out.';
    showScreen('gameOverScreen');
    beep(46, .5, 'sawtooth', .04);
  }

  function collectPowerup(powerup) {
    const index = powerups.indexOf(powerup);
    if (index !== -1) powerups.splice(index, 1);
    if (powerup.type === 'heal') { health = clamp(health + 18, 0, 100); showToast('CORE REPAIRED  +18%'); }
    else { player.overdrive = 5; showToast('OVERDRIVE  FIRE RATE UP'); }
    score += 75;
    burst(powerup.x, powerup.y, powerup.type === 'heal' ? '#59e5ff' : '#ffd36b', 16, .38);
    beep(680, .12, 'triangle', .03);
    updateHud();
  }

  function update(dt) {
    elapsed += dt;
    if (waveBannerTimer > 0) { waveBannerTimer -= dt; if (waveBannerTimer <= 0) $('waveBanner').classList.remove('show'); }
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
    if (shake > 0) shake = Math.max(0, shake - dt * 25);
    if (comboTimer > 0) comboTimer -= dt; else combo = 0;
    player.invuln = Math.max(0, player.invuln - dt);
    player.muzzle = Math.max(0, player.muzzle - dt);
    player.overdrive = Math.max(0, (player.overdrive || 0) - dt);

    const keyboardMove = (keys.has('a') || keys.has('arrowleft') ? -1 : 0) + (keys.has('d') || keys.has('arrowright') ? 1 : 0);
    if (keyboardMove) player.targetX = clamp(player.targetX + keyboardMove * dt * .62, .09, .91);
    player.x = lerp(player.x, clamp(player.targetX, .08, .92), Math.min(1, dt * 10));
    fireClock -= dt;
    if ((pointer.down || keys.has(' ')) && fireClock <= 0) { fire(); fireClock = player.overdrive > 0 ? .065 : .13; }

    spawnClock -= dt;
    if (spawnClock <= 0 && enemies.length < 28) { spawnFormation(); spawnClock = spawnGap * random(.75, 1.1); }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.trail.push({ x: bullet.x, y: bullet.y });
      if (bullet.trail.length > 6) bullet.trail.shift();
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
      let hit = false;
      for (const enemy of enemies) {
        if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.radius + .012) { hitEnemy(enemy, bullet); hit = true; break; }
      }
      if (hit || bullet.life <= 0 || bullet.x < -.1 || bullet.x > 1.1 || bullet.y < -.1 || bullet.y > 1.1) bullets.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      enemy.phase += dt * 3; enemy.y += enemy.speed * dt / height; enemy.x += Math.sin(enemy.phase) * dt * .018;
      enemy.hit = Math.max(0, enemy.hit - dt); enemy.flash = Math.max(0, enemy.flash - dt);
      if (enemy.y > player.y - .01) { enemies.splice(i, 1); damagePlayer(enemyTypes[enemy.kind].damage); }
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
      const powerup = powerups[i]; powerup.y += .022 * dt; powerup.spin += dt * 4; powerup.life -= dt;
      if (Math.hypot(powerup.x - player.x, powerup.y - player.y) < powerup.radius + .035 || powerup.life <= 0) { if (powerup.life > 0) collectPowerup(powerup); else powerups.splice(i, 1); }
    }

    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.y += f.vy * dt; f.life -= dt; if (f.life <= 0) floaters.splice(i, 1); }
    updateHud();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawBackdrop();
    ctx.save();
    if (shake > 0) ctx.translate(random(-shake, shake), random(-shake, shake));
    drawArena(); drawPowerups(); drawBullets(); drawEnemies(); drawPlayer(); drawParticles(); drawFloaters();
    ctx.restore();
    if (paused || !running) drawVignette();
  }

  function drawBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a1129'); gradient.addColorStop(.5, '#10182f'); gradient.addColorStop(1, '#050915');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    for (const star of stars) { const alpha = star.a * (.7 + Math.sin(elapsed * star.drift * 4 + star.x * 9) * .3); ctx.fillStyle = `rgba(157,194,255,${alpha})`; ctx.beginPath(); ctx.arc(star.x * width, ((star.y + elapsed * star.drift * .008) % 1) * height, star.r, 0, TAU); ctx.fill(); }
    const glow = ctx.createRadialGradient(width * .5, height * .2, 0, width * .5, height * .2, width * .75); glow.addColorStop(0, 'rgba(55, 106, 175, .23)'); glow.addColorStop(1, 'rgba(5, 8, 22, 0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height * .7);
  }

  function drawArena() {
    const leftTop = width * .32, rightTop = width * .68, leftBottom = width * .12, rightBottom = width * .88;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(leftTop, 0); ctx.lineTo(rightTop, 0); ctx.lineTo(rightBottom, height); ctx.lineTo(leftBottom, height); ctx.closePath();
    const arena = ctx.createLinearGradient(0, 0, 0, height); arena.addColorStop(0, 'rgba(44, 69, 121, .7)'); arena.addColorStop(1, 'rgba(15, 25, 52, .9)'); ctx.fillStyle = arena; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(113, 181, 235, .13)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 14; i++) { const t = i / 14; const y = t * height; ctx.beginPath(); ctx.moveTo(lerp(leftTop, leftBottom, t), y); ctx.lineTo(lerp(rightTop, rightBottom, t), y); ctx.stroke(); }
    for (let i = 0; i <= 10; i++) { const t = i / 10; ctx.beginPath(); ctx.moveTo(lerp(leftTop, rightTop, t), 0); ctx.lineTo(lerp(leftBottom, rightBottom, t), height); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(89, 229, 255, .45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(leftTop, 0); ctx.lineTo(leftBottom, height); ctx.moveTo(rightTop, 0); ctx.lineTo(rightBottom, height); ctx.stroke();
    // Bright threshold around the player base.
    ctx.strokeStyle = 'rgba(255, 91, 143, .38)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(width * .1, height * .865); ctx.lineTo(width * .9, height * .865); ctx.stroke();
  }

  function drawPlayer() {
    const x = screenX(player.x), y = screenY(player.y), angle = aimAngle();
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 65); glow.addColorStop(0, 'rgba(89,229,255,.22)'); glow.addColorStop(1, 'rgba(89,229,255,0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 65, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(89,229,255,.12)'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#59e5ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#baf7ff'; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-12, -17); ctx.lineTo(-6, 0); ctx.lineTo(-12, 17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#287b9b'; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-7, -9); ctx.lineTo(-3, 0); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = player.muzzle > 0 ? '#fff7c3' : '#ff5b8f'; ctx.shadowBlur = player.muzzle > 0 ? 28 : 10; ctx.shadowColor = '#ff5b8f'; ctx.beginPath(); ctx.arc(31, 0, player.muzzle > 0 ? 8 : 5, 0, TAU); ctx.fill();
    ctx.restore();
    if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0) { ctx.strokeStyle = '#ff5b8f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 35, 0, TAU); ctx.stroke(); }
  }

  function drawEnemies() {
    for (const enemy of enemies) {
      const type = enemyTypes[enemy.kind]; const x = screenX(enemy.x), y = screenY(enemy.y), r = enemy.radius * width;
      ctx.save(); ctx.translate(x, y); ctx.rotate(enemy.phase * .2);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4); glow.addColorStop(0, `${type.color}44`); glow.addColorStop(1, `${type.color}00`); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = enemy.flash > 0 ? '#fff' : type.color; ctx.strokeStyle = type.accent; ctx.lineWidth = 2;
      if (enemy.kind === 'brute') { ctx.beginPath(); ctx.roundRect(-r, -r * .8, r * 2, r * 1.6, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#442d3c'; ctx.fillRect(-r * .5, -r * .2, r, r * .4); }
      else { ctx.beginPath(); ctx.moveTo(r * 1.15, 0); ctx.lineTo(0, r * .88); ctx.lineTo(-r * 1.15, 0); ctx.lineTo(0, -r * .88); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#161c3c'; ctx.beginPath(); ctx.arc(0, 0, r * .36, 0, TAU); ctx.fill(); ctx.fillStyle = type.accent; ctx.beginPath(); ctx.arc(0, 0, r * .12, 0, TAU); ctx.fill(); }
      ctx.restore();
      if (enemy.maxHp > 1) { const barW = r * 2.1; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - barW / 2, y - r - 9, barW, 3); ctx.fillStyle = type.color; ctx.fillRect(x - barW / 2, y - r - 9, barW * enemy.hp / enemy.maxHp, 3); }
    }
  }

  function drawBullets() {
    for (const bullet of bullets) { ctx.strokeStyle = '#ff7a9f'; ctx.lineWidth = 3; ctx.shadowBlur = 12; ctx.shadowColor = '#ff527e'; ctx.beginPath(); ctx.moveTo(screenX(bullet.x), screenY(bullet.y)); if (bullet.trail.length) ctx.lineTo(screenX(bullet.trail[0].x), screenY(bullet.trail[0].y)); else ctx.lineTo(screenX(bullet.x - bullet.vx * .04), screenY(bullet.y - bullet.vy * .04)); ctx.stroke(); ctx.shadowBlur = 0; }
  }

  function drawParticles() { for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1); ctx.fillStyle = p.color; ctx.shadowBlur = 12; ctx.shadowColor = p.color; ctx.beginPath(); ctx.arc(screenX(p.x), screenY(p.y), p.size * width, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
  function drawFloaters() { ctx.textAlign = 'center'; ctx.font = '700 13px "Space Mono", monospace'; for (const f of floaters) { ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color; ctx.fillText(f.text, screenX(f.x), screenY(f.y)); } ctx.globalAlpha = 1; }

  function drawPowerups() { for (const p of powerups) { const x = screenX(p.x), y = screenY(p.y), r = p.radius * width; const color = p.type === 'heal' ? '#59e5ff' : '#ffd36b'; ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin); ctx.shadowBlur = 22; ctx.shadowColor = color; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#0c1630'; ctx.fillRect(-2, -r * .55, 4, r * 1.1); ctx.fillRect(-r * .55, -2, r * 1.1, 4); ctx.restore(); } }
  function drawVignette() { const vignette = ctx.createRadialGradient(width / 2, height / 2, height * .18, width / 2, height / 2, height * .78); vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(2,4,13,.62)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height); }

  function loop(time) {
    const dt = Math.min(.033, (time - lastTime) / 1000 || 0); lastTime = time;
    if (running && !paused && !gameOver) update(dt);
    draw(); requestAnimationFrame(loop);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = clamp((event.clientX - rect.left) / rect.width, .03, .97);
    pointer.y = clamp((event.clientY - rect.top) / rect.height, .1, .94);
    player.targetX = pointer.x;
  }

  canvas.addEventListener('pointerdown', (event) => { if (!running || paused || gameOver) return; startAudio(); pointer.active = true; pointer.down = true; pointerPosition(event); canvas.setPointerCapture?.(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => { if (pointer.active || event.pointerType === 'mouse') pointerPosition(event); });
  canvas.addEventListener('pointerup', (event) => { pointer.down = false; pointer.active = false; canvas.releasePointerCapture?.(event.pointerId); });
  canvas.addEventListener('pointercancel', () => { pointer.down = false; pointer.active = false; });
  window.addEventListener('keydown', (event) => { const key = event.key.toLowerCase(); if ([' ', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault(); keys.add(key); if (key === 'p' || key === 'escape') togglePause(); if (key === ' ') startAudio(); });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('resize', resize);

  function beginRun() { startAudio(); resetGame(); running = true; pointer.down = false; }
  function togglePause() { if (!running || gameOver) return; paused = !paused; showScreen(paused ? 'pauseScreen' : null); if (!paused) startAudio(); }
  $('startButton').addEventListener('click', beginRun);
  $('restartButton').addEventListener('click', beginRun);
  $('restartPauseButton').addEventListener('click', beginRun);
  $('resumeButton').addEventListener('click', togglePause);
  $('pauseButton').addEventListener('click', togglePause);

  resize(); updateHud(); requestAnimationFrame(loop);
})();
