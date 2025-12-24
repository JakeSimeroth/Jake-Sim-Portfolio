const canvas = document.getElementById('plasmaCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];

// Configuration for the Plasma FRCs
const config = {
    particleCount: 150,    // How many particles per FRC ring
    baseSpeed: 2,          // Approach speed
    glowSize: 40,          // Size of the glow
    color1: '139, 92, 246', // Purple (Left FRC)
    color2: '167, 139, 250' // Light Purple (Right FRC)
};

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

class Particle {
    constructor(side) {
        this.reset(side, true);
    }

    reset(side, initial = false) {
        this.side = side; // 'left' or 'right'
        
        // Spawn positions: Far left or Far right
        if (side === 'left') {
            this.x = initial ? Math.random() * (width/2) : -100;
            this.vx = Math.random() * config.baseSpeed + 1;
        } else {
            this.x = initial ? Math.random() * (width/2) + width/2 : width + 100;
            this.vx = -(Math.random() * config.baseSpeed + 1);
        }

        // Vertical spread (Plasma thickness)
        this.y = height / 2 + (Math.random() - 0.5) * 300;
        this.vy = (Math.random() - 0.5) * 0.5;

        this.life = Math.random(); 
        this.decay = 0.005 + Math.random() * 0.01;
        this.size = Math.random() * config.glowSize + 10;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;

        // Collision Simulation: 
        // If particle reaches center, slow down and spread out (simulating magnetic pressure)
        const distToCenter = Math.abs(this.x - width/2);
        
        if (distToCenter < 100) {
            this.vx *= 0.9; // Decelerate at collision
            this.y += (Math.random() - 0.5) * 3; // Turbulence
        }

        // Reset if dead or off screen
        if (this.life <= 0 || (this.side === 'left' && this.x > width) || (this.side === 'right' && this.x < 0)) {
            this.reset(this.side);
        }
    }

    draw() {
        ctx.beginPath();
        // Create gradient for soft plasma look
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        
        const alpha = this.life * 0.4; // Transparency
        const color = this.side === 'left' ? config.color1 : config.color2;
        
        gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);

        ctx.fillStyle = gradient;
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function init() {
    resize();
    particles = [];
    // Create Left FRC Particles
    for (let i = 0; i < config.particleCount; i++) {
        particles.push(new Particle('left'));
    }
    // Create Right FRC Particles
    for (let i = 0; i < config.particleCount; i++) {
        particles.push(new Particle('right'));
    }
}

function animate() {
    // Clear with semi-transparent black for trail effect
    ctx.fillStyle = 'rgba(15, 15, 17, 0.2)';
    ctx.fillRect(0, 0, width, height);

    // Additive blending makes overlapping particles glow brightly
    ctx.globalCompositeOperation = 'lighter';

    particles.forEach(p => {
        p.update();
        p.draw();
    });

    // Reset blend mode
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
init();
animate();
