// Particle effects: burst and continuous emitters for game juice.
// Consumed from KilledByAPixel/LittleJS @ cdcbef463d88 (MIT License)
// Adapted from src/engineParticles.js:
//   - Particle: physics update with velocity, damping, gravity, rotation, color/size lerp
//   - ParticleEmitter: spawns particles at a rate into a cone, manages lifecycle
//   - Rendering: color gradient, size lerp, alpha fade

(function() {
  const emitters = [];
  const MAX_EMITTERS = 20;
  const MAX_PARTICLES = 400; // shared cap with kit.puff()

  // Preset configs for each kind: [emitRate, emitConeAngle, colorStartA, colorStartB, colorEndA, colorEndB,
  //   particleTime, sizeStart, sizeEnd, speed, angleSpeed, damping, gravityScale, fadeRate]
  const KINDS = {
    confetti: [200, Math.PI, {r:1,g:.35,b:.55,a:1}, {r:1,g:.85,b:.3,a:1}, {r:1,g:.35,b:.55,a:0}, {r:1,g:.85,b:.3,a:0}, 1.2, 5, 2, 180, 0.3, 0.92, 0.4, 0.15],
    smoke: [80, Math.PI/3, {r:.4,g:.4,b:.4,a:.7}, {r:.5,g:.5,b:.5,a:.6}, {r:.3,g:.3,b:.3,a:0}, {r:.4,g:.4,b:.4,a:0}, 1.5, 8, 16, 40, 0.05, 0.96, -0.1, 0.2],
    bubbles: [60, Math.PI/4, {r:.6,g:.85,b:1,a:.8}, {r:.7,g:.9,b:1,a:.7}, {r:.6,g:.85,b:1,a:0}, {r:.7,g:.9,b:1,a:0}, 2, 4, 7, 50, 0.1, 0.98, -0.3, 0.1],
    sparkles: [150, Math.PI, {r:1,g:1,b:.6,a:1}, {r:1,g:.9,b:.3,a:1}, {r:1,g:1,b:1,a:0}, {r:1,g:.8,b:.2,a:0}, 0.8, 3, 1, 120, 0.2, 0.94, 0.2, 0.25],
    rain: [300, Math.PI/12, {r:.5,g:.7,b:1,a:.6}, {r:.6,g:.75,b:1,a:.5}, {r:.5,g:.7,b:1,a:0}, {r:.6,g:.75,b:1,a:0}, 1, 2, 2, 280, 0, 0.99, 1.2, 0.05],
    fire: [120, Math.PI/3, {r:1,g:.6,b:.1,a:1}, {r:1,g:.3,b:.05,a:1}, {r:.3,g:.1,b:.05,a:0}, {r:.2,g:.05,b:0,a:0}, 0.7, 6, 10, 60, 0.15, 0.95, -0.5, 0.2]
  };

  function Particle(emitter, x, y, angle, colorStart, colorEnd, lifeTime, sizeStart, sizeEnd, vx, vy, angleVelocity) {
    this.emitter = emitter;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = vx;
    this.vy = vy;
    this.angleVelocity = angleVelocity;
    this.colorStart = colorStart;
    this.colorEnd = colorEnd;
    this.lifeTime = lifeTime;
    this.sizeStart = sizeStart;
    this.sizeEnd = sizeEnd;
    this.spawnTime = kit.t;
    this.destroyed = false;
    this.r = colorStart.r;
    this.g = colorStart.g;
    this.b = colorStart.b;
    this.a = colorStart.a;
    this.size = sizeStart;
  }

  Particle.prototype.update = function(dt) {
    if (this.destroyed) return;
    if (this.lifeTime <= 0 || kit.t - this.spawnTime > this.lifeTime) {
      this.destroyed = true;
      return;
    }
    const damping = this.emitter.damping;
    const angleDamping = this.emitter.angleDamping;
    const gravityScale = this.emitter.gravityScale;
    const gravity = this.emitter.gravity;
    this.vx *= damping;
    this.vy = this.vy * damping + gravity * gravityScale * dt * 60;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.angleVelocity * angleDamping;
  };

  Particle.prototype.render = function(ctx) {
    const fadeRate = this.emitter.fadeRate / 2;
    const p1 = this.lifeTime > 0 ? Math.min((kit.t - this.spawnTime) / this.lifeTime, 1) : 1;
    const p2 = 1 - p1;
    const alphaFade = p1 < fadeRate ? p1 / fadeRate : p1 > 1 - fadeRate ? (1 - p1) / fadeRate : 1;
    this.r = p2 * this.colorStart.r + p1 * this.colorEnd.r;
    this.g = p2 * this.colorStart.g + p1 * this.colorEnd.g;
    this.b = p2 * this.colorStart.b + p1 * this.colorEnd.b;
    this.a = (p2 * this.colorStart.a + p1 * this.colorEnd.a) * alphaFade;
    this.size = p2 * this.sizeStart + p1 * this.sizeEnd;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.globalAlpha = kit.clamp(this.a, 0, 1);
    ctx.fillStyle = 'rgb(' + Math.round(this.r * 255) + ',' + Math.round(this.g * 255) + ',' + Math.round(this.b * 255) + ')';
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  function ParticleEmitter(x, y, emitTime, emitRate, emitConeAngle, colorStartA, colorStartB, colorEndA, colorEndB,
    particleTime, sizeStart, sizeEnd, speed, angleSpeed, damping, angleDamping, gravityScale, fadeRate, randomness, gravity) {
    this.x = x;
    this.y = y;
    this.emitTime = emitTime;
    this.emitRate = emitRate;
    this.emitConeAngle = emitConeAngle;
    this.colorStartA = colorStartA;
    this.colorStartB = colorStartB;
    this.colorEndA = colorEndA;
    this.colorEndB = colorEndB;
    this.particleTime = particleTime;
    this.sizeStart = sizeStart;
    this.sizeEnd = sizeEnd;
    this.speed = speed;
    this.angleSpeed = angleSpeed;
    this.damping = damping;
    this.angleDamping = angleDamping;
    this.gravityScale = gravityScale;
    this.fadeRate = fadeRate;
    this.randomness = randomness;
    this.gravity = gravity;
    this.emitElapsed = 0;
    this.emitTimeBuffer = 1; // start at 1 so first particle spawns immediately
    this.particles = [];
    this.destroyed = false;
  }

  ParticleEmitter.prototype.update = function(dt, allParticles) {
    if (this.isActive()) {
      const step = this.emitTime ? Math.min(dt, this.emitTime - this.emitElapsed) : dt;
      this.emitElapsed += dt;
      const rate = this.emitRate;
      if (rate > 0 && rate < Infinity) {
        this.emitTimeBuffer += rate * step;
        const count = Math.floor(this.emitTimeBuffer);
        for (let i = 0; i < count && allParticles < MAX_PARTICLES; i++) {
          this.emitTimeBuffer--;
          this.emitParticle();
          allParticles++;
        }
      }
    } else if (this.particles.length === 0) {
      this.destroyed = true;
    }

    let alive = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.update(dt);
      if (!p.destroyed) this.particles[alive++] = p;
    }
    this.particles.length = alive;
  };

  ParticleEmitter.prototype.emitParticle = function() {
    const randomness = this.randomness;
    const rand = (v) => v + v * (Math.random() * 2 - 1) * randomness;
    const particleTime = rand(this.particleTime);
    const sizeStart = rand(this.sizeStart);
    const sizeEnd = rand(this.sizeEnd);
    const speed = rand(this.speed);
    const angleSpeed = rand(this.angleSpeed) * (Math.random() < 0.5 ? 1 : -1);
    const coneAngle = (Math.random() * 2 - 1) * this.emitConeAngle;
    const t = Math.random();
    const colorStart = {
      r: this.colorStartA.r + t * (this.colorStartB.r - this.colorStartA.r),
      g: this.colorStartA.g + t * (this.colorStartB.g - this.colorStartA.g),
      b: this.colorStartA.b + t * (this.colorStartB.b - this.colorStartA.b),
      a: this.colorStartA.a + t * (this.colorStartB.a - this.colorStartA.a)
    };
    const colorEnd = {
      r: this.colorEndA.r + t * (this.colorEndB.r - this.colorEndA.r),
      g: this.colorEndA.g + t * (this.colorEndB.g - this.colorEndA.g),
      b: this.colorEndA.b + t * (this.colorEndB.b - this.colorEndA.b),
      a: this.colorEndA.a + t * (this.colorEndB.a - this.colorEndA.a)
    };
    const angle = Math.random() * TAU;
    const vx = Math.cos(coneAngle) * speed;
    const vy = Math.sin(coneAngle) * speed;
    const particle = new Particle(this, this.x, this.y, angle, colorStart, colorEnd, particleTime, sizeStart, sizeEnd, vx, vy, angleSpeed);
    this.particles.push(particle);
  };

  ParticleEmitter.prototype.isActive = function() {
    return !this.emitTime || this.emitElapsed < this.emitTime;
  };

  kit.burst = function(kind, x, y, n) {
    if (typeof kind !== 'string' || !KINDS[kind]) return;
    if (!isFinite(x) || !isFinite(y)) return;
    n = kit.clamp(n | 0, 1, 100);
    const cfg = KINDS[kind];
    const emitter = new ParticleEmitter(x, y, 0, 0, cfg[1], cfg[2], cfg[3], cfg[4], cfg[5], cfg[6], cfg[7], cfg[8], cfg[9], cfg[10], cfg[11], 1, cfg[12], cfg[13], 0.2, 260);
    for (let i = 0; i < n && emitter.particles.length < MAX_PARTICLES; i++) {
      emitter.emitParticle();
    }
    if (emitters.length >= MAX_EMITTERS) emitters.shift();
    emitters.push(emitter);
  };

  kit.emit = function(kind, x, y, seconds) {
    if (typeof kind !== 'string' || !KINDS[kind]) return;
    if (!isFinite(x) || !isFinite(y)) return;
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) return;
    const cfg = KINDS[kind];
    const emitter = new ParticleEmitter(x, y, seconds, cfg[0], cfg[1], cfg[2], cfg[3], cfg[4], cfg[5], cfg[6], cfg[7], cfg[8], cfg[9], cfg[10], cfg[11], 1, cfg[12], cfg[13], 0.2, 260);
    if (emitters.length >= MAX_EMITTERS) emitters.shift();
    emitters.push(emitter);
  };

  kit._onTick(function(dt) {
    let totalParticles = 0;
    for (let i = 0; i < emitters.length; i++) {
      totalParticles += emitters[i].particles.length;
    }
    let alive = 0;
    for (let i = 0; i < emitters.length; i++) {
      const em = emitters[i];
      em.update(dt, totalParticles);
      if (!em.destroyed) emitters[alive++] = em;
      totalParticles = 0;
      for (let j = 0; j < emitters.length; j++) {
        if (j < alive) totalParticles += emitters[j].particles.length;
      }
    }
    emitters.length = alive;

    // Render particles directly to ctx, after game.update() but before game.draw()
    // This runs during the loop's tick after game.update, so particles appear below game drawing
    ctx.save();
    for (let i = 0; i < emitters.length; i++) {
      const particles = emitters[i].particles;
      for (let j = 0; j < particles.length; j++) {
        particles[j].render(ctx);
      }
    }
    ctx.restore();
  });
})();
