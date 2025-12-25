// --- Configuration ---
const CONFIG = {
    color1: new THREE.Color(0x8b5cf6), // Purple
    color2: new THREE.Color(0xa78bfa), // Lighter Purple
    collisionSpeed: 0.08,
    pulseSpeed: 0.02,
    waitTime: 200, // Frames to wait before colliding
};

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

camera.position.z = 5;

// --- GLSL Shaders (The "Fluid" Look) ---
const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float time;
    
    // Simplex noise function
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute( permute( permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
        vUv = uv;
        vNormal = normal;
        
        // Displace vertices based on noise to make it "bubble"
        float noiseVal = snoise(position * 2.0 + time * 0.5);
        vec3 newPos = position + normal * noiseVal * 0.2;
        
        vPosition = newPos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
`;

const fragmentShader = `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    uniform vec3 color;
    uniform float time;
    uniform float opacity;

    void main() {
        // Simple rim lighting to look like glowing plasma
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float intensity = pow(0.6 - dot(vNormal, viewDir), 2.0);
        
        vec3 finalColor = color * intensity * 2.5 + color * 0.2;
        gl_FragColor = vec4(finalColor, opacity);
    }
`;

// --- Object Creation ---
const geometry = new THREE.SphereGeometry(1.2, 64, 64);

const material1 = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        color: { value: CONFIG.color1 },
        opacity: { value: 0.8 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending
});

const material2 = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        color: { value: CONFIG.color2 },
        opacity: { value: 0.8 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending
});

const frcLeft = new THREE.Mesh(geometry, material1);
const frcRight = new THREE.Mesh(geometry, material2);

scene.add(frcLeft);
scene.add(frcRight);

// --- Animation State Logic ---
let state = 'IDLE'; // IDLE, COLLIDING, MERGED, RESETTING
let timer = 0;
const startX = 4.5;

function resetPositions() {
    frcLeft.position.x = -startX;
    frcRight.position.x = startX;
    frcLeft.scale.set(1,1,1);
    frcRight.scale.set(1,1,1);
    material1.uniforms.opacity.value = 0.8;
    material2.uniforms.opacity.value = 0.8;
}

resetPositions();

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    // Update Shader Time (makes the fluid move)
    material1.uniforms.time.value += 0.02;
    material2.uniforms.time.value += 0.02;

    // State Machine
    if (state === 'IDLE') {
        timer++;
        
        // Gentle pulsing
        const scale = 1 + Math.sin(Date.now() * CONFIG.pulseSpeed * 0.1) * 0.05;
        frcLeft.scale.set(scale, scale, scale);
        frcRight.scale.set(scale, scale, scale);

        // Transition to collision
        if (timer > CONFIG.waitTime) {
            state = 'COLLIDING';
        }
    } 
    else if (state === 'COLLIDING') {
        // Accelerate towards center
        frcLeft.position.x += CONFIG.collisionSpeed;
        frcRight.position.x -= CONFIG.collisionSpeed;

        // Check collision distance
        if (frcLeft.position.x >= 0) {
            state = 'MERGED';
            timer = 0;
        }
    } 
    else if (state === 'MERGED') {
        timer++;
        
        // Big flash explosion effect
        const explosionScale = 1 + (timer * 0.1);
        frcLeft.scale.set(explosionScale, explosionScale, explosionScale);
        frcRight.scale.set(explosionScale, explosionScale, explosionScale);
        
        // Fade out
        material1.uniforms.opacity.value -= 0.03;
        material2.uniforms.opacity.value -= 0.03;

        if (timer > 50) {
            resetPositions();
            state = 'RESETTING';
            timer = 0;
        }
    }
    else if (state === 'RESETTING') {
        timer++;
        // Fade back in at start positions
        if (material1.uniforms.opacity.value < 0.8) {
            material1.uniforms.opacity.value += 0.02;
            material2.uniforms.opacity.value += 0.02;
        } else {
            state = 'IDLE';
            timer = 0;
        }
    }

    renderer.render(scene, camera);
}

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
