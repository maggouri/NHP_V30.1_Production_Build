/**
 * ═══════════════════════════════════════════════════
 * 🎊 MerchGhost Confetti Library
 * ═══════════════════════════════════════════════════
 * Simple, reliable confetti animation
 */

// تعريف مباشر على window (قبل IIFE)
(function() {
  'use strict';

  // Canvas setup
  let canvas = null;
  let context = null;
  let animationId = null;
  let particles = [];
  let isRunning = false;

  function randomColor() {
    const colors = ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#9400D3', '#1E90FF', '#32CD32', '#FF69B4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function initCanvas() {
    if (canvas) return;

    canvas = document.createElement('canvas');
    canvas.id = 'merchghost-confetti-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999999;';
    document.body.appendChild(canvas);

    context = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener('resize', function() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }

  function Particle(x, y) {
    this.x = x || Math.random() * window.innerWidth;
    this.y = y || -10;
    this.r = Math.random() * 10 + 5;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = Math.random() * 3 + 2;
    this.gravity = 0.2;
    this.color = randomColor();
  }

  Particle.prototype.update = function() {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
  };

  Particle.prototype.draw = function() {
    context.fillStyle = this.color;
    context.fillRect(this.x - this.r / 2, this.y - this.r / 2, this.r, this.r);
  };

  Particle.prototype.isOffScreen = function() {
    return this.y > window.innerHeight + 20 || this.x < -20 || this.x > window.innerWidth + 20;
  };

  function animate() {
    if (!isRunning || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      var particle = particles[i];
      particle.update();
      particle.draw();

      if (particle.isOffScreen()) {
        particles.splice(i, 1);
      }
    }

    if (particles.length === 0) {
      stop();
      return;
    }

    animationId = requestAnimationFrame(animate);
  }

  function start(options) {
    options = options || {};
    initCanvas();

    var particleCount = options.particleCount || 150;
    var originX = (options.origin && options.origin.x !== undefined) ? options.origin.x * window.innerWidth : window.innerWidth / 2;
    var originY = (options.origin && options.origin.y !== undefined) ? options.origin.y * window.innerHeight : window.innerHeight / 2;
    var angle = options.angle || 90;
    var spread = options.spread || 45;

    isRunning = true;
    particles = [];

    for (var i = 0; i < particleCount; i++) {
      var rad = (angle - spread / 2 + Math.random() * spread) * Math.PI / 180;
      var particle = new Particle(originX, originY);
      particle.vx = Math.cos(rad) * (Math.random() * 5 + 3);
      particle.vy = Math.sin(rad) * (Math.random() * 5 + 3);
      particles.push(particle);
    }

    animate();

    setTimeout(function() {
      stop();
    }, 3000);
  }

  function stop() {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    particles = [];
    if (context && canvas) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function cleanup() {
    stop();
    if (canvas) {
      canvas.remove();
      canvas = null;
      context = null;
    }
  }

  // تعريف مباشر على window
  function fire(options) {
    start(options);
  }

  // Export immediately
  if (typeof window !== 'undefined') {
    window.confetti = fire;
    window.confetti.start = start;
    window.confetti.stop = stop;
    window.confetti.cleanup = cleanup;
    
    // Log for debugging
    console.log('✅ MerchGhost Confetti library initialized, window.confetti:', typeof window.confetti);
  }

})();
