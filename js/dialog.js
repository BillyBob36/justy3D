import * as THREE from 'three';
import { startQuiz } from './quiz.js';
import { startChat, sendMessage, toggleVoice, initChatListeners, toggleVoiceToVoice, stopVoiceToVoice } from './chat.js';
import { CONFIG } from './config.js';

let controls = null;
let camera = null;
let character = null;
let clock = null;

// Camera dialog mode
let isDialogMode = false;
let savedCameraPosition = null;
let savedCameraQuaternion = null;

// Camera transition
let isTransitioning = false;
let transitionStartTime = 0;
let transitionStartPos = null;
let transitionEndPos = null;
let transitionStartQuat = null;
let transitionEndQuat = null;

// Keyboard navigation state
let menuSelectedIndex = 0;
let dialogJustOpened = false; // Flag to prevent immediate key capture after opening dialog

export function initDialog(controlsRef, cameraRef, characterRef, clockRef) {
    controls = controlsRef;
    camera = cameraRef;
    character = characterRef;
    clock = clockRef;
    
    // Expose functions to window for HTML onclick
    window.openDialog = openDialog;
    window.closeDialog = closeDialog;
    window.backToMenu = backToMenu;
    window.startQuiz = startQuiz;
    window.startChat = startChat;
    window.sendMessage = sendMessage;
    window.toggleVoice = toggleVoice;
    window.toggleVoiceToVoice = toggleVoiceToVoice;
    
    // Init chat listeners
    initChatListeners();
    
    // Init keyboard navigation for dialog
    initDialogKeyboard();
    
    // Init mouse events for menu (after DOM is ready)
    setTimeout(initMenuMouseEvents, 100);
}

// Keyboard navigation for dialog menus
function initDialogKeyboard() {
    const dialogOverlay = document.getElementById('dialogOverlay');
    if (!dialogOverlay) {
        console.warn('dialogOverlay not found, retrying...');
        setTimeout(initDialogKeyboard, 100);
        return;
    }
    
    document.addEventListener('keydown', (event) => {
        if (!dialogOverlay.classList.contains('active')) return;
        if (dialogJustOpened) return; // Ignore keys right after dialog opens
        
        const mainMenu = document.getElementById('mainMenu');
        const quizContainer = document.getElementById('quizContainer');
        const chatContainer = document.getElementById('chatContainer');
        const quizScore = document.getElementById('quizScore');
        
        // Main menu navigation
        if (mainMenu.style.display !== 'none') {
            const menuBtns = mainMenu.querySelectorAll('.menu-btn');
            if (menuBtns.length === 0) return;
            
            switch (event.code) {
                case 'ArrowUp':
                case 'ArrowLeft':
                    event.preventDefault();
                    menuSelectedIndex = (menuSelectedIndex - 1 + menuBtns.length) % menuBtns.length;
                    updateMenuSelection();
                    if (window.playClickSound) window.playClickSound();
                    break;
                case 'ArrowDown':
                case 'ArrowRight':
                    event.preventDefault();
                    menuSelectedIndex = (menuSelectedIndex + 1) % menuBtns.length;
                    updateMenuSelection();
                    if (window.playClickSound) window.playClickSound();
                    break;
                case 'Space':
                case 'Enter':
                    event.preventDefault();
                    if (window.playSelectSound) window.playSelectSound();
                    menuBtns[menuSelectedIndex].click();
                    break;
                case 'Escape':
                    event.preventDefault();
                    closeDialog();
                    break;
            }
        }
        // Quiz score screen navigation
        else if (quizContainer.classList.contains('active') && quizScore.style.display !== 'none') {
            switch (event.code) {
                case 'Space':
                case 'Enter':
                    event.preventDefault();
                    startQuiz(); // Restart quiz
                    break;
                case 'Escape':
                case 'Backspace':
                    event.preventDefault();
                    backToMenu();
                    break;
            }
        }
        // Chat container - Space/Enter to toggle voice, Escape to go back
        else if (chatContainer.classList.contains('active')) {
            switch (event.code) {
                case 'Space':
                case 'Enter':
                    event.preventDefault();
                    // Toggle Voice-to-Voice
                    if (typeof toggleVoiceToVoice === 'function') {
                        toggleVoiceToVoice();
                    }
                    break;
                case 'Escape':
                    event.preventDefault();
                    backToMenu();
                    break;
            }
        }
        // Quiz container - Escape to go back (handled in quiz.js for answers)
        else if (quizContainer.classList.contains('active')) {
            if (event.code === 'Escape' || event.code === 'Backspace') {
                event.preventDefault();
                backToMenu();
            }
        }
    });
}

function updateMenuSelection() {
    const menuBtns = document.querySelectorAll('#mainMenu .menu-btn');
    menuBtns.forEach((btn, index) => {
        if (index === menuSelectedIndex) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function clearMenuSelection() {
    const menuBtns = document.querySelectorAll('#mainMenu .menu-btn');
    menuBtns.forEach(btn => btn.classList.remove('selected'));
}

function initMenuMouseEvents() {
    const menuBtns = document.querySelectorAll('#mainMenu .menu-btn');
    menuBtns.forEach((btn, index) => {
        btn.addEventListener('mouseenter', () => {
            clearMenuSelection();
            btn.classList.add('selected');
            menuSelectedIndex = index;
            if (window.playClickSound) window.playClickSound();
        });
        btn.addEventListener('mouseleave', () => {
            btn.classList.remove('selected');
        });
    });
}

export function updateCharacterRef(char) {
    character = char;
}

export function isInDialogMode() {
    return isDialogMode;
}

function openDialog() {
    // Save current camera state before dialog
    savedCameraPosition = camera.position.clone();
    savedCameraQuaternion = camera.quaternion.clone();
    
    // Reset to main menu state
    document.getElementById('mainMenu').style.display = 'flex';
    document.getElementById('quizContainer').classList.remove('active');
    document.getElementById('chatContainer').classList.remove('active');
    
    document.getElementById('dialogOverlay').classList.add('active');
    
    // Prevent the Enter key that opened the dialog from triggering menu selection
    dialogJustOpened = true;
    setTimeout(() => { dialogJustOpened = false; }, 100);
    
    // Enter dialog camera mode
    isDialogMode = true;
    
    // Hide mobile controls
    if (window.updateMobileControlsVisibility) {
        window.updateMobileControlsVisibility();
    }
    
    // Start camera transition to dialog position
    if (character) {
        const charPos = character.position.clone();
        const charForward = new THREE.Vector3(0, 0, 1).applyQuaternion(character.quaternion);
        
        // Calculate target position
        const targetPos = new THREE.Vector3(
            charPos.x + charForward.x * CONFIG.DIALOG_CAMERA_DISTANCE,
            charPos.y + CONFIG.DIALOG_CAMERA_HEIGHT,
            charPos.z + charForward.z * CONFIG.DIALOG_CAMERA_DISTANCE
        );
        
        // Calculate target quaternion (looking at character)
        const tempCamera = camera.clone();
        tempCamera.position.copy(targetPos);
        tempCamera.lookAt(charPos.x, charPos.y + 1, charPos.z);
        
        // Start transition
        transitionStartPos = camera.position.clone();
        transitionEndPos = targetPos;
        transitionStartQuat = camera.quaternion.clone();
        transitionEndQuat = tempCamera.quaternion.clone();
        transitionStartTime = clock.getElapsedTime();
        isTransitioning = true;
    }
}

function closeDialog() {
    // Stop voice chat if active
    try {
        stopVoiceToVoice();
    } catch (e) {
        console.warn('Error stopping voice:', e);
    }
    
    document.getElementById('dialogOverlay').classList.remove('active');
    
    // Reset menu state without calling stopVoiceToVoice again
    document.getElementById('mainMenu').style.display = 'flex';
    document.getElementById('quizContainer').classList.remove('active');
    document.getElementById('chatContainer').classList.remove('active');
    
    // Exit dialog camera mode
    isDialogMode = false;
    
    // Show mobile controls
    if (window.updateMobileControlsVisibility) {
        window.updateMobileControlsVisibility();
    }
    
    // Start transition back to FPS position
    if (savedCameraPosition && savedCameraQuaternion) {
        transitionStartPos = camera.position.clone();
        transitionEndPos = savedCameraPosition.clone();
        transitionStartQuat = camera.quaternion.clone();
        transitionEndQuat = savedCameraQuaternion.clone();
        transitionStartTime = clock.getElapsedTime();
        isTransitioning = true;
    }
    
}

function backToMenu() {
    // Stop voice chat if active
    try {
        stopVoiceToVoice();
    } catch (e) {
        console.warn('Error stopping voice:', e);
    }
    
    document.getElementById('mainMenu').style.display = 'flex';
    document.getElementById('quizContainer').classList.remove('active');
    document.getElementById('chatContainer').classList.remove('active');
}

// Expose backToMenu globally for chat.js
window.backToMenu = backToMenu;

// Ease out cubic function for smooth transition
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export function updateDialogCamera() {
    const currentTime = clock ? clock.getElapsedTime() : 0;
    
    // Handle camera transition
    if (isTransitioning && transitionStartPos && transitionEndPos) {
        const elapsed = currentTime - transitionStartTime;
        const duration = CONFIG.CAMERA_TRANSITION_DURATION;
        let t = Math.min(elapsed / duration, 1);
        t = easeOutCubic(t);
        
        // Interpolate position
        camera.position.lerpVectors(transitionStartPos, transitionEndPos, t);
        
        // Interpolate rotation
        camera.quaternion.slerpQuaternions(transitionStartQuat, transitionEndQuat, t);
        
        if (elapsed >= duration) {
            isTransitioning = false;
        }
        return;
    }
    
    // Dialog mode idle camera (subtle sway)
    if (isDialogMode && character && clock && !isTransitioning) {
        const charPos = character.position.clone();
        const charForward = new THREE.Vector3(0, 0, 1).applyQuaternion(character.quaternion);
        
        // Subtle camera sway for cinematic feel
        const swayX = Math.sin(currentTime * 0.5) * 0.02;
        const swayY = Math.cos(currentTime * 0.3) * 0.015;
        
        camera.position.x = charPos.x + charForward.x * CONFIG.DIALOG_CAMERA_DISTANCE + swayX;
        camera.position.y = charPos.y + CONFIG.DIALOG_CAMERA_HEIGHT + swayY;
        camera.position.z = charPos.z + charForward.z * CONFIG.DIALOG_CAMERA_DISTANCE;
        camera.lookAt(charPos.x, charPos.y + 1, charPos.z);
    }
}
