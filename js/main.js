import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { initDialog, updateCharacterRef, isInDialogMode, updateDialogCamera } from './dialog.js';

// ===== AUDIO SYSTEM =====
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Background music
const bgMusic = new Audio('sons/music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.15;

// Footsteps sound
const stepsSound = new Audio('sons/steps.mp3');
stepsSound.loop = true;
stepsSound.volume = 0.5;
let isPlayingSteps = false;

// Walking camera bob variables
let walkBobTime = 0;
const WALK_BOB_SPEED = 15; // Speed of bobbing
const WALK_BOB_AMOUNT = 0.03; // Amount of vertical movement
let basePlayerHeight = CONFIG.PLAYER_HEIGHT;

// Start music on first user interaction
let musicStarted = false;
function startMusic() {
    if (!musicStarted) {
        musicStarted = true;
        // Only play if music is enabled in settings
        if (musicEnabled) {
            bgMusic.play().catch(e => console.log('Music autoplay blocked'));
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }
}

// Expose audio functions globally for quiz
window.playTrueSound = function() {
    const sound = new Audio('sons/true.mp3');
    sound.volume = 1.0; // Full volume for victory
    sound.play();
};

window.playFalseSound = function() {
    const sound = new Audio('sons/false.mp3');
    sound.volume = 1.0; // Full volume for defeat
    sound.play();
};

window.playClickSound = function() {
    const sound = new Audio('sons/clic.mp3');
    sound.volume = 0.2; // 50% reduced
    sound.play();
};

window.playSelectSound = function() {
    const sound = new Audio('sons/select.mp3');
    sound.volume = 0.25; // 50% reduced
    sound.play();
};

// ===== SETTINGS SYSTEM =====
let musicEnabled = true;

// Toggle settings menu
window.toggleSettings = function() {
    const menu = document.getElementById('settingsMenu');
    menu.classList.toggle('active');
};

// Toggle music on/off
window.toggleMusicSetting = function() {
    const toggle = document.getElementById('musicToggle');
    musicEnabled = toggle.checked;
    
    if (musicEnabled) {
        if (musicStarted) {
            bgMusic.play().catch(e => {});
        }
    } else {
        bgMusic.pause();
    }
    
    // Save preference
    localStorage.setItem('musicEnabled', musicEnabled);
};

// Music volume control for voice chat
const NORMAL_MUSIC_VOLUME = 0.15;

window.pauseMusicForVoiceChat = function() {
    bgMusic.pause();
};

window.resumeMusicAfterVoiceChat = function() {
    if (musicEnabled) {
        bgMusic.volume = NORMAL_MUSIC_VOLUME;
        bgMusic.play().catch(e => {});
    }
};

// Default voice for AI
const DEFAULT_VOICE = 'echo';

// Get selected voice (used by chat.js)
window.getSelectedVoice = function() {
    return localStorage.getItem('ai_voice') || DEFAULT_VOICE;
};

// Save voice setting
window.saveVoiceSetting = function() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) {
        localStorage.setItem('ai_voice', voiceSelect.value);
    }
};

// Load settings on startup
function loadSettings() {
    const musicToggle = document.getElementById('musicToggle');
    const voiceSelect = document.getElementById('voiceSelect');
    
    if (!musicToggle || !voiceSelect) {
        setTimeout(loadSettings, 100);
        return;
    }
    
    // Load music preference
    const savedMusic = localStorage.getItem('musicEnabled');
    if (savedMusic !== null) {
        musicEnabled = savedMusic === 'true';
        musicToggle.checked = musicEnabled;
    }
    
    // Load voice preference
    const savedVoice = localStorage.getItem('ai_voice') || DEFAULT_VOICE;
    voiceSelect.value = savedVoice;
}

// Initialize settings when DOM is ready
document.addEventListener('DOMContentLoaded', loadSettings);

// Scene setup
const scene = new THREE.Scene();

// Black background
scene.background = new THREE.Color(0x000000);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, CONFIG.PLAYER_HEIGHT, 4);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// Main spotlight from above (white)
const spotLight = new THREE.SpotLight(0xffffff, 10);
spotLight.position.set(0, 8, 0);
spotLight.angle = Math.PI / 5;
spotLight.penumbra = 0.5;
spotLight.decay = 1;
spotLight.distance = 20;
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
spotLight.shadow.camera.near = 1;
spotLight.shadow.camera.far = 20;
spotLight.shadow.bias = -0.001;
scene.add(spotLight);

// Target for spotlight
const spotLightTarget = new THREE.Object3D();
spotLightTarget.position.set(0, 0, 0);
scene.add(spotLightTarget);
spotLight.target = spotLightTarget;

// Warm light from the right (orange/yellow)
const warmLight = new THREE.SpotLight(0xffaa55, 10);
warmLight.position.set(3, 4, 2);
warmLight.angle = Math.PI / 4;
warmLight.penumbra = 0.6;
warmLight.decay = 1;
warmLight.distance = 15;
scene.add(warmLight);
warmLight.target = spotLightTarget;

// Cold light from the left (blue)
const coldLight = new THREE.SpotLight(0x5588ff, 10);
coldLight.position.set(-3, 4, 2);
coldLight.angle = Math.PI / 4;
coldLight.penumbra = 0.6;
coldLight.decay = 1;
coldLight.distance = 15;
scene.add(coldLight);
coldLight.target = spotLightTarget;

// Ground - dark floor to see the light spot
const groundGeometry = new THREE.PlaneGeometry(50, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x0a0a0a,
    roughness: 0.9,
    metalness: 0.1
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Game state
let gameStarted = false;

const blocker = document.getElementById('blocker');
const crosshair = document.getElementById('crosshair');

// Start game on click
blocker.addEventListener('click', () => {
    if (!gameStarted) {
        gameStarted = true;
        startMusic();
        // Fondu vers la scène
        blocker.classList.add('fade-out');
        crosshair.style.display = 'block';
        // Afficher le bouton paramètres
        document.getElementById('settingsBtn').classList.add('visible');
        setTimeout(() => {
            blocker.style.display = 'none';
        }, 1000);
    }
});

// Add camera to scene
scene.add(camera);

// ===== MOVEMENT SYSTEM (Keyboard only) =====
// Player rotation angle (Y axis)
let playerRotation = 0;
const ROTATION_SPEED = 2.5; // radians per second
const MOVE_SPEED = 2.5; // movement multiplier

// Input states
const keys = {
    forward: false,    // Z/W or ArrowUp
    backward: false,   // S or ArrowDown
    left: false,       // Q/A (strafe)
    right: false,      // D (strafe)
    rotateLeft: false, // ArrowLeft
    rotateRight: false // ArrowRight
};

document.addEventListener('keydown', (event) => {
    switch (event.code) {
        // Forward (Z/W or ArrowUp)
        case 'KeyW':
        case 'KeyZ':
        case 'ArrowUp':
            keys.forward = true;
            break;
        // Backward (S or ArrowDown)
        case 'KeyS':
        case 'ArrowDown':
            keys.backward = true;
            break;
        // Strafe left (Q/A)
        case 'KeyA':
        case 'KeyQ':
            keys.left = true;
            break;
        // Strafe right (D)
        case 'KeyD':
            keys.right = true;
            break;
        // Rotate left (ArrowLeft)
        case 'ArrowLeft':
            keys.rotateLeft = true;
            break;
        // Rotate right (ArrowRight)
        case 'ArrowRight':
            keys.rotateRight = true;
            break;
        // Space and Enter act as interaction
        case 'Space':
        case 'Enter':
            if (gameStarted && !isInDialogMode()) {
                event.preventDefault();
                simulateClick();
            }
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW':
        case 'KeyZ':
        case 'ArrowUp':
            keys.forward = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            keys.backward = false;
            break;
        case 'KeyA':
        case 'KeyQ':
            keys.left = false;
            break;
        case 'KeyD':
            keys.right = false;
            break;
        case 'ArrowLeft':
            keys.rotateLeft = false;
            break;
        case 'ArrowRight':
            keys.rotateRight = false;
            break;
    }
});

// ===== MOBILE CONTROLS =====
let isMobile = false;
let joystickActive = false;
let joystickData = { x: 0, y: 0 };

function initMobileControls() {
    // Detect touch device
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    const mobileControls = document.getElementById('mobileControls');
    const joystickZone = document.getElementById('joystickZone');
    const joystickBase = document.getElementById('joystickBase');
    const joystickKnob = document.getElementById('joystickKnob');
    
    if (!joystickZone) return;
    
    // Joystick touch handling
    let joystickTouchId = null;
    const maxDistance = 35; // Max knob movement from center
    
    joystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (joystickTouchId !== null) return;
        
        const touch = e.changedTouches[0];
        joystickTouchId = touch.identifier;
        joystickActive = true;
        updateJoystick(touch);
    }, { passive: false });
    
    joystickZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let touch of e.changedTouches) {
            if (touch.identifier === joystickTouchId) {
                updateJoystick(touch);
                break;
            }
        }
    }, { passive: false });
    
    joystickZone.addEventListener('touchend', (e) => {
        for (let touch of e.changedTouches) {
            if (touch.identifier === joystickTouchId) {
                joystickTouchId = null;
                joystickActive = false;
                joystickData = { x: 0, y: 0 };
                joystickKnob.style.transform = 'translate(-50%, -50%)';
                break;
            }
        }
    });
    
    joystickZone.addEventListener('touchcancel', () => {
        joystickTouchId = null;
        joystickActive = false;
        joystickData = { x: 0, y: 0 };
        joystickKnob.style.transform = 'translate(-50%, -50%)';
    });
    
    function updateJoystick(touch) {
        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let deltaX = touch.clientX - centerX;
        let deltaY = touch.clientY - centerY;
        
        // Limit to max distance
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > maxDistance) {
            deltaX = (deltaX / distance) * maxDistance;
            deltaY = (deltaY / distance) * maxDistance;
        }
        
        // Update knob position
        joystickKnob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
        
        // Normalize to -1 to 1
        joystickData.x = deltaX / maxDistance;
        joystickData.y = -deltaY / maxDistance; // Invert Y (up is positive)
    }
    
}

// Mobile interact function (called from hint click)
window.mobileInteract = function() {
    if (gameStarted && !isInDialogMode()) {
        simulateClick();
    }
};

// Show/hide mobile controls based on dialog state
window.updateMobileControlsVisibility = function() {
    const mobileControls = document.getElementById('mobileControls');
    if (mobileControls) {
        if (isInDialogMode()) {
            mobileControls.classList.add('hidden');
        } else {
            mobileControls.classList.remove('hidden');
        }
    }
};

// Initialize mobile controls when DOM is ready
document.addEventListener('DOMContentLoaded', initMobileControls);

// Character variables
let character = null;
let mixer = null;
let animations = {};
let currentAction = null;
let isPlayingOneShot = false;

// Collision box for character
let characterCollider = null;

// Load character
const loader = new GLTFLoader();
loader.load(CONFIG.CHARACTER_MODEL, (gltf) => {
    character = gltf.scene;
    character.position.set(0, 0, 0);
    character.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Fix textures color space
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                    if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                });
            }
        }
    });
    scene.add(character);
    
    // Create invisible collision box around character
    const colliderGeometry = new THREE.BoxGeometry(1, 2, 1);
    const colliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
    characterCollider = new THREE.Mesh(colliderGeometry, colliderMaterial);
    characterCollider.position.set(0, 1, 0); // Center at character height
    scene.add(characterCollider);

    // Setup animations
    mixer = new THREE.AnimationMixer(character);
    
    gltf.animations.forEach((clip) => {
        animations[clip.name] = mixer.clipAction(clip);
    });

    // Play idle animation
    if (animations[CONFIG.ANIMATIONS.IDLE]) {
        currentAction = animations[CONFIG.ANIMATIONS.IDLE];
        currentAction.play();
    }
    
    // Update dialog with character reference
    updateCharacterRef(character);
}, undefined, (error) => {
    console.error('Erreur chargement modèle:', error);
});

// Play animation once then return to idle
function playOneShotAnimation(animName, onComplete) {
    if (!animations[animName]) return;
    
    isPlayingOneShot = true;
    
    const newAction = animations[animName];
    newAction.reset();
    newAction.setLoop(THREE.LoopOnce, 1);
    newAction.clampWhenFinished = true;
    
    if (currentAction) {
        currentAction.fadeOut(0.2);
    }
    
    newAction.fadeIn(0.2);
    newAction.play();
    
    const onFinished = (e) => {
        if (e.action === newAction) {
            mixer.removeEventListener('finished', onFinished);
            isPlayingOneShot = false;
            
            if (onComplete) {
                // If there's a callback, call it (it will handle next animation)
                onComplete();
            } else {
                // Return to idle only if no callback
                if (animations[CONFIG.ANIMATIONS.IDLE]) {
                    newAction.fadeOut(0.2);
                    currentAction = animations[CONFIG.ANIMATIONS.IDLE];
                    currentAction.reset();
                    currentAction.setLoop(THREE.LoopRepeat);
                    currentAction.fadeIn(0.2);
                    currentAction.play();
                }
            }
        }
    };
    
    mixer.addEventListener('finished', onFinished);
}

// Play talk animation once (for quiz questions and chat responses)
function playTalkAnimation() {
    if (!mixer || !animations[CONFIG.ANIMATIONS.TALK]) {
        console.warn('Animation not ready');
        return;
    }
    playOneShotAnimation(CONFIG.ANIMATIONS.TALK);
}

// Play happy animation (correct answer)
function playHappyAnimation() {
    if (!mixer || !animations[CONFIG.ANIMATIONS.HAPPY]) {
        console.warn('Happy animation not ready');
        return;
    }
    playOneShotAnimation(CONFIG.ANIMATIONS.HAPPY);
}

// Play sad animation (wrong answer)
function playSadAnimation() {
    if (!mixer || !animations[CONFIG.ANIMATIONS.SAD]) {
        console.warn('Sad animation not ready');
        return;
    }
    playOneShotAnimation(CONFIG.ANIMATIONS.SAD);
}

// Play talk long animation in loop while speaking (for voice chat)
let talkLongAction = null;
let isTalkLongActive = false;

function playTalkLongAnimation() {
    if (!mixer || !animations[CONFIG.ANIMATIONS.TALK_LONG]) {
        console.warn('Talk long animation not ready, available:', Object.keys(animations));
        return;
    }
    
    // Already playing in loop, nothing to do
    if (isTalkLongActive) {
        return;
    }
    
    isTalkLongActive = true;
    
    // Get the action
    talkLongAction = animations[CONFIG.ANIMATIONS.TALK_LONG];
    
    // Set to loop infinitely while speaking
    talkLongAction.setLoop(THREE.LoopRepeat);
    talkLongAction.clampWhenFinished = false;
    
    // Crossfade from current animation
    if (currentAction && currentAction !== talkLongAction) {
        talkLongAction.reset();
        talkLongAction.setEffectiveTimeScale(1);
        talkLongAction.setEffectiveWeight(1);
        currentAction.crossFadeTo(talkLongAction, 0.3, true);
        talkLongAction.play();
    } else {
        talkLongAction.reset();
        talkLongAction.fadeIn(0.3);
        talkLongAction.play();
    }
}

function stopTalkLongAnimation() {
    if (!isTalkLongActive) {
        return;
    }
    
    isTalkLongActive = false;
    
    // Crossfade back to idle
    if (mixer && animations[CONFIG.ANIMATIONS.IDLE] && talkLongAction) {
        const idleAction = animations[CONFIG.ANIMATIONS.IDLE];
        idleAction.reset();
        idleAction.setEffectiveTimeScale(1);
        idleAction.setEffectiveWeight(1);
        talkLongAction.crossFadeTo(idleAction, 0.3, true);
        idleAction.play();
        currentAction = idleAction;
    }
    
    talkLongAction = null;
}

// Expose globally for other modules
window.playTalkAnimation = playTalkAnimation;
window.playHappyAnimation = playHappyAnimation;
window.playSadAnimation = playSadAnimation;
window.playTalkLongAnimation = playTalkLongAnimation;
window.stopTalkLongAnimation = stopTalkLongAnimation;

// Raycaster for clicking
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

// Function to handle interaction (used by space, enter)
function handleInteraction() {
    if (!gameStarted || !character) return;
    
    raycaster.setFromCamera(center, camera);
    const intersects = raycaster.intersectObject(character, true);
    
    if (intersects.length > 0) {
        const distance = intersects[0].distance;
        if (distance < CONFIG.INTERACTION_DISTANCE) {
            // Hide hint when opening dialog
            document.getElementById('interactionHint').classList.remove('visible');
            playOneShotAnimation(CONFIG.ANIMATIONS.TALK);
            window.openDialog();
        }
    }
}

// Simulate click for keyboard accessibility (Space/Enter)
function simulateClick() {
    handleInteraction();
}

// Track if character has already turned
let lastTurnDirection = null;

// Rotation animation variables
let isRotating = false;
let rotationStartY = 0;
let rotationTargetY = 0;
let rotationProgress = 0;

// Animation loop
const clock = new THREE.Clock();

// Initialize dialog system
initDialog(null, camera, character, clock);

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Update mixer
    if (mixer) mixer.update(delta);
    
    // Movement (only when game started and not in dialog mode)
    if (gameStarted && !isInDialogMode()) {
        // Save position before moving (for collision)
        const prevPosition = camera.position.clone();
        
        // Rotation (ArrowLeft / ArrowRight or joystick X axis)
        let rotationInput = 0;
        if (keys.rotateLeft) rotationInput += 1;
        if (keys.rotateRight) rotationInput -= 1;
        if (joystickActive) rotationInput -= joystickData.x * 0.8; // Joystick X for rotation
        
        playerRotation += rotationInput * ROTATION_SPEED * delta;
        
        // Apply rotation to camera
        camera.rotation.set(0, playerRotation, 0);
        
        // Calculate movement direction vectors based on player rotation
        const forward = new THREE.Vector3(
            -Math.sin(playerRotation),
            0,
            -Math.cos(playerRotation)
        );
        const right = new THREE.Vector3(
            Math.cos(playerRotation),
            0,
            -Math.sin(playerRotation)
        );
        
        // Calculate movement
        const moveSpeed = CONFIG.PLAYER_SPEED * MOVE_SPEED * delta;
        
        // Forward/Backward input (keyboard or joystick Y axis)
        let forwardInput = 0;
        if (keys.forward) forwardInput += 1;
        if (keys.backward) forwardInput -= 0.5; // Backward is slower
        if (joystickActive && Math.abs(joystickData.y) > 0.1) {
            forwardInput += joystickData.y; // Joystick Y for forward/backward
        }
        
        // Strafe input (keyboard only, joystick X is for rotation)
        let strafeInput = 0;
        if (keys.left) strafeInput -= 1;
        if (keys.right) strafeInput += 1;
        
        // Apply movement
        if (forwardInput !== 0) {
            camera.position.addScaledVector(forward, forwardInput * moveSpeed);
        }
        if (strafeInput !== 0) {
            camera.position.addScaledVector(right, strafeInput * moveSpeed);
        }
        
        // Walking detection
        const isWalkingForward = keys.forward || (joystickActive && joystickData.y > 0.1);
        const isWalkingBackward = keys.backward || (joystickActive && joystickData.y < -0.1);
        
        // Camera bob and footsteps
        if (isWalkingForward) {
            // Forward: normal bob
            walkBobTime += delta * WALK_BOB_SPEED;
            const bobOffset = Math.sin(walkBobTime) * WALK_BOB_AMOUNT;
            camera.position.y = basePlayerHeight + bobOffset;
            
            // Play footstep sound
            if (!isPlayingSteps) {
                isPlayingSteps = true;
                stepsSound.currentTime = 0;
                stepsSound.play().catch(e => {});
            }
        } else if (isWalkingBackward) {
            // Backward: faster but smaller bob
            walkBobTime += delta * WALK_BOB_SPEED * 1.5;
            const bobOffset = Math.sin(walkBobTime) * WALK_BOB_AMOUNT * 0.6;
            camera.position.y = basePlayerHeight + bobOffset;
            
            // Play footstep sound
            if (!isPlayingSteps) {
                isPlayingSteps = true;
                stepsSound.currentTime = 0;
                stepsSound.play().catch(e => {});
            }
        } else {
            // Stop walking
            if (isPlayingSteps) {
                isPlayingSteps = false;
                stepsSound.pause();
            }
            // Smoothly return camera to base height
            camera.position.y += (basePlayerHeight - camera.position.y) * 0.1;
            walkBobTime = 0;
        }
        
        // Check collision with character
        if (characterCollider) {
            const playerPos = new THREE.Vector3(camera.position.x, 0, camera.position.z);
            const colliderPos = new THREE.Vector3(characterCollider.position.x, 0, characterCollider.position.z);
            const distance = playerPos.distanceTo(colliderPos);
            
            // If too close, revert position
            if (distance < 0.8) {
                camera.position.x = prevPosition.x;
                camera.position.z = prevPosition.z;
            }
        }
    }
    
    // Dialog camera animation
    updateDialogCamera();
    
    // Update rotation animation
    if (isRotating && character) {
        rotationProgress += delta / CONFIG.ROTATION_DURATION;
        if (rotationProgress >= 1) {
            rotationProgress = 1;
            isRotating = false;
        }
        // Smooth interpolation (ease out)
        const t = 1 - Math.pow(1 - rotationProgress, 2);
        character.rotation.y = rotationStartY + (rotationTargetY - rotationStartY) * t;
    }
    
    // Character behavior (disabled in dialog mode)
    if (character && !isPlayingOneShot && !isRotating && !isInDialogMode()) {
        const playerPos = camera.position.clone();
        playerPos.y = 0;
        const charPos = character.position.clone();
        charPos.y = 0;
        
        const distance = playerPos.distanceTo(charPos);
        
        // Show/hide interaction hint based on distance
        const interactionHint = document.getElementById('interactionHint');
        const canInteract = distance < CONFIG.INTERACTION_DISTANCE;
        if (canInteract) {
            interactionHint.classList.add('visible');
        } else {
            interactionHint.classList.remove('visible');
        }
        
        if (distance < CONFIG.DETECTION_DISTANCE) {
            // Direction from character to player
            const dirToPlayer = new THREE.Vector3().subVectors(playerPos, charPos).normalize();
            
            // Character forward direction
            const charForward = new THREE.Vector3(0, 0, 1).applyQuaternion(character.quaternion);
            
            // Angle between character forward and direction to player
            const angle = Math.atan2(
                charForward.x * dirToPlayer.z - charForward.z * dirToPlayer.x,
                charForward.x * dirToPlayer.x + charForward.z * dirToPlayer.z
            ) * (180 / Math.PI);
            
            if (Math.abs(angle) > CONFIG.TURN_ANGLE_THRESHOLD) {
                // Calculate target rotation to face player
                const targetAngle = Math.atan2(dirToPlayer.x, dirToPlayer.z);
                
                if (angle > CONFIG.TURN_ANGLE_THRESHOLD && lastTurnDirection !== 'right') {
                    // Player is on the right
                    lastTurnDirection = 'right';
                    rotationStartY = character.rotation.y;
                    rotationTargetY = targetAngle;
                    rotationProgress = 0;
                    isRotating = true;
                    playOneShotAnimation(CONFIG.ANIMATIONS.TURN_RIGHT);
                } else if (angle < -CONFIG.TURN_ANGLE_THRESHOLD && lastTurnDirection !== 'left') {
                    // Player is on the left
                    lastTurnDirection = 'left';
                    rotationStartY = character.rotation.y;
                    rotationTargetY = targetAngle;
                    rotationProgress = 0;
                    isRotating = true;
                    playOneShotAnimation(CONFIG.ANIMATIONS.TURN_LEFT);
                }
            } else {
                lastTurnDirection = null;
            }
        } else {
            lastTurnDirection = null;
        }
    }
    
    renderer.render(scene, camera);
}

animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
