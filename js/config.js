// Configuration
export const CONFIG = {
    // Backend server URL for API proxy (keeps API key secure)
    BACKEND_URL: 'https://justy3d-api.onrender.com',
    
    // Fallback: users can still enter their own key via settings menu
    
    // Character
    CHARACTER_MODEL: 'full-ceci.glb',
    INTERACTION_DISTANCE: 10,
    DETECTION_DISTANCE: 12,
    TURN_ANGLE_THRESHOLD: 70,
    ROTATION_DURATION: 1.0,
    
    // Animations
    ANIMATIONS: {
        IDLE: 'idle_remap',
        TALK: 'parle_remap',
        TALK_LONG: 'parle_long_remap',
        TURN_RIGHT: 'tourneDroite_remap',
        TURN_LEFT: 'tourneGauche_remap',
        HAPPY: 'content_remap',
        SAD: 'triste_remap'
    },
    
    // Player
    PLAYER_HEIGHT: 1.4,
    PLAYER_SPEED: 1.25,
    
    // Dialog camera
    DIALOG_CAMERA_DISTANCE: 2.0,
    DIALOG_CAMERA_HEIGHT: 1.5,
    CAMERA_TRANSITION_DURATION: 0.8,
    
    // Quiz
    QUESTIONS_PER_QUIZ: 10,
    
    // Chat
    CHAT_SYSTEM_PROMPT: `Tu es un expert passionné du cécifoot (football pour aveugles et malvoyants). Tu ne parles QUE du cécifoot et tu refuses poliment de parler d'autres sujets en redirigeant la conversation vers le cécifoot.

Tes connaissances incluent :
- Les règles : 4 joueurs de champ non-voyants + 1 gardien voyant, terrain 42x22m avec barrières, ballon à grelots, pas de hors-jeu
- Les catégories : B1 (non-voyants avec bandeau) et B2-B3 (malvoyants)
- L'histoire : créé au Brésil années 60, sport paralympique depuis 2004, créé en France en 1987
- Les codes verbaux : "VOY" (j'arrive), "J'ai" (j'ai le ballon), "Oui" (tu peux passer)
- La durée : 2x20min en France, 2x25min en Europe
- Les compétitions : Championnat de France, Coupe de France, Jeux Paralympiques

Réponds de manière fun, enthousiaste et concise (max 2-3 phrases). Utilise des emojis avec modération. Si on te pose une question hors-sujet, réponds gentiment que tu es spécialisé en cécifoot et propose de parler de ce sport passionnant !`,

    // Voice Chat (Realtime API)
    VOICE_SYSTEM_PROMPT: `Tu es un expert passionné du cécifoot (football pour aveugles et malvoyants). Tu ne parles QUE du cécifoot et tu REFUSES ABSOLUMENT de parler d'autres sujets. Si on te pose une question hors-sujet, redirige TOUJOURS vers le cécifoot.

Tes connaissances :
- Règles : 4 joueurs non-voyants + 1 gardien voyant, terrain 42x22m avec barrières, ballon à grelots
- Catégories : B1 (non-voyants avec bandeau) et B2-B3 (malvoyants)
- Histoire : créé au Brésil années 60, sport paralympique depuis 2004, en France depuis 1987
- Codes verbaux : "VOY" (j'arrive), "J'ai" (j'ai le ballon), "Oui" (tu peux passer)
- Durée : 2x20min en France, 2x25min en Europe
- Compétitions : Championnat de France, Coupe de France, Jeux Paralympiques

Parle de manière naturelle, enthousiaste et concise. Tu es passionné par ce sport !`,

    // Voice chat inactivity timeout (ms)
    VOICE_INACTIVITY_TIMEOUT: 5000
};
