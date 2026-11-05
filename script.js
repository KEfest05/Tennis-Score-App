let settings = {
    ttsEnabled: localStorage.getItem('tennis_tts') !== 'false',
    continuous: localStorage.getItem('tennis_continuous') !== 'false',
    beepEnabled: localStorage.getItem('tennis_beep') !== 'false'
};

let matchState = {
    p1PointsIndex: 0,
    p2PointsIndex: 0,
    p1Games: 0,
    p2Games: 0,
    p1Sets: [],
    p2Sets: [],
    server: 1,
    isTiebreak: false,
    p1TBPoints: 0,
    p2TBPoints: 0,
    isFinished: false,
    // Статистика
    startTime: Date.now(),
    p1TotalPointsWon: 0,
    p2TotalPointsWon: 0,
    totalPointsPlayed: 0
};

const standardPoints = ["0", "15", "30", "40", "АД"];
let history = [];

const micBtn = document.getElementById('micBtn');
const statusText = document.getElementById('statusText');
const lastCommand = document.getElementById('lastCommand');
const p1NameInput = document.getElementById('p1Name');
const p2NameInput = document.getElementById('p2Name');
const p1PointsEl = document.getElementById('p1Points');
const p2PointsEl = document.getElementById('p2Points');
const p1GamesEl = document.getElementById('p1Games');
const p2GamesEl = document.getElementById('p2Games');
const p1SetsEl = document.getElementById('p1Sets');
const p2SetsEl = document.getElementById('p2Sets');
const player1Card = document.getElementById('player1Card');
const player2Card = document.getElementById('player2Card');

// Генерация короткого звукового сигнала (бипа)
function playBeep(freq = 600, duration = 100) {
    if (!settings.beepEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            audioCtx.close();
        }, duration);
    } catch (e) {
        console.log("Ошибка воспроизведения звука:", e);
    }
}

// Управление полноэкранным режимом и физический перенос кнопки
const fullscreenBtn = document.getElementById('fullscreenBtn');
fullscreenBtn.addEventListener('click', () => {
    document.body.classList.toggle('fullscreen-mode');
    const micSection = document.querySelector('.mic-section');
    const headerBtns = document.querySelector('.header-btns');

    if (document.body.classList.contains('fullscreen-mode')) {
        micSection.appendChild(fullscreenBtn);
        fullscreenBtn.textContent = '✕';
        fullscreenBtn.title = 'Свернуть табло';
    } else {
        headerBtns.appendChild(fullscreenBtn);
        fullscreenBtn.textContent = '⛶';
        fullscreenBtn.title = 'На весь экран';
    }
});

// Управление модальными окнами (Настройки и Статистика)
const settingsModal = document.getElementById('settingsModal');
const statsModal = document.getElementById('statsModal');

document.getElementById('openSettings').onclick = () => settingsModal.classList.add('active');
document.getElementById('closeSettings').onclick = () => settingsModal.classList.remove('active');

document.getElementById('openStats').onclick = () => {
    updateStatsDisplay();
    statsModal.classList.add('active');
};
document.getElementById('closeStats').onclick = () => statsModal.classList.remove('active');

const ttsToggle = document.getElementById('ttsToggle');
const continuousToggle = document.getElementById('continuousToggle');
const beepToggle = document.getElementById('beepToggle');

ttsToggle.checked = settings.ttsEnabled;
continuousToggle.checked = settings.continuous;
beepToggle.checked = settings.beepEnabled;

ttsToggle.onchange = (e) => {
    settings.ttsEnabled = e.target.checked;
    localStorage.setItem('tennis_tts', settings.ttsEnabled);
};

continuousToggle.onchange = (e) => {
    settings.continuous = e.target.checked;
    localStorage.setItem('tennis_continuous', settings.continuous);
};

beepToggle.onchange = (e) => {
    settings.beepEnabled = e.target.checked;
    localStorage.setItem('tennis_beep', settings.beepEnabled);
    if (settings.beepEnabled) playBeep(800, 150);
};

function speak(text) {
    if (!settings.ttsEnabled) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

function saveHistory() {
    history.push(JSON.parse(JSON.stringify(matchState)));
    if (history.length > 20) history.shift();
}

function undoLast() {
    if (history.length > 0) {
        matchState = history.pop();
        updateUI();
        playBeep(400, 150);
        speak("Очко отменено");
    }
}

function addPoint(player) {
    if (matchState.isFinished) return;
    saveHistory();

    matchState.totalPointsPlayed++;
    if (player === 1) matchState.p1TotalPointsWon++;
    else matchState.p2TotalPointsWon++;

    if (matchState.isTiebreak) {
        handleTiebreakPoint(player);
    } else {
        handleStandardPoint(player);
    }

    updateUI();
    playBeep(700, 100);
    announceScore();
}

function handleStandardPoint(player) {
    const isP1 = player === 1;
    let myScore = isP1 ? matchState.p1PointsIndex : matchState.p2PointsIndex;
    let oppScore = isP1 ? matchState.p2PointsIndex : matchState.p1PointsIndex;

    if (myScore === 3 && oppScore === 3) {
        if (isP1) matchState.p1PointsIndex = 4;
        else matchState.p2PointsIndex = 4;
    } else if (myScore === 4 && oppScore === 3) {
        winGame(player);
    } else if (myScore === 3 && oppScore === 4) {
        if (isP1) matchState.p2PointsIndex = 3;
        else matchState.p1PointsIndex = 3;
    } else if (myScore === 3) {
        winGame(player);
    } else {
        if (isP1) matchState.p1PointsIndex++;
        else matchState.p2PointsIndex++;
    }
}

function handleTiebreakPoint(player) {
    if (player === 1) matchState.p1TBPoints++;
    else matchState.p2TBPoints++;

    const totalTB = matchState.p1TBPoints + matchState.p2TBPoints;
    if (totalTB % 2 === 1) {
        toggleServer(false);
    }

    if (matchState.p1TBPoints >= 7 && (matchState.p1TBPoints - matchState.p2TBPoints >= 2)) {
        winGame(1);
    } else if (matchState.p2TBPoints >= 7 && (matchState.p2TBPoints - matchState.p1TBPoints >= 2)) {
        winGame(2);
    }
}

function winGame(player) {
    matchState.p1PointsIndex = 0;
    matchState.p2PointsIndex = 0;
    matchState.p1TBPoints = 0;
    matchState.p2TBPoints = 0;
    matchState.isTiebreak = false;

    if (player === 1) matchState.p1Games++;
    else matchState.p2Games++;

    toggleServer(false);

    const g1 = matchState.p1Games;
    const g2 = matchState.p2Games;

    if (g1 === 6 && g2 === 6) {
        matchState.isTiebreak = true;
    } else if (g1 >= 6 && (g1 - g2 >= 2)) {
        winSet(1);
    } else if (g2 >= 6 && (g2 - g1 >= 2)) {
        winSet(2);
    }
}

function winSet(player) {
    matchState.p1Sets.push(matchState.p1Games);
    matchState.p2Sets.push(matchState.p2Games);
    matchState.p1Games = 0;
    matchState.p2Games = 0;

    if (matchState.p1Sets.length + matchState.p2Sets.length >= 3) {
        matchState.isFinished = true;
    }
}

function toggleServer(userAction = true) {
    matchState.server = matchState.server === 1 ? 2 : 1;
    updateUI();
    if (userAction) speak("Смена подачи");
}

function resetMatch() {
    matchState = {
        p1PointsIndex: 0,
        p2PointsIndex: 0,
        p1Games: 0,
        p2Games: 0,
        p1Sets: [],
        p2Sets: [],
        server: 1,
        isTiebreak: false,
        p1TBPoints: 0,
        p2TBPoints: 0,
        isFinished: false,
        startTime: Date.now(),
        p1TotalPointsWon: 0,
        p2TotalPointsWon: 0,
        totalPointsPlayed: 0
    };
    history = [];
    updateUI();
    speak("Матч сброшен");
}

function updateUI() {
    if (matchState.isTiebreak) {
        p1PointsEl.textContent = matchState.p1TBPoints;
        p2PointsEl.textContent = matchState.p2TBPoints;
    } else {
        p1PointsEl.textContent = standardPoints[matchState.p1PointsIndex];
        p2PointsEl.textContent = standardPoints[matchState.p2PointsIndex];
    }

    p1GamesEl.textContent = `Геймы: ${matchState.p1Games} ${matchState.isTiebreak ? '(ТБ)' : ''}`;
    p2GamesEl.textContent = `Геймы: ${matchState.p2Games} ${matchState.isTiebreak ? '(ТБ)' : ''}`;

    p1SetsEl.textContent = `Сеты: ${matchState.p1Sets.join(' | ') || '-'}`;
    p2SetsEl.textContent = `Сеты: ${matchState.p2Sets.join(' | ') || '-'}`;

    if (matchState.server === 1) {
        player1Card.classList.add('serving');
        player2Card.classList.remove('serving');
    } else {
        player2Card.classList.add('serving');
        player1Card.classList.remove('serving');
    }
}

function updateStatsDisplay() {
    const p1Name = p1NameInput.value;
    const p2Name = p2NameInput.value;

    document.getElementById('statP1Title').textContent = p1Name;
    document.getElementById('statP2Title').textContent = p2Name;

    document.getElementById('statP1Points').textContent = matchState.p1TotalPointsWon;
    document.getElementById('statP2Points').textContent = matchState.p2TotalPointsWon;

    const total = matchState.totalPointsPlayed || 1;
    const p1Pct = Math.round((matchState.p1TotalPointsWon / total) * 100);
    const p2Pct = Math.round((matchState.p2TotalPointsWon / total) * 100);

    document.getElementById('statP1Pct').textContent = p1Pct + '%';
    document.getElementById('statP2Pct').textContent = p2Pct + '%';

    const diffMs = Date.now() - matchState.startTime;
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    document.getElementById('statDuration').textContent = `${mins} мин ${secs < 10 ? '0' : ''}${secs} сек`;
}

function announceScore() {
    const p1Name = p1NameInput.value;
    const p2Name = p2NameInput.value;

    if (matchState.isFinished) {
        speak("Матч окончен!");
        return;
    }

    if (matchState.p1PointsIndex === 0 && matchState.p2PointsIndex === 0 && 
        matchState.p1TBPoints === 0 && matchState.p2TBPoints === 0) {
        speak(`Гейм! ${matchState.p1Games} - ${matchState.p2Games}`);
        return;
    }

    if (matchState.isTiebreak) {
        speak(`${matchState.p1TBPoints}, ${matchState.p2TBPoints}`);
        return;
    }

    const p1 = standardPoints[matchState.p1PointsIndex];
    const p2 = standardPoints[matchState.p2PointsIndex];

    if (p1 === "40" && p2 === "40") {
        speak("Ровно");
    } else if (p1 === "АД") {
        speak(`Больше ${p1Name}`);
    } else if (p2 === "АД") {
        speak(`Больше ${p2Name}`);
    } else {
        speak(`${p1}, ${p2}`);
    }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'ru-RU';

    let isListening = false;
    let manualStop = false;

    micBtn.addEventListener('click', () => {
        if (isListening) {
            manualStop = true;
            recognition.stop();
        } else {
            manualStop = false;
            try {
                recognition.start();
            } catch(e) { console.log(e); }
        }
    });

    recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
        statusText.textContent = "Слушаю команды (вечный режим)...";
    };

    recognition.onend = () => {
        if (!manualStop && settings.continuous) {
            try {
                recognition.start();
                return;
            } catch (e) {
                console.log("Ошибка рестарта:", e);
            }
        }
        isListening = false;
        micBtn.classList.remove('listening');
        statusText.textContent = "Микрофон выключен";
    };

    recognition.onresult = (event) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.trim().toLowerCase();
        lastCommand.textContent = `Команда: "${transcript}"`;
        processVoiceCommand(transcript);
    };

    recognition.onerror = (event) => {
        console.error("Ошибка распознавания:", event.error);
        statusText.textContent = "Ошибка микрофона (повтор...)";
    };
} else {
    statusText.textContent = "Браузер не поддерживает голосовой ввод";
    micBtn.style.display = 'none';
}

function processVoiceCommand(text) {
    const p1Name = p1NameInput.value.toLowerCase();
    const p2Name = p2NameInput.value.toLowerCase();

    if (text.includes('очко первому') || text.includes('первый') || text.includes('раз') || text.includes('очко 1') || text.includes(p1Name)) {
        addPoint(1);
    } else if (text.includes('очко второму') || text.includes('второй') || text.includes('два') || text.includes('очко 2') || text.includes(p2Name)) {
        addPoint(2);
    } else if (text.includes('аут первого')) {
        addPoint(2);
    } else if (text.includes('аут второго')) {
        addPoint(1);
    } else if (text.includes('отмена') || text.includes('назад')) {
        undoLast();
    } else if (text.includes('смена') || text.includes('подача') || text.includes('подачу')) {
        toggleServer();
    } else if (text.includes('сброс') || text.includes('заново')) {
        resetMatch();
    }
}
