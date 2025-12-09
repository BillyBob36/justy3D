const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS pour permettre les appels depuis GitHub Pages
app.use(cors({
    origin: ['https://billybob36.github.io', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST']
}));

app.use(express.json());

// System prompt pour le cécifoot
const VOICE_SYSTEM_PROMPT = `Tu es un expert passionné du cécifoot (football pour aveugles et malvoyants). Tu ne parles QUE du cécifoot et tu REFUSES ABSOLUMENT de parler d'autres sujets. Si on te pose une question hors-sujet, redirige TOUJOURS vers le cécifoot.

IMPORTANT: Dès que la conversation commence, tu dois IMMÉDIATEMENT prendre la parole en premier avec une phrase d'accueil courte comme: "Content de parler avec toi ! Pose moi toutes les questions que tu veux sur le cécifoot, je t'écoute."

Tes connaissances :
- Règles : 4 joueurs non-voyants + 1 gardien voyant, terrain 42x22m avec barrières, ballon à grelots
- Catégories : B1 (non-voyants avec bandeau) et B2-B3 (malvoyants)
- Histoire : créé au Brésil années 60, sport paralympique depuis 2004, en France depuis 1987
- Codes verbaux : "VOY" (j'arrive), "J'ai" (j'ai le ballon), "Oui" (tu peux passer)
- Durée : 2x20min en France, 2x25min en Europe
- Compétitions : Championnat de France, Coupe de France, Jeux Paralympiques

Parle de manière naturelle, enthousiaste et concise. Tu es passionné par ce sport !`;

// Voix disponibles
const AVAILABLE_VOICES = ['echo', 'alloy', 'ash', 'ballad', 'coral', 'sage', 'shimmer', 'verse'];

// Route pour obtenir une clé éphémère pour la Realtime API
app.get('/realtime-token', async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured on server' });
    }
    
    // Get voice from query param, default to 'echo'
    let voice = req.query.voice || 'echo';
    if (!AVAILABLE_VOICES.includes(voice)) {
        voice = 'echo';
    }
    
    try {
        // Demander une clé éphémère à OpenAI
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-realtime-preview-2024-12-17',
                voice: voice,
                instructions: VOICE_SYSTEM_PROMPT,
                input_audio_transcription: {
                    model: 'whisper-1'
                },
                turn_detection: {
                    type: 'server_vad'
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error('OpenAI error:', error);
            return res.status(response.status).json({ error: 'Failed to get ephemeral token' });
        }
        
        const data = await response.json();
        
        // Renvoyer uniquement le token éphémère (pas la vraie clé)
        res.json({
            client_secret: data.client_secret,
            expires_at: data.expires_at
        });
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
