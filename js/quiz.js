import { quizQuestions } from './quizData.js';
import { CONFIG } from './config.js';

let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;
let quizAnswered = false;
let answersHistory = []; // Track correct/wrong for each question
let selectedAnswerIndex = 0; // For keyboard navigation

export function startQuiz() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('quizContainer').classList.add('active');
    document.getElementById('quizScore').style.display = 'none';
    document.getElementById('quizQuestion').style.display = 'block';
    document.getElementById('quizAnswers').style.display = 'grid';
    document.getElementById('quizHeader').style.display = 'flex';
    
    // Shuffle and pick questions
    currentQuiz = [...quizQuestions].sort(() => Math.random() - 0.5).slice(0, CONFIG.QUESTIONS_PER_QUIZ);
    currentQuestionIndex = 0;
    score = 0;
    answersHistory = [];
    
    updateLiveScore();
    renderQuizProgress();
    renderQuestion();
}

function updateLiveScore() {
    document.getElementById('quizLiveScore').textContent = score + '/' + (currentQuestionIndex);
}

function renderQuizProgress() {
    const container = document.getElementById('quizProgress');
    const questionNum = currentQuestionIndex + 1;
    const total = CONFIG.QUESTIONS_PER_QUIZ;
    
    container.innerHTML = `
        <span class="quiz-question-number">Question ${questionNum}/${total}</span>
    `;
}

function renderQuestion() {
    quizAnswered = false;
    const q = currentQuiz[currentQuestionIndex];
    document.getElementById('quizQuestion').textContent = q.q;
    
    // Play talk animation once
    if (window.playTalkAnimation) {
        window.playTalkAnimation();
    }
    
    const answersContainer = document.getElementById('quizAnswers');
    answersContainer.innerHTML = '';
    
    // Shuffle answers
    const shuffledAnswers = q.a.map((text, idx) => ({ text, isCorrect: idx === q.correct }));
    shuffledAnswers.sort(() => Math.random() - 0.5);
    
    shuffledAnswers.forEach((answer, index) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-answer';
        btn.textContent = answer.text;
        btn.dataset.index = index;
        btn.dataset.isCorrect = answer.isCorrect;
        
        btn.onclick = () => {
            selectAnswer(btn, answer.isCorrect);
        };
        
        btn.addEventListener('mouseenter', () => {
            if (quizAnswered) return;
            // Clear all selections and select this one
            clearSelection();
            btn.classList.add('selected');
            selectedAnswerIndex = index;
            // Play sound
            if (window.playClickSound) window.playClickSound();
        });
        
        btn.addEventListener('mouseleave', () => {
            if (quizAnswered) return;
            btn.classList.remove('selected');
        });
        
        answersContainer.appendChild(btn);
    });
    
    selectedAnswerIndex = 0;
}

// Update visual selection (unified for mouse and keyboard)
function updateSelection() {
    const answers = document.querySelectorAll('.quiz-answer');
    answers.forEach((btn, index) => {
        if (index === selectedAnswerIndex) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

// Clear all selections
function clearSelection() {
    const answers = document.querySelectorAll('.quiz-answer');
    answers.forEach(btn => btn.classList.remove('selected'));
}

// Find nearest button in a direction based on coordinates
function findNearestInDirection(answers, currentIndex, direction) {
    const currentBtn = answers[currentIndex];
    const currentRect = currentBtn.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;
    
    let bestIndex = -1;
    let bestDistance = Infinity;
    
    answers.forEach((btn, index) => {
        if (index === currentIndex) return;
        
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const dx = centerX - currentCenterX;
        const dy = centerY - currentCenterY;
        
        // Check if button is in the right direction
        let isInDirection = false;
        switch (direction) {
            case 'up':
                isInDirection = dy < -10; // Button is above
                break;
            case 'down':
                isInDirection = dy > 10; // Button is below
                break;
            case 'left':
                isInDirection = dx < -10; // Button is to the left
                break;
            case 'right':
                isInDirection = dx > 10; // Button is to the right
                break;
        }
        
        if (isInDirection) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        }
    });
    
    return bestIndex;
}

// Keyboard navigation for quiz
function handleQuizKeyboard(event) {
    const quizContainer = document.getElementById('quizContainer');
    if (!quizContainer.classList.contains('active')) return;
    if (quizAnswered) return;
    
    const answers = document.querySelectorAll('.quiz-answer');
    if (answers.length === 0) return;
    
    // Only handle arrow keys and enter/space
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) return;
    
    // First arrow press: select first answer if none selected
    if (selectedAnswerIndex < 0 || selectedAnswerIndex >= answers.length) {
        selectedAnswerIndex = 0;
    }

    let newIndex = -1;
    
    switch (event.code) {
        case 'ArrowUp':
            event.preventDefault();
            newIndex = findNearestInDirection(answers, selectedAnswerIndex, 'up');
            if (newIndex === -1) newIndex = selectedAnswerIndex; // Keep current if no neighbor
            break;
        case 'ArrowDown':
            event.preventDefault();
            newIndex = findNearestInDirection(answers, selectedAnswerIndex, 'down');
            if (newIndex === -1) newIndex = selectedAnswerIndex;
            break;
        case 'ArrowLeft':
            event.preventDefault();
            newIndex = findNearestInDirection(answers, selectedAnswerIndex, 'left');
            if (newIndex === -1) newIndex = selectedAnswerIndex;
            break;
        case 'ArrowRight':
            event.preventDefault();
            newIndex = findNearestInDirection(answers, selectedAnswerIndex, 'right');
            if (newIndex === -1) newIndex = selectedAnswerIndex;
            break;
        case 'Space':
        case 'Enter':
            event.preventDefault();
            const selectedBtn = answers[selectedAnswerIndex];
            if (selectedBtn) {
                const isCorrect = selectedBtn.dataset.isCorrect === 'true';
                selectAnswer(selectedBtn, isCorrect);
            }
            return;
    }
    
    // Update selection
    if (newIndex !== -1 && newIndex !== selectedAnswerIndex) {
        selectedAnswerIndex = newIndex;
        updateSelection();
        if (window.playClickSound) window.playClickSound();
    } else if (newIndex === selectedAnswerIndex) {
        // First press or same position - just show selection
        updateSelection();
    }
}

// Initialize keyboard listener
document.addEventListener('keydown', handleQuizKeyboard);

function selectAnswer(btn, isCorrect) {
    if (quizAnswered) return;
    quizAnswered = true;
    // Clear selection to show correct/wrong colors
    clearSelection();
    
    const allBtns = document.querySelectorAll('.quiz-answer');
    
    allBtns.forEach(b => {
        b.classList.add('disabled');
        if (b.textContent === currentQuiz[currentQuestionIndex].a[currentQuiz[currentQuestionIndex].correct]) {
            b.classList.add('correct');
        }
    });
    
    // Play select sound first
    if (window.playSelectSound) window.playSelectSound();
    
    if (isCorrect) {
        btn.classList.add('correct');
        answersHistory[currentQuestionIndex] = 'correct';
        score++;
        
        // Play correct sound immediately with select sound
        if (window.playTrueSound) window.playTrueSound();
        
        // Play happy animation
        if (window.playHappyAnimation) {
            window.playHappyAnimation();
        }
    } else {
        btn.classList.add('wrong');
        answersHistory[currentQuestionIndex] = 'wrong';
        
        // Play wrong sound after 500ms
        setTimeout(() => {
            if (window.playFalseSound) window.playFalseSound();
        }, 500);
        
        // Play sad animation
        if (window.playSadAnimation) {
            window.playSadAnimation();
        }
    }
    
    setTimeout(() => {
        currentQuestionIndex++;
        updateLiveScore();
        if (currentQuestionIndex < CONFIG.QUESTIONS_PER_QUIZ) {
            renderQuizProgress();
            renderQuestion();
        } else {
            showScore();
        }
    }, 1500);
}

function showScore() {
    document.getElementById('quizQuestion').style.display = 'none';
    document.getElementById('quizAnswers').style.display = 'none';
    document.getElementById('quizHeader').style.display = 'none';
    document.getElementById('quizScore').style.display = 'block';
    
    document.getElementById('scoreNumber').textContent = score + '/' + CONFIG.QUESTIONS_PER_QUIZ;
    
    let text = '';
    if (score === CONFIG.QUESTIONS_PER_QUIZ) text = '🏆 Parfait ! Tu es un vrai expert du cécifoot !';
    else if (score >= 8) text = '🌟 Excellent ! Tu connais très bien le cécifoot !';
    else if (score >= 6) text = '👍 Bien joué ! Tu as de bonnes connaissances !';
    else if (score >= 4) text = '📚 Pas mal ! Continue à apprendre !';
    else text = '💪 Tu peux faire mieux ! Réessaie !';
    
    document.getElementById('scoreText').textContent = text;
}
