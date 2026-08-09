/* Last Light — squad survival runner. Canvas gameplay, generated artwork, no framework. */

(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const BEST_KEY = 'last-light-best';

  const art = { road: new Image(), soldier: new Image(), zombies: new Image() };
  art.road.src = 'assets/road-v1.jpg';
  art.soldier.src = 'assets/survivor-v2.png';
  art.zombies.src = 'assets/zombies-v2.png';

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
  let core = 100;
  let squadCount = 1;
  let rifleLevel = 1;
  let waveKills = 0;
  let waveTarget = 13;
  let spawnClock = 1;
  let spawnGap = .9;
  let gateClock = 3.1;
  let fireClock = 0;
  let shake = 0;
  let waveBannerTimer = 0;
  let toastTimer = 0;
  let combo = 0;
  let comboTimer = 0;
  let transitioning = false;
  let bossActive = false;
  let bossSpawned = false;
  let audioContext = null;

  const pointer = { x: .5, y: .18, down: false, active: false };
  const keys = new Set();
  const bullets = [];
  const enemies = [];
  const particles = [];
  const floaters = [];
  const powerups = [];
  const gates = [];
  const stars = [];
  const player = { x: .5, targetX: .5, y: .84, invuln: 0, muzzle: 0 };

  const enemyTypes = {
    runner: { hp: 1, speed: 42, damage: 1, score: 100, color: '#ff668e', sprite: 0, size: .13 },
    stalker: { hp: 2, speed: 32, damage: 2, score: 190, color: '#a78cff', sprite: 2, size: .145 },
    crawler: { hp: 3, speed: 37, damage: 3, score: 270, color: '#72ddc2', sprite: 3, size: .16 },
    brute: { hp: 6, speed: 19, damage: 5, score: 480, color: '#ffb866', sprite: 1, size: .2 },
    boss: { hp: 80, speed: 10, damage: 14, score: 5500, color: '#ff5c4f', sprite: 1, size: .46 },
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, rect.width);
    height = Math.max(500, rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!stars.length) for (let i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + .2, a: Math.random() * .45 + .1 });
  }

  function random(min, max) { return Math.random() * (max - min) + min; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function screenX(x) { return x * width; }
  function screenY(y) { return y * height; }
  function fmt(value) { return String(Math.max(0, Math.floor(value))).padStart(6, '0'); }

  function startAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  }

  function beep(frequency, duration, type = 'sine', volume = .03) {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * .62), audioContext.currentTime + duration);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function showScreen(id) {
    ['startScreen', 'pauseScreen', 'gameOverScreen'].forEach((screenId) => $(screenId).classList.toggle('screen--active', screenId === id));
  }

  function updateHud() {
    $('score').textContent = fmt(score);
    $('best').textContent = fmt(Math.max(best, score));
    $('squadTop').textContent = String(squadCount).padStart(2, '0');
    $('healthText').textContent = `${Math.ceil(core)}%`;
    $('healthFill').style.width = `${clamp(core, 0, 100)}%`;
    $('healthFill').style.background = core < 30 ? 'linear-gradient(90deg,#ff527e,#ffaf70)' : 'linear-gradient(90deg,#59e5ff,#a5f8ff)';
    $('weaponName').textContent = `RIFLES MK ${['I', 'II', 'III', 'IV', 'V'][clamp(rifleLevel - 1, 0, 4)]}`;
  }

  function showToast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    toastTimer = 1.6;
  }

  function announceWave() {
    $('waveBanner').classList.add('show');
    $('bannerWave').textContent = bossActive ? `BOSS WAVE ${String(wave).padStart(2, '0')}` : `WAVE ${String(wave).padStart(2, '0')}`;
    $('bannerDetail').textContent = bossActive ? 'Bring down the giant' : `${waveTarget} hostiles ahead`;
    waveBannerTimer = 2.3;
  }

  function resetGame() {
    enemies.length = 0; bullets.length = 0; particles.length = 0; floaters.length = 0; powerups.length = 0; gates.length = 0;
    wave = 1; score = 0; core = 100; squadCount = 1; rifleLevel = 1; waveKills = 0; waveTarget = 13;
    spawnClock = .7; spawnGap = .9; gateClock = 2.8; fireClock = 0; shake = 0; combo = 0; comboTimer = 0;
    elapsed = 0; transitioning = false; bossActive = false; bossSpawned = false; gameOver = false; paused = false;
    player.x = .5; player.targetX = .5; player.invuln = 0; player.muzzle = 0;
    updateHud(); showScreen(null); announceWave();
  }

  function roadBoundsAt(y) {
    const t = clamp(y, 0, 1);
    return { left: lerp(.39, .08, t), right: lerp(.61, .92, t) };
  }

  function formationPositions() {
    const visible = Math.min(squadCount, 36);
    const columns = visible <= 1 ? 1 : visible <= 4 ? 2 : visible <= 9 ? 3 : visible <= 20 ? 4 : 6;
    const xSpacing = visible > 20 ? .062 : visible > 9 ? .077 : visible > 4 ? .09 : .105;
    const ySpacing = visible > 20 ? .034 : visible > 9 ? .042 : .052;
    const positions = [];
    for (let i = 0; i < visible; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const x = clamp(player.x + (col - (columns - 1) / 2) * xSpacing, .08, .92);
      positions.push({ x, y: clamp(player.y + row * ySpacing, .72, .98), row, index: i });
    }
    return positions;
  }

  function spawnEnemy() {
    if (bossActive || enemies.filter((enemy) => !enemy.boss).length >= 30) return;
    const roll = Math.random();
    let kind = 'runner';
    if (wave >= 4 && roll > .78) kind = 'brute';
    else if (wave >= 3 && roll > .63) kind = 'crawler';
    else if (wave >= 2 && roll > .48) kind = 'stalker';
    const type = enemyTypes[kind];
    const lane = Math.round(random(1, 8)) / 10;
    enemies.push({ kind, x: clamp(lane + random(-.035, .035), .12, .88), y: -.08, hp: type.hp + Math.floor(wave / 5), maxHp: type.hp + Math.floor(wave / 5), speed: type.speed * (1 + wave * .055), phase: random(0, TAU), hit: 0, boss: false });
  }

  function spawnBoss() {
    if (bossSpawned || bossActive) return;
    bossSpawned = true; bossActive = true;
    const hp = enemyTypes.boss.hp + wave * 24;
    enemies.push({ kind: 'boss', x: .5, y: .04, hp, maxHp: hp, speed: enemyTypes.boss.speed, phase: 0, hit: 0, boss: true });
    announceWave();
    beep(65, .6, 'sawtooth', .05);
  }

  function spawnFormation() {
    const amount = Math.min(6, 3 + Math.floor(wave / 3));
    for (let i = 0; i < amount; i++) setTimeout(() => { if (running && !gameOver) spawnEnemy(); }, i * 80);
  }

  function randomGateOption() {
    const options = [
      { kind: 'squad', value: 5, label: '+5', sub: 'SQUAD', color: '#41b9ff' },
      { kind: 'squad', value: 10, label: '+10', sub: 'RECRUITS', color: '#41b9ff' },
      { kind: 'multiply', value: 2, label: '×2', sub: 'SQUAD', color: '#47c9ff' },
      { kind: 'rifle', value: 1, label: 'RIFLES', sub: '+1', color: '#ffb24f' },
      { kind: 'fire', value: 1, label: 'FIRE RATE', sub: '+25%', color: '#ffb24f' },
      { kind: 'squad', value: -5, label: '-5', sub: 'SQUAD', color: '#ff5577', bad: true },
    ];
    return options[Math.floor(Math.random() * options.length)];
  }

  function spawnGate() {
    if (gates.length || bossActive) return;
    let left = randomGateOption();
    let right = randomGateOption();
    if (wave === 1) { left = { kind: 'squad', value: 5, label: '+5', sub: 'SQUAD', color: '#41b9ff' }; right = { kind: 'rifle', value: 1, label: 'RIFLES', sub: '+1', color: '#ffb24f' }; }
    while (left.kind === right.kind && left.value === right.value) right = randomGateOption();
    gates.push({ y: -.18, speed: .075 + wave * .002, left, right, pulse: random(0, TAU) });
  }

  function applyGate(option) {
    if (option.kind === 'squad') squadCount = Math.max(1, squadCount + option.value);
    if (option.kind === 'multiply') squadCount = Math.min(99, squadCount * option.value);
    if (option.kind === 'rifle') rifleLevel = Math.min(5, rifleLevel + option.value);
    if (option.kind === 'fire') rifleLevel = Math.min(5, rifleLevel + option.value);
    const labels = option.kind === 'squad' || option.kind === 'multiply' ? `${squadCount} SQUAD` : `RIFLES MK ${['I', 'II', 'III', 'IV', 'V'][rifleLevel - 1]}`;
    showToast(`${option.label} ${option.sub}  ·  ${labels}`);
    score += option.bad ? 0 : 125;
    shake = option.bad ? 8 : 3;
    burst(player.x, player.y, option.color, 14, .35);
    beep(option.bad ? 100 : 520, .12, option.bad ? 'sawtooth' : 'triangle', .035);
    updateHud();
  }

  function aimAngle(from = player) {
    return Math.atan2(pointer.y - from.y, pointer.x - from.x);
  }

  function fireSquad() {
    const positions = formationPositions();
    const shooters = positions.slice(0, Math.min(18, positions.length));
    const angle = aimAngle();
    const damage = 1 + Math.floor((rifleLevel - 1) * .9) + Math.floor(squadCount / 12);
    for (const soldier of shooters) {
      const spread = random(-.022, .022) * (shooters.length > 10 ? 1.8 : 1);
      const shotAngle = angle + spread;
      bullets.push({ x: soldier.x + Math.cos(shotAngle) * .026, y: soldier.y + Math.sin(shotAngle) * .026, vx: Math.cos(shotAngle) * 1.13, vy: Math.sin(shotAngle) * 1.13, damage, life: 1.5, trail: [] });
    }
    player.muzzle = .12;
    fireClock = Math.max(.095, .25 - rifleLevel * .025);
    beep(245 + Math.random() * 35, .06, 'sawtooth', .016);
    for (let i = 0; i < Math.min(5, shooters.length); i++) particles.push({ x: player.x + random(-.04, .04), y: player.y, vx: random(-.12, .12), vy: random(-.17, -.06), life: .22, maxLife: .22, size: random(.003, .008), color: '#ffd27b' });
  }

  function hitEnemy(enemy, bullet) {
    enemy.hp -= bullet.damage;
    enemy.hit = .12;
    burst(bullet.x, bullet.y, enemyTypes[enemy.kind].color, enemy.boss ? 5 : 3, .12);
    if (enemy.hp <= 0) destroyEnemy(enemy);
    else beep(enemy.boss ? 115 : 160, .035, 'square', .01);
  }

  function destroyEnemy(enemy) {
    const type = enemyTypes[enemy.kind];
    const index = enemies.indexOf(enemy);
    if (index !== -1) enemies.splice(index, 1);
    combo = comboTimer > 0 ? combo + 1 : 1;
    comboTimer = 2;
    const earned = type.score * Math.min(5, combo);
    score += earned;
    burst(enemy.x, enemy.y, type.color, enemy.boss ? 48 : 14, enemy.boss ? .75 : .34);
    floaters.push({ x: enemy.x, y: enemy.y, text: `+${earned}`, color: enemy.boss ? '#ffd36b' : '#fff', life: 1, vy: -.08 });
    if (combo > 1) floaters.push({ x: enemy.x, y: enemy.y - .04, text: `${Math.min(5, combo)}× COMBO`, color: '#59e5ff', life: 1, vy: -.05 });
    shake = Math.min(16, shake + (enemy.boss ? 14 : 2));
    beep(enemy.boss ? 58 : 175, enemy.boss ? .45 : .08, enemy.boss ? 'sawtooth' : 'square', .04);
    if (enemy.boss) { bossActive = false; core = clamp(core + 20, 0, 100); showToast('GIANT DOWN  ·  +20% CORE'); nextWave(); }
    else if (waveKills++ >= waveTarget - 1 && !bossActive) nextWave();
    if (!enemy.boss && Math.random() < .08) powerups.push({ x: enemy.x, y: enemy.y, type: Math.random() < .65 ? 'medkit' : 'rifle', life: 8, spin: 0 });
    updateHud();
  }

  function loseSquad(amount, message = 'SQUAD HIT') {
    const loss = Math.min(Math.max(0, squadCount - 1), Math.max(1, Math.round(amount)));
    squadCount -= loss;
    core = clamp(core - loss * 2.3, 0, 100);
    player.invuln = .6;
    shake = Math.min(14, shake + 7);
    showToast(`${message}  ·  −${loss} SOLDIER${loss === 1 ? '' : 'S'}`);
    burst(player.x, player.y, '#ff5b8f', 18, .42);
    beep(75, .18, 'sawtooth', .04);
    updateHud();
    if (squadCount <= 0 || core <= 0) endGame();
  }

  function collectPowerup(powerup) {
    const index = powerups.indexOf(powerup);
    if (index !== -1) powerups.splice(index, 1);
    if (powerup.type === 'medkit') { core = clamp(core + 18, 0, 100); showToast('MEDKIT  ·  +18% CORE'); }
    else { rifleLevel = Math.min(5, rifleLevel + 1); showToast('WEAPON PICKUP  ·  RIFLES UP'); }
    score += 100; burst(powerup.x, powerup.y, powerup.type === 'medkit' ? '#59e5ff' : '#ffd36b', 18, .4); beep(670, .12, 'triangle', .03); updateHud();
  }

  function endGame() {
    gameOver = true; running = false; best = Math.max(best, score); localStorage.setItem(BEST_KEY, String(best));
    $('finalScore').textContent = fmt(score); $('finalWave').textContent = String(wave).padStart(2, '0');
    $('gameOverTitle').textContent = squadCount > 0 ? 'The road belongs to the dead.' : 'Your squad was overrun.';
    showScreen('gameOverScreen'); beep(45, .5, 'sawtooth', .05);
  }

  function nextWave() {
    if (transitioning) return;
    transitioning = true; wave++; waveKills = 0; waveTarget = 13 + wave * 5; spawnGap = Math.max(.34, .9 - wave * .035); spawnClock = 1.7; gateClock = 2.5;
    bossSpawned = false; bossActive = wave % 3 === 0;
    if (!bossActive) setTimeout(() => { transitioning = false; }, 700);
    else setTimeout(() => { transitioning = false; spawnBoss(); }, 1150);
    announceWave(); updateHud(); beep(430, .18, 'triangle', .035);
  }

  function update(dt) {
    elapsed += dt;
    if (waveBannerTimer > 0 && (waveBannerTimer -= dt) <= 0) $('waveBanner').classList.remove('show');
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').classList.remove('show');
    if (shake > 0) shake = Math.max(0, shake - dt * 25);
    if (comboTimer > 0) comboTimer -= dt; else combo = 0;
    player.invuln = Math.max(0, player.invuln - dt); player.muzzle = Math.max(0, player.muzzle - dt);

    const movement = (keys.has('a') || keys.has('arrowleft') ? -1 : 0) + (keys.has('d') || keys.has('arrowright') ? 1 : 0);
    if (movement) player.targetX = clamp(player.targetX + movement * dt * .65, .1, .9);
    player.x = lerp(player.x, clamp(player.targetX, .1, .9), Math.min(1, dt * 10));

    fireClock -= dt;
    if ((pointer.down || keys.has(' ')) && fireClock <= 0) fireSquad();

    spawnClock -= dt;
    if (spawnClock <= 0 && !bossActive) { spawnFormation(); spawnClock = spawnGap * random(.72, 1.1); }
    gateClock -= dt;
    if (gateClock <= 0 && !bossActive && !transitioning) { spawnGate(); gateClock = random(6.5, 9); }

    for (let i = gates.length - 1; i >= 0; i--) {
      const gate = gates[i]; gate.y += gate.speed * dt; gate.pulse += dt * 4;
      if (gate.y > player.y - .09) { applyGate(player.x < .5 ? gate.left : gate.right); gates.splice(i, 1); }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i]; bullet.trail.push({ x: bullet.x, y: bullet.y }); if (bullet.trail.length > 7) bullet.trail.shift();
      bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
      let hit = false;
      for (const enemy of enemies) {
        const hitRadius = enemy.boss ? .09 : .027;
        if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < hitRadius) { hitEnemy(enemy, bullet); hit = true; break; }
      }
      if (hit || bullet.life <= 0 || bullet.x < -.1 || bullet.x > 1.1 || bullet.y < -.1 || bullet.y > 1.1) bullets.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i]; enemy.phase += dt * 3; enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.y += enemy.speed * dt / height;
      if (!enemy.boss) enemy.x += Math.sin(enemy.phase) * dt * .018;
      if (enemy.boss && enemy.y > .49) { enemies.splice(i, 1); bossActive = false; loseSquad(Math.max(4, Math.ceil(squadCount * .3)), 'GIANT BREAKTHROUGH'); nextWave(); }
      else if (!enemy.boss && enemy.y > player.y - .02) { enemies.splice(i, 1); loseSquad(enemyTypes[enemy.kind].damage, 'ZOMBIES HIT'); }
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
      const powerup = powerups[i]; powerup.y += .02 * dt; powerup.spin += dt * 4; powerup.life -= dt;
      if (Math.hypot(powerup.x - player.x, powerup.y - player.y) < .06) collectPowerup(powerup);
      else if (powerup.life <= 0) powerups.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.y += f.vy * dt; f.life -= dt; if (f.life <= 0) floaters.splice(i, 1); }
    updateHud();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height); drawBackdrop();
    ctx.save(); if (shake > 0) ctx.translate(random(-shake, shake), random(-shake, shake));
    drawRoadGuides(); drawGates(); drawPowerups(); drawEnemies(); drawBossBar(); drawBullets(); drawSquad(); drawParticles(); drawFloaters();
    ctx.restore(); if (paused || !running) drawVignette();
  }

  function drawBackdrop() {
    if (art.road.complete && art.road.naturalWidth) ctx.drawImage(art.road, 0, 0, width, height);
    else { const gradient = ctx.createLinearGradient(0, 0, 0, height); gradient.addColorStop(0, '#312b37'); gradient.addColorStop(1, '#080c17'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height); }
    const shade = ctx.createLinearGradient(0, 0, 0, height); shade.addColorStop(0, 'rgba(4,7,18,.23)'); shade.addColorStop(.7, 'rgba(4,7,18,.04)'); shade.addColorStop(1, 'rgba(4,7,18,.42)'); ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
    for (const star of stars) { ctx.fillStyle = `rgba(255,220,170,${star.a * .18})`; ctx.beginPath(); ctx.arc(star.x * width, star.y * height, star.r, 0, TAU); ctx.fill(); }
  }

  function drawRoadGuides() {
    ctx.save(); ctx.strokeStyle = 'rgba(255,198,106,.22)'; ctx.lineWidth = 1;
    const top = roadBoundsAt(.1); const bottom = roadBoundsAt(1);
    for (let i = 1; i < 5; i++) { const t = i / 5; ctx.beginPath(); ctx.moveTo(lerp(top.left, top.right, t) * width, height * .1); ctx.lineTo(lerp(bottom.left, bottom.right, t) * width, height); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.setLineDash([8, 16]); ctx.beginPath(); ctx.moveTo(width * .5, height * .45); ctx.lineTo(width * .5, height); ctx.stroke(); ctx.restore();
  }

  function drawGates() {
    for (const gate of gates) {
      const bounds = roadBoundsAt(gate.y); const mid = (bounds.left + bounds.right) / 2; const h = lerp(34, 126, clamp(gate.y, 0, 1));
      drawGatePanel(bounds.left, mid, gate.y, h, gate.left, gate.pulse); drawGatePanel(mid, bounds.right, gate.y, h, gate.right, gate.pulse + Math.PI);
      ctx.strokeStyle = 'rgba(31,29,24,.86)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(mid * width, screenY(gate.y - .02)); ctx.lineTo(mid * width, screenY(gate.y + .07)); ctx.stroke();
    }
  }

  function drawGatePanel(left, right, y, h, option, pulse) {
    const x = left * width; const w = (right - left) * width; const top = screenY(y) - h / 2;
    ctx.save(); ctx.globalAlpha = .96; ctx.fillStyle = option.color; ctx.shadowBlur = 18; ctx.shadowColor = option.color; ctx.fillRect(x + 2, top, w - 4, h); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(10,20,32,.58)'; ctx.fillRect(x + 4, top + 4, w - 8, h - 8);
    ctx.strokeStyle = option.color; ctx.lineWidth = 3; ctx.strokeRect(x + 4, top + 4, w - 8, h - 8);
    ctx.fillStyle = '#fff7e7'; ctx.textAlign = 'center'; ctx.font = `900 ${Math.max(16, Math.min(31, w * .16))}px "Barlow Condensed", sans-serif`; ctx.fillText(option.label, x + w / 2, top + h * .5);
    ctx.font = `700 ${Math.max(9, Math.min(15, w * .085))}px "Space Mono", monospace`; ctx.fillStyle = option.color; ctx.fillText(option.sub, x + w / 2, top + h * .73);
    ctx.fillStyle = `rgba(255,255,255,${.35 + Math.sin(pulse) * .15})`; ctx.fillRect(x + w * .25, top - 6, w * .5, 3);
    ctx.restore();
  }

  function drawSquad() {
    const positions = formationPositions().sort((a, b) => b.y - a.y);
    const angle = aimAngle(); const size = squadCount > 24 ? 48 : squadCount > 12 ? 55 : squadCount > 4 ? 66 : 88;
    for (const soldier of positions) {
      const x = screenX(soldier.x); const y = screenY(soldier.y); const isFront = soldier.row === 0;
      ctx.save(); ctx.globalAlpha = player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0 ? .46 : 1;
      ctx.fillStyle = 'rgba(0,0,0,.43)'; ctx.beginPath(); ctx.ellipse(x, y + size * .31, size * .27, size * .09, 0, 0, TAU); ctx.fill();
      ctx.translate(x, y); ctx.rotate(angle + Math.PI / 4); ctx.shadowBlur = isFront ? 16 : 8; ctx.shadowColor = '#2d9fc8';
      if (art.soldier.complete && art.soldier.naturalWidth) ctx.drawImage(art.soldier, -size / 2, -size / 2, size, size);
      else { ctx.fillStyle = '#248db0'; ctx.beginPath(); ctx.arc(0, 0, size * .22, 0, TAU); ctx.fill(); }
      if (player.muzzle > 0 && soldier.index % 3 !== 1) { ctx.fillStyle = '#fff3a3'; ctx.shadowBlur = 20; ctx.shadowColor = '#ffb14a'; ctx.beginPath(); ctx.arc(size * .35, -size * .33, 5, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    const badgeY = clamp(player.y + Math.min(.15, .06 + squadCount * .003), .88, .96);
    const bx = screenX(player.x); const by = screenY(badgeY); const bw = Math.max(74, Math.min(102, width * .21));
    ctx.save(); ctx.translate(bx, by); ctx.fillStyle = '#172b57'; ctx.strokeStyle = '#65b8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -bw * .42); ctx.lineTo(bw * .38, -bw * .2); ctx.lineTo(bw * .3, bw * .34); ctx.lineTo(0, bw * .48); ctx.lineTo(-bw * .3, bw * .34); ctx.lineTo(-bw * .38, -bw * .2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `900 ${Math.max(20, bw * .3)}px "Barlow Condensed", sans-serif`; ctx.fillText(String(squadCount), 0, 5); ctx.font = `700 ${Math.max(8, bw * .1)}px "Space Mono", monospace`; ctx.fillStyle = '#9ddcff'; ctx.fillText('SQUAD', 0, bw * .28); ctx.restore();
  }

  function drawEnemies() {
    const cell = art.zombies.naturalWidth ? art.zombies.naturalWidth / 2 : 0;
    for (const enemy of enemies) {
      const type = enemyTypes[enemy.kind]; const x = screenX(enemy.x); const y = screenY(enemy.y) + (enemy.boss ? 0 : Math.sin(enemy.phase * 2) * 2); const size = enemy.boss ? Math.min(height * .3, Math.max(160, width * .56)) : Math.min(height * .18, Math.max(52, width * type.size));
      ctx.save(); ctx.globalAlpha = enemy.hit > 0 ? .68 : 1; ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(x, y + size * .32, size * .29, size * .1, 0, 0, TAU); ctx.fill();
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * .75); glow.addColorStop(0, `${type.color}42`); glow.addColorStop(1, `${type.color}00`); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, size * .75, 0, TAU); ctx.fill();
      ctx.translate(x, y); ctx.rotate(enemy.boss ? Math.sin(elapsed * .8) * .015 : Math.sin(enemy.phase * .7) * .04);
      if (cell) { const sx = (type.sprite % 2) * cell; const sy = Math.floor(type.sprite / 2) * cell; ctx.shadowBlur = enemy.boss ? 30 : 10; ctx.shadowColor = type.color; ctx.drawImage(art.zombies, sx, sy, cell, cell, -size / 2, -size / 2, size, size); }
      ctx.restore();
      if (!enemy.boss && enemy.maxHp > 1) { const barW = size * .55; const barY = y - size * .42 - 5; ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(x - barW / 2, barY, barW, 4); ctx.fillStyle = type.color; ctx.fillRect(x - barW / 2, barY, barW * enemy.hp / enemy.maxHp, 4); }
    }
  }

  function drawBossBar() {
    const boss = enemies.find((enemy) => enemy.boss); if (!boss) return;
    const barW = Math.min(width * .7, 430); const x = (width - barW) / 2; const y = height * .1; ctx.fillStyle = 'rgba(5,8,15,.8)'; ctx.fillRect(x, y, barW, 12); ctx.fillStyle = '#ff514d'; ctx.fillRect(x + 2, y + 2, (barW - 4) * boss.hp / boss.maxHp, 8); ctx.strokeStyle = '#ffcf9b'; ctx.lineWidth = 1; ctx.strokeRect(x, y, barW, 12); ctx.textAlign = 'center'; ctx.font = '700 10px "Space Mono", monospace'; ctx.fillStyle = '#fff'; ctx.fillText('GIANT MUTANT', width / 2, y - 5);
  }

  function drawBullets() {
    for (const bullet of bullets) { ctx.strokeStyle = '#ffbd63'; ctx.lineWidth = 2.5; ctx.shadowBlur = 13; ctx.shadowColor = '#ff7a3f'; ctx.beginPath(); ctx.moveTo(screenX(bullet.x), screenY(bullet.y)); if (bullet.trail.length) ctx.lineTo(screenX(bullet.trail[0].x), screenY(bullet.trail[0].y)); else ctx.lineTo(screenX(bullet.x - bullet.vx * .05), screenY(bullet.y - bullet.vy * .05)); ctx.stroke(); ctx.shadowBlur = 0; }
  }

  function drawPowerups() {
    for (const p of powerups) { const x = screenX(p.x); const y = screenY(p.y); const size = Math.max(18, width * .045); const color = p.type === 'medkit' ? '#59e5ff' : '#ffd36b'; ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin); ctx.shadowBlur = 20; ctx.shadowColor = color; ctx.fillStyle = color; ctx.fillRect(-size / 2, -size / 2, size, size); ctx.shadowBlur = 0; ctx.fillStyle = '#132443'; ctx.fillRect(-2, -size * .28, 4, size * .56); ctx.fillRect(-size * .28, -2, size * .56, 4); ctx.restore(); }
  }

  function drawParticles() { for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1); ctx.fillStyle = p.color; ctx.shadowBlur = 11; ctx.shadowColor = p.color; ctx.beginPath(); ctx.arc(screenX(p.x), screenY(p.y), p.size * width, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
  function drawFloaters() { ctx.textAlign = 'center'; ctx.font = '700 13px "Space Mono", monospace'; for (const f of floaters) { ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color; ctx.fillText(f.text, screenX(f.x), screenY(f.y)); } ctx.globalAlpha = 1; }
  function drawVignette() { const vignette = ctx.createRadialGradient(width / 2, height / 2, height * .18, width / 2, height / 2, height * .78); vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(2,4,13,.68)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height); }

  function loop(time) { const dt = Math.min(.033, (time - lastTime) / 1000 || 0); lastTime = time; if (running && !paused && !gameOver) update(dt); draw(); requestAnimationFrame(loop); }

  function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); pointer.x = clamp((event.clientX - rect.left) / rect.width, .04, .96); pointer.y = clamp((event.clientY - rect.top) / rect.height, .02, .7); player.targetX = pointer.x; }
  canvas.addEventListener('pointerdown', (event) => { if (!running || paused || gameOver) return; startAudio(); pointer.active = true; pointer.down = true; pointerPosition(event); canvas.setPointerCapture?.(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => { if (pointer.active || event.pointerType === 'mouse') pointerPosition(event); });
  canvas.addEventListener('pointerup', (event) => { pointer.down = false; pointer.active = false; canvas.releasePointerCapture?.(event.pointerId); });
  canvas.addEventListener('pointercancel', () => { pointer.down = false; pointer.active = false; });
  window.addEventListener('keydown', (event) => { const key = event.key.toLowerCase(); if ([' ', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault(); keys.add(key); if (key === 'p' || key === 'escape') togglePause(); if (key === ' ') startAudio(); });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('resize', resize);

  function beginRun() { startAudio(); resetGame(); running = true; pointer.down = false; }
  function togglePause() { if (!running || gameOver) return; paused = !paused; showScreen(paused ? 'pauseScreen' : null); if (!paused) startAudio(); }
  $('startButton').addEventListener('click', beginRun); $('restartButton').addEventListener('click', beginRun); $('restartPauseButton').addEventListener('click', beginRun); $('resumeButton').addEventListener('click', togglePause); $('pauseButton').addEventListener('click', togglePause);

  resize(); updateHud(); requestAnimationFrame(loop);
})();
