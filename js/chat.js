import { CONFIG } from './config.js';

let chatHistory = [];
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

// Voice-to-Voice state (WebRTC Realtime API)
let isVoiceToVoiceActive = false;
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let isSpeaking = false;
let inactivityTimeout = null;
let inactivityWarningTimeout = null;
let hasWarnedInactivity = false;

export async function startChat() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('chatContainer').classList.add('active');
    chatHistory = [];
    
    // Auto-start voice chat
    const status = document.getElementById('voiceStatus');
    if (status) status.textContent = 'Connexion...';
    
    try {
        await startRealtimeSession();
        isVoiceToVoiceActive = true;
        if (status) status.textContent = '';
        
        // Pause background music
        if (window.pauseMusicForVoiceChat) {
            window.pauseMusicForVoiceChat();
        }
    } catch (error) {
        console.error('V2V Error:', error);
        if (status) status.textContent = '❌ ' + error.message;
    }
}

export async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    // Check if API key is available
    const apiKey = window.getApiKey ? window.getApiKey() : '';
    if (!apiKey) {
        addChatMessage('⚠️ Clé API manquante ! Clique sur ⚙️ en haut à gauche pour entrer ta clé OpenAI.', 'bot');
        return;
    }
    
    input.value = '';
    input.style.height = 'auto';
    addChatMessage(message, 'user');
    
    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot typing';
    typingDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    document.getElementById('chatMessages').appendChild(typingDiv);
    scrollChat();
    
    try {
        const response = await callOpenAI(message);
        typingDiv.remove();
        addChatMessage(response, 'bot');
        
        // Play talk animation when response arrives
        if (window.playTalkAnimation) {
            window.playTalkAnimation();
        }
    } catch (error) {
        typingDiv.remove();
        addChatMessage('Oups ! Une erreur est survenue. Réessaie !', 'bot');
        console.error(error);
    }
}

function addChatMessage(text, type) {
    const div = document.createElement('div');
    div.className = 'chat-message ' + type;
    div.textContent = text;
    document.getElementById('chatMessages').appendChild(div);
    scrollChat();
}

function scrollChat() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

async function callOpenAI(userMessage) {
    chatHistory.push({ role: 'user', content: userMessage });
    
    // Get API key from localStorage (user settings)
    const apiKey = window.getApiKey ? window.getApiKey() : '';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: CONFIG.CHAT_SYSTEM_PROMPT },
                ...chatHistory.slice(-10)
            ],
            max_tokens: 150,
            temperature: 0.7
        })
    });
    
    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;
    chatHistory.push({ role: 'assistant', content: assistantMessage });
    return assistantMessage;
}

export async function toggleVoice() {
    const btn = document.getElementById('voiceBtn');
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                await transcribeAudio(audioBlob);
            };
            
            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('recording');
            btn.textContent = '⏹';
        } catch (err) {
            alert('Impossible d\'accéder au microphone');
            console.error(err);
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        btn.classList.remove('recording');
        btn.textContent = '🎤';
    }
}

async function transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');
    
    // Get API key from localStorage (user settings)
    const apiKey = window.getApiKey ? window.getApiKey() : '';
    
    try {
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey
            },
            body: formData
        });
        
        const data = await response.json();
        if (data.text) {
            const text = data.text.trim();
            // Ignore empty or invalid transcriptions
            if (text.length < 2 || 
                text.toLowerCase().includes('amara.org') || 
                text.toLowerCase().includes('sous-titres') ||
                text.toLowerCase().includes('subtitles')) {
                return; // Ignore empty/invalid audio
            }
            document.getElementById('chatInput').value = text;
            sendMessage();
        }
    } catch (err) {
        console.error('Transcription error:', err);
    }
}

export function initChatListeners() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) {
        console.warn('chatInput not found, retrying...');
        setTimeout(initChatListeners, 100);
        return;
    }
    
    // Enter key to send
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 60) + 'px';
    });
}

// Voice-to-Voice mode using OpenAI Realtime API with WebRTC
export async function toggleVoiceToVoice() {
    const status = document.getElementById('voiceStatus');
    
    if (isVoiceToVoiceActive) {
        // Stop Voice-to-Voice
        stopVoiceToVoice();
        if (status) status.textContent = '';
    } else {
        if (window.playSelectSound) window.playSelectSound();
        if (status) status.textContent = 'Connexion...';
        
        // Start Voice-to-Voice with WebRTC
        try {
            await startRealtimeSession();
            isVoiceToVoiceActive = true;
            if (status) status.textContent = '';
            // Pause background music
            if (window.pauseMusicForVoiceChat) {
                window.pauseMusicForVoiceChat();
            }
        } catch (error) {
            console.error('V2V Error:', error);
            if (status) status.textContent = '❌ ' + error.message;
        }
    }
}

export function stopVoiceToVoice() {
    // Only stop if actually active
    if (!isVoiceToVoiceActive && !peerConnection && !localStream) {
        return;
    }
    
    console.log('Stopping Voice-to-Voice...');
    
    // Clear inactivity timeout
    if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = null;
    }
    
    // Clear warning timeout
    if (inactivityWarningTimeout) {
        clearTimeout(inactivityWarningTimeout);
        inactivityWarningTimeout = null;
    }
    hasWarnedInactivity = false;
    
    // Stop talk animation only if we were speaking
    if (isSpeaking && window.stopTalkLongAnimation) {
        window.stopTalkLongAnimation();
    }
    
    isVoiceToVoiceActive = false;
    isSpeaking = false;
    
    // Close data channel
    if (dataChannel) {
        try {
            dataChannel.close();
        } catch (e) {}
        dataChannel = null;
    }
    
    // Close peer connection
    if (peerConnection) {
        try {
            peerConnection.close();
        } catch (e) {}
        peerConnection = null;
    }
    
    // Stop microphone
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        localStream = null;
    }
    
    // Resume background music
    if (window.resumeMusicAfterVoiceChat) {
        window.resumeMusicAfterVoiceChat();
    }
}

async function startRealtimeSession() {
    // Step 1: Get ephemeral key from backend server (keeps API key secure)
    let ephemeralKey;
    
    // Get selected voice from settings
    const selectedVoice = window.getSelectedVoice ? window.getSelectedVoice() : 'echo';
    
    // Get ephemeral key from backend server
    try {
        const backendResponse = await fetch(`${CONFIG.BACKEND_URL}/realtime-token?voice=${selectedVoice}`);
        if (backendResponse.ok) {
            const data = await backendResponse.json();
            ephemeralKey = data.client_secret.value;
        } else {
            const errorData = await backendResponse.json();
            throw new Error(errorData.error || 'Erreur serveur');
        }
    } catch (error) {
        console.error('Backend error:', error);
        throw new Error('Serveur indisponible. Réessayez plus tard.');
    }
    
    // Step 2: Get microphone access
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Step 3: Create WebRTC peer connection
    peerConnection = new RTCPeerConnection();
    
    // Step 4: Set up audio output (AI voice) with audio level detection
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    
    let audioContext = null;
    let analyser = null;
    let audioCheckInterval = null;
    let silenceCounter = 0;
    const SILENCE_THRESHOLD = 0.01;
    const SILENCE_FRAMES_TO_STOP = 30; // ~0.5 seconds of silence
    
    // Send warning message to AI (will be spoken)
    const sendInactivityWarning = () => {
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: '[SYSTÈME] L\'utilisateur est silencieux. Dis-lui gentiment: "Tu es encore là ? Si tu n\'as plus de questions, je vais bientôt te laisser."'
                    }]
                }
            }));
            dataChannel.send(JSON.stringify({ type: 'response.create' }));
        }
    };
    
    // Reset inactivity timeout function (accessible from dataChannel events)
    const resetInactivityTimer = (fromUserActivity = false) => {
        // If already warned and this is NOT from user activity, don't reset
        // (prevents AI's warning speech from resetting the timer)
        if (hasWarnedInactivity && !fromUserActivity) {
            return;
        }
        
        // Clear existing timeouts
        if (inactivityWarningTimeout) {
            clearTimeout(inactivityWarningTimeout);
            inactivityWarningTimeout = null;
        }
        if (inactivityTimeout) {
            clearTimeout(inactivityTimeout);
            inactivityTimeout = null;
        }
        hasWarnedInactivity = false;
        
        // Set warning timeout (10s)
        inactivityWarningTimeout = setTimeout(() => {
            console.log('Voice chat inactivity warning');
            hasWarnedInactivity = true;
            sendInactivityWarning();
            
            // Set final timeout (5s after warning)
            inactivityTimeout = setTimeout(() => {
                console.log('Voice chat inactivity timeout - closing');
                stopVoiceToVoice();
                // Return to menu
                if (window.backToMenu) {
                    window.backToMenu();
                }
            }, 5000);
        }, CONFIG.VOICE_INACTIVITY_WARNING);
    };
    
    // Start initial inactivity timeout
    resetInactivityTimer();
    
    peerConnection.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
        
        // Set up audio analysis to detect when AI is actually speaking
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(event.streams[0]);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            // Check audio levels periodically
            audioCheckInterval = setInterval(() => {
                if (!isVoiceToVoiceActive) {
                    clearInterval(audioCheckInterval);
                    return;
                }
                
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
                
                if (average > SILENCE_THRESHOLD) {
                    // Audio is playing - AI is speaking
                    silenceCounter = 0;
                    // Reset inactivity timeout when audio is detected
                    resetInactivityTimer();
                    if (!isSpeaking) {
                        isSpeaking = true;
                        // Start looping animation (only called once, loops internally)
                        if (window.playTalkLongAnimation) {
                            window.playTalkLongAnimation();
                        }
                    }
                } else if (isSpeaking) {
                    // Silence detected
                    silenceCounter++;
                    if (silenceCounter >= SILENCE_FRAMES_TO_STOP) {
                        // Enough silence - AI stopped speaking
                        isSpeaking = false;
                        silenceCounter = 0;
                        if (window.stopTalkLongAnimation) {
                            window.stopTalkLongAnimation();
                        }
                    }
                }
            }, 16); // ~60fps
        } catch (e) {
            console.warn('AudioContext not available:', e);
        }
    };
    
    // Step 5: Add microphone track
    peerConnection.addTrack(localStream.getTracks()[0]);
    
    // Step 6: Create data channel for events
    dataChannel = peerConnection.createDataChannel('oai-events');
    
    dataChannel.addEventListener('open', () => {
        console.log('Data channel open - sending greeting trigger');
        // Send a message to trigger AI greeting
        dataChannel.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: '[SYSTÈME] La conversation vient de commencer. Dis exactement cette phrase pour accueillir l\'utilisateur: "Content de parler avec toi ! Pose-moi toutes les questions que tu veux sur le cécifoot, je t\'écoute."'
                }]
            }
        }));
        // Trigger response
        dataChannel.send(JSON.stringify({
            type: 'response.create'
        }));
    });
    
    dataChannel.addEventListener('message', (e) => {
        const event = JSON.parse(e.data);
        console.log('Realtime event:', event.type);
        
        switch (event.type) {
            case 'input_audio_buffer.speech_started':
                // User started speaking - reset inactivity timeout
                resetInactivityTimer(true); // true = user activity
                break;
            case 'conversation.item.input_audio_transcription.completed':
                // User speech transcribed - reset inactivity timeout
                console.log('User said:', event.transcript);
                resetInactivityTimer(true); // true = user activity
                break;
            case 'error':
                console.error('Realtime error:', event.error);
                if (event.error?.code === 'session_expired') {
                    stopVoiceToVoice();
                    const status = document.getElementById('voiceStatus');
                    if (status) status.textContent = '⚠️ Session expirée';
                }
                break;
        }
    });
    
    // Step 7: Create and send SDP offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
            method: 'POST',
            body: offer.sdp,
            headers: {
                'Authorization': `Bearer ${ephemeralKey}`,
                'Content-Type': 'application/sdp'
            }
        }
    );
    
    if (!sdpResponse.ok) {
        throw new Error('Erreur lors de la connexion WebRTC');
    }
    
    const answerSdp = await sdpResponse.text();
    await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
    });
}
