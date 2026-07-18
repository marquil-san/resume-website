import {
  updateKeycapBackground
} from "./keycap-background.js";
/**
 * Frozen OS Portfolio - Main Logic
 * Handles 3D parallax, continuous floating, hover states, 
 * internal ice texture crossfading, and click ripple effects.
 */

// --- CONFIGURATION ---
const NOISE_IMAGES = [
  '/assets/noise/frost1.jpg',
  '/assets/noise/frost2.jpg',
  '/assets/noise/frost3.jpg',
  '/assets/noise/frost4.jpg',
  '/assets/noise/frost5.jpg',
  '/assets/noise/frost6.jpg'
];

const PARALLAX_SENSITIVITY = 0.05; // How much cursor affects elements
const FLOAT_SPEED = 0.001; // Base speed for sine wave floating
const MAX_ROTATION_DEG = 4; // Max rotation for parallax/float
const IS_MOBILE = window.innerWidth <= 1024;

// --- STATE ---
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;
let time = 0;

// Element tracking
const cards = [];
const interactives = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initIceTextures();
  setupEventListeners();
  
  if (!IS_MOBILE) {
    requestAnimationFrame(renderLoop);
  } else {
    // On mobile, just do static hover/click effects, disable heavy 3D math
    document.body.style.overflow = 'auto';
  }
});

function initElements() {
  // Setup top-level cards
  document.querySelectorAll('[data-card]').forEach((el, index) => {
    cards.push({
      el,
      // Randomize float properties per card so they don't sync
      floatOffset: Math.random() * Math.PI * 2,
      floatSpeedX: FLOAT_SPEED * (0.8 + Math.random() * 0.4),
      floatSpeedY: FLOAT_SPEED * (0.8 + Math.random() * 0.4),
      floatAmp: 10 + Math.random() * 15, // px translation
      depth: 1 - (index * 0.1), // Parallax depth
      isHovered: false
    });
    
    // Cards themselves are interactive surfaces
    interactives.push(el);
  });

  // Setup nested interactive elements (buttons, links, pfp)
  document.querySelectorAll('[data-interactive]').forEach(el => {
    if (!interactives.includes(el)) {
      interactives.push(el);
    }
  });
}

/**
 * Preloads noise images and injects them as absolutely positioned layers
 * inside every frozen element.
 */
function initIceTextures() {
  // Preload
  NOISE_IMAGES.forEach(src => {
    const img = new Image();
    img.src = src;
  });

  interactives.forEach(el => {
    // Create two layers for crossfading
    const layer1 = document.createElement('div');
    layer1.className = 'ice-layer layer-1';
    
    const layer2 = document.createElement('div');
    layer2.className = 'ice-layer layer-2';

    // Set initial random textures and properties
    applyRandomTexture(layer1);
    applyRandomTexture(layer2);
    
    // Randomize initial scale/rotation so no two elements look identical
    layer1.style.transform = `scale(${1 + Math.random()*0.5}) rotate(${Math.random()*360}deg)`;
    layer2.style.transform = `scale(${1 + Math.random()*0.5}) rotate(${Math.random()*360}deg)`;

    // Make layer1 active initially
    layer1.classList.add('active');

    el.insertBefore(layer2, el.firstChild);
    el.insertBefore(layer1, el.firstChild);

    // Store state on the element for the animation loop
    el._iceState = {
      layer1, layer2,
      activeLayer: 1,
      timer: null,
      isCrossfading: false
    };
  });
}

function applyRandomTexture(layer) {
  const src = NOISE_IMAGES[Math.floor(Math.random() * NOISE_IMAGES.length)];
  layer.style.backgroundImage = `url(${src})`;
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Mouse tracking for parallax
  document.addEventListener('mousemove', (e) => {
    // Normalize to -1 to 1 based on center of screen
    targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // Interactions for all frozen elements
  interactives.forEach(el => {
    // Hover Enter
    el.addEventListener('mouseenter', () => {
      el.classList.add('is-hovered');
      
      // If it's a root card, update its tracker
      const cardState = cards.find(c => c.el === el);
      if (cardState) cardState.isHovered = true;

      // Start delayed crossfade
      startIceCrossfade(el);
    });

    // Hover Leave
    el.addEventListener('mouseleave', () => {
      el.classList.remove('is-hovered');
      
      const cardState = cards.find(c => c.el === el);
      if (cardState) cardState.isHovered = false;

      stopIceCrossfade(el);
    });

    // Mousedown / Touchstart (Compress)
    el.addEventListener('mousedown', (e) => handleInteractionStart(e, el));
    el.addEventListener('touchstart', (e) => handleInteractionStart(e.touches[0], el), {passive: true});

    // Mouseup / Touchend (Release)
    el.addEventListener('mouseup', () => handleInteractionEnd(el));
    el.addEventListener('touchend', () => handleInteractionEnd(el));
    el.addEventListener('mouseleave', () => handleInteractionEnd(el));
  });

  // Copy button specific logic
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const text = btn.getAttribute('data-copy');
      navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 2000);
      });
    });
  });
}

function handleInteractionStart(e, el) {
  el.classList.add('is-active');
  createCrackRipple(e.clientX, e.clientY);
}

function handleInteractionEnd(el) {
  el.classList.remove('is-active');
}

// --- ICE CROSSFADE LOGIC ---
function startIceCrossfade(el) {
  if (el._iceState.isCrossfading) return;
  el._iceState.isCrossfading = true;

  // Wait for the frost border animation to finish (CSS transition is ~0.6s)
  el._iceState.timer = setTimeout(() => {
    doCrossfadeStep(el);
  }, 700);
}

function stopIceCrossfade(el) {
  el._iceState.isCrossfading = false;
  clearTimeout(el._iceState.timer);
}

function doCrossfadeStep(el) {
  if (!el._iceState.isCrossfading) return;

  const state = el._iceState;
  
  if (state.activeLayer === 1) {
    // Prepare layer 2 with new random texture/transform
    applyRandomTexture(state.layer2);
    state.layer2.style.transform = `scale(${1 + Math.random()*0.5}) rotate(${Math.random()*360}deg)`;
    
    // Fade to 2
    state.layer2.classList.add('active');
    state.layer1.classList.remove('active');
    state.activeLayer = 2;
  } else {
    // Prepare layer 1
    applyRandomTexture(state.layer1);
    state.layer1.style.transform = `scale(${1 + Math.random()*0.5}) rotate(${Math.random()*360}deg)`;
    
    // Fade to 1
    state.layer1.classList.add('active');
    state.layer2.classList.remove('active');
    state.activeLayer = 1;
  }

  // Schedule next crossfade (CSS transition is 2s, wait a bit longer)
  // Randomize interval so cards desync
  const nextDelay = 2500 + Math.random() * 2000;
  state.timer = setTimeout(() => doCrossfadeStep(el), nextDelay);
}


// --- CRACK RIPPLE EFFECT ---
function createCrackRipple(x, y) {
  const container = document.getElementById('crack-ripple-container');
  if (!container) return;

  const ripple = document.createElement('div');
  ripple.className = 'crack-ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  
  // Randomize initial rotation to vary the shape feel if border radius wasn't 50%
  // But since it is, this just prepares for potential SVG crack injection later
  ripple.style.transform = `translate(-50%, -50%) scale(0) rotate(${Math.random()*360}deg)`;

  container.appendChild(ripple);

  // Clean up DOM after animation
  setTimeout(() => {
    ripple.remove();
  }, 650); // Matches CSS animation duration + buffer
}


// --- RENDER LOOP (3D Math) ---
function renderLoop(now) {
  time = now;

  // Ease mouse position for smooth parallax
  mouseX += (targetMouseX - mouseX) * 0.1;
  mouseY += (targetMouseY - mouseY) * 0.1;

  cards.forEach(card => {
    const { el, floatOffset, floatSpeedX, floatSpeedY, floatAmp, depth, isHovered } = card;

    let translateX = 0;
    let translateY = 0;
    let rotateX = 0;
    let rotateY = 0;
    let scale = 1;

    if (isHovered) {
      // When hovered, stop floating, ease to 0 rotation, scale slightly up
      // The CSS transition handles the scaling, we just reset transforms
      el.style.transform = `translate(0px, 0px) rotateX(0deg) rotateY(0deg) scale(1.02)`;
      return; // Skip math
    }

    // 1. Continuous Floating (Sine waves)
    const floatX = Math.sin(time * floatSpeedX + floatOffset) * floatAmp;
    const floatY = Math.cos(time * floatSpeedY + floatOffset) * floatAmp;

    // 2. Parallax (Mouse influence)
    // Distance from center dictates influence
    const paraX = mouseX * 50 * depth;
    const paraY = mouseY * 50 * depth;

    // Combine translations
    translateX = floatX + paraX;
    translateY = floatY + paraY;

    // Rotations based on mouse position relative to element center
    // Gives the illusion of looking "at" the card from the cursor
    rotateX = -mouseY * MAX_ROTATION_DEG * depth;
    rotateY = mouseX * MAX_ROTATION_DEG * depth;

    // Add a tiny bit of rotation from the float
    rotateX += Math.sin(time * floatSpeedX * 0.5) * 1;
    rotateY += Math.cos(time * floatSpeedY * 0.5) * 1;

    // Apply transform
    el.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
  updateKeycapBackground();
  requestAnimationFrame(renderLoop);
}
