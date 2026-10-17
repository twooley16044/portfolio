const canvas = document.querySelector("#prism-canvas");
const stage = document.querySelector("#prism-stage");
const startButton = document.querySelector("#prism-start");
const overlay = document.querySelector("#prism-overlay");

if (canvas instanceof HTMLCanvasElement && stage && startButton && overlay) {
  const ctx = canvas.getContext("2d");
  const timeReadout = document.querySelector("#prism-time");
  const scoreReadout = document.querySelector("#prism-score");
  const livesReadout = document.querySelector("#prism-lives");
  const powerStatus = document.querySelector("#prism-power-status");
  const toast = document.querySelector("#prism-toast");
  const title = document.querySelector("#prism-message-title");
  const message = document.querySelector("#prism-message");
  const instructions = document.querySelector("#prism-instructions");
  const controls = document.querySelector("#prism-controls");
  const startBest = document.querySelector("#prism-start-best");
  const results = document.querySelector("#prism-results");
  const finalScore = document.querySelector("#prism-final-score");
  const bestResult = document.querySelector("#prism-best-result");
  if (!ctx || !timeReadout || !scoreReadout || !livesReadout || !powerStatus || !toast || !title || !message || !instructions || !controls || !startBest || !results || !finalScore || !bestResult) throw new Error("Prism Break could not initialize.");

  const colors = ["#42e8e0", "#38c9ff", "#5989ff", "#9a74ff", "#ec72d2", "#ff9b65", "#ffd45c"];
  const maxBalls = 5;
  const plasmaDuration = 8;
  const bestScoreKey = "prism-break-best-v1";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const game = { width: 800, height: 520, running: false, ended: false, paused: false, elapsed: 0, score: 0, lives: 3, bricks: [], balls: [], powerups: [], sparks: [], lastTime: 0, raf: 0, pointerX: null, toastTime: 0 };
  const paddle = { x: 350, y: 482, width: 100, height: 12, targetX: 400 };
  let bestScore = loadBestScore();

  function loadBestScore() {
    try {
      const stored = Number(window.localStorage.getItem(bestScoreKey));
      return Number.isFinite(stored) && stored > 0 ? stored : 0;
    } catch {
      return 0;
    }
  }

  function formatScore(score) { return score.toLocaleString(); }

  function showOverlay() {
    overlay.inert = false;
    overlay.classList.remove("is-hidden");
  }

  function hideOverlay() {
    overlay.inert = true;
    overlay.classList.add("is-hidden");
  }

  function createBall(x, y, vx, vy, plasma = 0) {
    return { x, y, radius: 8, vx, vy, plasma, trail: [] };
  }

  function resetBall() {
    game.balls = [createBall(paddle.x + paddle.width / 2, paddle.y - 11, 170, -250)];
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    canvas.style.width = `${bounds.width}px`;
    canvas.style.height = `${bounds.height}px`;
    ctx.setTransform(canvas.width / game.width, 0, 0, canvas.height / game.height, 0, 0);
    paddle.y = game.height - 38;
    draw();
  }

  function buildBricks() {
    game.bricks = [];
    const columns = 8;
    const rows = 5;
    const gap = 9;
    const width = (game.width - 64 - gap * (columns - 1)) / columns;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        game.bricks.push({ x: 32 + col * (width + gap), y: 66 + row * 34, width, height: row === rows - 1 ? 16 : 24, color: colors[(row + col) % colors.length], alive: true });
      }
    }
  }

  function start() {
    if (game.paused) {
      game.paused = false;
      game.running = true;
      stage.classList.add("is-playing");
      hideOverlay();
      game.lastTime = performance.now();
      game.raf = requestAnimationFrame(frame);
      return;
    }
    cancelAnimationFrame(game.raf);
    game.running = true;
    game.ended = false;
    game.elapsed = 0;
    game.score = 0;
    game.lives = 3;
    game.pointerX = null;
    game.sparks = [];
    game.powerups = [];
    game.toastTime = 0;
    instructions.hidden = false;
    controls.hidden = false;
    startBest.hidden = false;
    results.hidden = true;
    startBest.textContent = bestScore ? `Personal best: ${formatScore(bestScore)}` : "Your personal best will appear here.";
    title.textContent = "Prism Break";
    message.textContent = "Break bricks. Catch power-ups. Beat the clock.";
    startButton.textContent = "Play";
    overlay.classList.remove("is-victory", "is-new-record");
    stage.classList.add("is-playing");
    paddle.x = (game.width - paddle.width) / 2;
    paddle.targetX = game.width / 2;
    buildBricks();
    resetBall();
    instructions.hidden = true;
    controls.hidden = true;
    startBest.hidden = true;
    hideOverlay();
    toast.textContent = "";
    updateHud();
    game.lastTime = performance.now();
    game.raf = requestAnimationFrame(frame);
  }

  function endGame(won) {
    game.running = false;
    game.ended = true;
    game.paused = false;
    for (const ball of game.balls) { ball.plasma = 0; ball.trail = []; }
    game.powerups = [];
    game.sparks = [];
    cancelAnimationFrame(game.raf);
    stage.classList.remove("is-playing");
    powerStatus.textContent = "";
    updateHud();
    const newRecord = game.score > bestScore;
    if (newRecord) {
      bestScore = game.score;
      try { window.localStorage.setItem(bestScoreKey, String(bestScore)); } catch { /* The game remains playable when storage is unavailable. */ }
    }
    title.textContent = won ? "All prisms cleared!" : newRecord ? "New personal best!" : "Great run!";
    message.textContent = won ? "You cleared every prism — beautifully played!" : "Nice run! Every round is another chance to top your score.";
    finalScore.textContent = formatScore(game.score);
    bestResult.textContent = newRecord ? "✦ New personal best!" : `Personal best: ${formatScore(bestScore)}`;
    instructions.hidden = true;
    controls.hidden = true;
    startBest.hidden = true;
    results.hidden = false;
    startButton.textContent = "Play again";
    overlay.classList.toggle("is-victory", won);
    overlay.classList.toggle("is-new-record", newRecord);
    showOverlay();
    startButton.focus({ preventScroll: true });
    draw();
  }

  function updateHud() {
    timeReadout.textContent = String(Math.max(0, Math.ceil(60 - game.elapsed)));
    timeReadout.classList.toggle("is-urgent", game.elapsed >= 55 && game.elapsed < 60);
    scoreReadout.textContent = game.score.toLocaleString();
    livesReadout.textContent = "♥ ".repeat(game.lives).trim() || "—";
    livesReadout.setAttribute("aria-label", `${game.lives} ${game.lives === 1 ? "life" : "lives"} remaining`);
    const remaining = Math.max(0, ...game.balls.map((ball) => ball.plasma));
    powerStatus.textContent = remaining > 0 ? `✦ Plasma Ball · ${remaining.toFixed(1)}s` : "";
    powerStatus.classList.toggle("is-active", remaining > 0);
    if (game.toastTime <= 0) toast.textContent = "";
  }

  function showToast(text) {
    game.toastTime = 1.8;
    toast.textContent = text;
  }

  function addSparks(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) game.sparks.push({ x, y, vx: (Math.random() - .5) * 110, vy: (Math.random() - .5) * 110, life: .28, color });
  }

  function spawnPowerup(brick) {
    if (game.powerups.length >= 3 || Math.random() >= .14) return;
    const type = Math.random() < .5 ? "multiball" : "plasma";
    game.powerups.push({ type, x: brick.x + brick.width / 2, y: brick.y + brick.height / 2, radius: 12, vy: 112, phase: Math.random() * Math.PI * 2 });
  }

  function collectPowerup(powerup, pendingBalls) {
    if (powerup.type === "multiball") {
      let added = 0;
      for (const ball of game.balls) {
        if (game.balls.length + pendingBalls.length >= maxBalls || added >= 2) break;
        const angle = added === 0 ? -.28 : .28;
        const speed = Math.hypot(ball.vx, ball.vy);
        const baseAngle = Math.atan2(ball.vy, ball.vx);
        pendingBalls.push(createBall(ball.x + angle * 9, ball.y, Math.cos(baseAngle + angle) * speed, Math.sin(baseAngle + angle) * speed, ball.plasma));
        added++;
      }
      showToast(added ? "✣ Multiball!" : "✣ Multiball · max balls");
    } else {
      const ball = game.balls[0];
      if (ball) { ball.plasma = plasmaDuration; ball.trail = []; }
      showToast("✦ Plasma Ball! 8 seconds");
    }
  }

  function brickHit(ball, brick, plasma) {
    if (!brick.alive) return;
    brick.alive = false;
    game.score += 25;
    addSparks(ball.x, ball.y, brick.color);
    spawnPowerup(brick);
    if (!plasma) {
      const overlapX = Math.min(ball.x + ball.radius - brick.x, brick.x + brick.width - (ball.x - ball.radius));
      const overlapY = Math.min(ball.y + ball.radius - brick.y, brick.y + brick.height - (ball.y - ball.radius));
      if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
      if (Math.abs(ball.vy) < 90) {
        const speed = Math.hypot(ball.vx, ball.vy);
        const direction = ball.vy < 0 ? -1 : 1;
        ball.vy = direction * 90;
        ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, speed * speed - 90 * 90));
      }
    }
  }

  function updateBall(ball, dt, pendingBalls) {
    const speed = Math.hypot(ball.vx, ball.vy);
    const steps = Math.max(1, Math.ceil(speed * dt / 4));
    const step = dt / steps;
    const plasmaAtFrameStart = ball.plasma > 0;
    ball.plasma = Math.max(0, ball.plasma - dt);
    for (let i = 0; i < steps; i++) {
      const oldX = ball.x;
      const oldY = ball.y;
      ball.x += ball.vx * step;
      ball.y += ball.vy * step;

      if (ball.x < ball.radius) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x > game.width - ball.radius) {
        ball.x = game.width - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y < ball.radius + 8) {
        ball.y = ball.radius + 8;
        ball.vy = Math.abs(ball.vy);
      }

      const plasma = ball.plasma > 0;
      if (ball.vy > 0 && ball.y + ball.radius >= paddle.y && ball.y - ball.radius <= paddle.y + paddle.height && ball.x >= paddle.x - ball.radius && ball.x <= paddle.x + paddle.width + ball.radius) {
        const offset = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
        const angle = offset * .82;
        const paddleSpeed = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.sin(angle) * paddleSpeed;
        ball.vy = -Math.cos(angle) * paddleSpeed;
        ball.y = paddle.y - ball.radius;
        addSparks(ball.x, ball.y, "#91fff2");
      }

      if (ball.y - ball.radius > game.height) return false;

      let hitNormalBrick = false;
      for (const brick of game.bricks) {
        if (!brick.alive || ball.x + ball.radius <= brick.x || ball.x - ball.radius >= brick.x + brick.width || ball.y + ball.radius <= brick.y || ball.y - ball.radius >= brick.y + brick.height) continue;
        brickHit(ball, brick, plasma);
        if (!plasma) {
          const overlapX = Math.min(ball.x + ball.radius - brick.x, brick.x + brick.width - (ball.x - ball.radius));
          const overlapY = Math.min(ball.y + ball.radius - brick.y, brick.y + brick.height - (ball.y - ball.radius));
          if (overlapX < overlapY) ball.x = oldX; else ball.y = oldY;
          hitNormalBrick = true;
          break;
        }
      }
      if (game.bricks.every((brick) => !brick.alive)) {
        game.score += 500;
        endGame(true);
        return false;
      }
      if (hitNormalBrick) break;
    }

    if (plasmaAtFrameStart && ball.plasma > 0 && !reducedMotion.matches) {
      ball.trail.push({ x: ball.x, y: ball.y, age: 0 });
      if (ball.trail.length > 14) ball.trail.shift();
    } else if (!ball.plasma) ball.trail = [];
    return true;
  }

  function update(dt, elapsedDt) {
    game.elapsed += elapsedDt;
    game.toastTime = Math.max(0, game.toastTime - dt);
    if (game.elapsed >= 60) { game.elapsed = 60; updateHud(); endGame(false); return; }
    const aim = game.pointerX === null ? paddle.targetX : game.pointerX;
    paddle.x += (aim - (paddle.x + paddle.width / 2)) * Math.min(1, dt * 14);
    paddle.x = Math.max(12, Math.min(game.width - paddle.width - 12, paddle.x));

    const pendingBalls = [];
    game.balls = game.balls.filter((ball) => game.running && updateBall(ball, dt, pendingBalls));
    if (!game.running) return;
    game.balls.push(...pendingBalls);
    if (game.balls.length === 0) {
      game.lives--;
      updateHud();
      if (game.lives <= 0) { endGame(false); return; }
      resetBall();
    }

    for (const powerup of game.powerups) {
      powerup.y += powerup.vy * dt;
      powerup.phase += dt * 4;
    }
    const caught = game.powerups.filter((powerup) => powerup.y + powerup.radius >= paddle.y && powerup.y - powerup.radius <= paddle.y + paddle.height && powerup.x >= paddle.x - powerup.radius && powerup.x <= paddle.x + paddle.width + powerup.radius);
    for (const powerup of caught) collectPowerup(powerup, pendingBalls);
    game.powerups = game.powerups.filter((powerup) => !caught.includes(powerup) && powerup.y - powerup.radius < game.height);
    game.balls.push(...pendingBalls);
    for (const spark of game.sparks) { spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.life -= dt; }
    game.sparks = game.sparks.filter((spark) => spark.life > 0);
    for (const ball of game.balls) {
      for (const point of ball.trail) point.age += dt;
      ball.trail = ball.trail.filter((point) => point.age < .38);
    }
    updateHud();
  }

  function roundRect(x, y, width, height, radius) {
    ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill();
  }

  function drawBrick(brick) {
    const radius = brick.height < 20 ? 5 : 7;
    const gradient = ctx.createLinearGradient(brick.x, brick.y, brick.x + brick.width, brick.y + brick.height);
    gradient.addColorStop(0, "rgba(255,255,255,.72)");
    gradient.addColorStop(.22, brick.color);
    gradient.addColorStop(.72, brick.color);
    gradient.addColorStop(1, "rgba(112,91,210,.86)");

    ctx.save();
    ctx.shadowColor = brick.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.width, brick.height, radius);
    ctx.globalAlpha = .82;
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.clip();

    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.beginPath();
    ctx.moveTo(brick.x + 3, brick.y + 2);
    ctx.lineTo(brick.x + brick.width * .62, brick.y + 2);
    ctx.lineTo(brick.x + brick.width * .43, brick.y + brick.height * .58);
    ctx.lineTo(brick.x + 3, brick.y + brick.height * .36);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(20,24,70,.12)";
    ctx.beginPath();
    ctx.moveTo(brick.x + brick.width * .43, brick.y + brick.height * .58);
    ctx.lineTo(brick.x + brick.width * .62, brick.y + 2);
    ctx.lineTo(brick.x + brick.width - 2, brick.y + 2);
    ctx.lineTo(brick.x + brick.width - 2, brick.y + brick.height - 2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(brick.x + brick.width * .43, brick.y + brick.height * .58);
    ctx.lineTo(brick.x + brick.width * .62, brick.y + 2);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.width, brick.height, radius);
    ctx.strokeStyle = "rgba(255,255,255,.62)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.7)";
    roundRect(brick.x + 6, brick.y + 2, brick.width - 12, 2, 1);
  }

  function drawBall(ball) {
    if (ball.plasma > 0) {
      for (let i = 0; i < ball.trail.length; i++) {
        const point = ball.trail[i];
        const alpha = Math.max(0, (1 - point.age / .38) * (i + 1) / ball.trail.length * .45);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = i % 2 ? "#6c63ff" : "#49eaff";
        ctx.beginPath(); ctx.arc(point.x, point.y, ball.radius * (.45 + alpha), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const glow = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.radius * 2.4);
      glow.addColorStop(0, "#ffffff"); glow.addColorStop(.35, "#9ffcff"); glow.addColorStop(.68, "#4e9dff"); glow.addColorStop(1, "rgba(126,76,255,0)");
      ctx.shadowColor = "#7388ff"; ctx.shadowBlur = 22; ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius * 1.7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius * .48, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.shadowColor = "#fff3bd"; ctx.shadowBlur = 16; ctx.fillStyle = "#fff3bd";
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, game.width, game.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
    gradient.addColorStop(0, "#171b42"); gradient.addColorStop(1, "#10152f");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, game.width, game.height);
    ctx.strokeStyle = "rgba(157, 177, 255, .08)"; ctx.lineWidth = 1;
    for (let x = 25; x < game.width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, game.height); ctx.stroke(); }
    for (const brick of game.bricks) if (brick.alive) drawBrick(brick);
    for (const powerup of game.powerups) {
      const plasma = powerup.type === "plasma";
      const color = plasma ? "#71d7ff" : "#ffe16a";
      ctx.save(); ctx.translate(powerup.x, powerup.y + Math.sin(powerup.phase) * 2); ctx.rotate(Math.sin(powerup.phase) * .08);
      ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillStyle = plasma ? "#6146d9" : "#ed8c35";
      roundRect(-12, -12, 24, 24, 8); ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(plasma ? "P" : "✣", 0, 1); ctx.restore();
    }
    ctx.shadowColor = "#6ef7ec"; ctx.shadowBlur = 19; ctx.fillStyle = "#c4fff5";
    roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 7); ctx.shadowBlur = 0;
    for (const ball of game.balls) drawBall(ball);
    for (const spark of game.sparks) { ctx.globalAlpha = Math.max(0, spark.life / .28); ctx.fillStyle = spark.color; ctx.fillRect(spark.x - 2, spark.y - 2, 4, 4); }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!game.running) return;
    const elapsedDt = Math.max(0, (now - game.lastTime) / 1000);
    const dt = Math.min(elapsedDt, .04);
    game.lastTime = now;
    update(dt, elapsedDt);
    draw();
    if (game.running) game.raf = requestAnimationFrame(frame);
  }

  function pointerMove(event) {
    const bounds = canvas.getBoundingClientRect();
    game.pointerX = (event.clientX - bounds.left) * (game.width / bounds.width);
  }

  startButton.addEventListener("click", start);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch") game.pointerX = null; });
  canvas.addEventListener("pointerdown", (event) => {
    pointerMove(event);
    if (event.pointerType === "touch") canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch" && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  window.addEventListener("keydown", (event) => {
    if (game.running && ["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) event.preventDefault();
    if (!game.running) return;
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") { game.pointerX = null; paddle.targetX = Math.max(paddle.width / 2, paddle.targetX - 42); }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") { game.pointerX = null; paddle.targetX = Math.min(game.width - paddle.width / 2, paddle.targetX + 42); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.running) {
      game.running = false;
      game.paused = true;
      cancelAnimationFrame(game.raf);
      stage.classList.remove("is-playing");
      title.textContent = "Round paused";
      message.textContent = "Your round timer and power-ups are paused while this tab is hidden.";
      instructions.hidden = true;
      controls.hidden = true;
      startBest.hidden = true;
      results.hidden = true;
      startButton.textContent = "Resume game";
      showOverlay();
      startButton.focus({ preventScroll: true });
    }
  });
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  window.addEventListener("pagehide", () => { cancelAnimationFrame(game.raf); observer.disconnect(); }, { once: true });
  startBest.textContent = bestScore ? `Personal best: ${formatScore(bestScore)}` : "Your personal best will appear here.";
  resize();
}
