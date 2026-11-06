// --- ИНИЦИАЛИЗАЦИЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBB7kVEkjIpJF5H8oxx3TCQM_VShk7ENys",
    authDomain: "tennis-voice-referee.firebaseapp.com",
    projectId: "tennis-voice-referee",
    storageBucket: "tennis-voice-referee.firebasestorage.app",
    messagingSenderId: "538967810120",
    appId: "1:538967810120:web:da9380fe0f87f300a9b87d",
    measurementId: "G-3F1KWP5CRJ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentNick = "";
let currentRoomCode = null;
let isHost = false;
let unsubscribeRoom = null;

// Переключение формы входа на форму регистрации
const showRegisterBtn = document.getElementById('showRegisterBtn');
const registerBtn = document.getElementById('registerBtn');
const authNickname = document.getElementById('authNickname');
let isRegisterMode = false;

showRegisterBtn.onclick = () => {
    if (!isRegisterMode) {
        isRegisterMode = true;
        authNickname.style.display = 'block';
        registerBtn.style.display = 'block';
        showRegisterBtn.style.display = 'none';
    }
};

// Отслеживание авторизации и загрузка профиля из Firestore
auth.onAuthStateChanged((user) => {
    currentUser = user;
    const authLoggedOut = document.getElementById('authLoggedOut');
    const authLoggedIn = document.getElementById('authLoggedIn');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const userNickDisplay = document.getElementById('userNickDisplay');

    if (user) {
        authLoggedOut.style.display = 'none';
        authLoggedIn.style.display = 'block';
        userEmailDisplay.textContent = user.email;

        db.collection("users").doc(user.uid).get().then(doc => {
            if (doc.exists) {
                currentNick = doc.data().nickname || "Игрок";
                userNickDisplay.textContent = currentNick;
                if (p1NameInput.value === "Игрок 1" || !p1NameInput.value) {
                    p1NameInput.value = currentNick;
                }
            }
        });
    } else {
        authLoggedOut.style.display = 'block';
        authLoggedIn.style.display = 'none';
        isRegisterMode = false;
        authNickname.style.display = 'none';
        registerBtn.style.display = 'none';
        showRegisterBtn.style.display = 'block';
        currentNick = "";
    }
});

// Модальные окна
const authModal = document.getElementById('authModal');
document.getElementById('openAuth').onclick = () => authModal.classList.add('active');
document.getElementById('closeAuth').onclick = () => authModal.classList.remove('active');

const roomModal = document.getElementById('roomModal');
document.getElementById('openRoom').onclick = () => roomModal.classList.add('active');
document.getElementById('closeRoom').onclick = () => roomModal.classList.remove('active');

// Вход
document.getElementById('loginBtn').onclick = () => {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    auth.signInWithEmailAndPassword(email, password)
        .then(() => { alert("Успешный вход!"); authModal.classList.remove('active'); })
        .catch((error) => alert("Ошибка входа: " + error.message));
};

// Регистрация
registerBtn.onclick = () => {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const nickname = authNickname.value.trim();

    if (!nickname) {
        alert("Введите ник!");
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((cred) => {
            return db.collection("users").doc(cred.user.uid).set({
                email: email,
                nickname: nickname,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            alert("Регистрация успешна!");
            authModal.classList.remove('active');
        })
        .catch((error) => alert("Ошибка регистрации: " + error.message));
};

document.getElementById('logoutBtn').onclick = () => {
    auth.signOut().then(() => alert("Вы вышли из аккаунта"));
};

// --- ЛИЧНЫЙ КАБИНЕТ И ИСТОРИЯ МАТЧЕЙ ---
const profileModal = document.getElementById('profileModal');
document.getElementById('openProfile').onclick = () => {
    if (!currentUser) {
        alert("Пожалуйста, войдите в аккаунт, чтобы открыть личный кабинет!");
        authModal.classList.add('active');
        return;
    }
    loadUserProfileAndMatches();
    profileModal.classList.add('active');
};
document.getElementById('closeProfile').onclick = () => profileModal.classList.remove('active');

function loadUserProfileAndMatches() {
    const profileNotLogged = document.getElementById('profileNotLogged');
    const profileLogged = document.getElementById('profileLogged');
    
    if (!currentUser) {
        profileNotLogged.style.display = 'block';
        profileLogged.style.display = 'none';
        return;
    }

    profileNotLogged.style.display = 'none';
    profileLogged.style.display = 'block';

    document.getElementById('profileNick').textContent = currentNick || "Игрок";
    document.getElementById('profileEmail').textContent = currentUser.email;

    const historyListContainer = document.getElementById('matchesHistoryList');
    historyListContainer.innerHTML = "Загрузка истории...";

    // Загружаем матчи только по фильтру userId (без .orderBy), чтобы не требовать индексов в Firestore
    db.collection("matches")
        .where("userId", "==", currentUser.uid)
        .get()
        .then((querySnapshot) => {
            historyListContainer.innerHTML = "";
            document.getElementById('profileMatchesCount').textContent = querySnapshot.size;

            if (querySnapshot.empty) {
                historyListContainer.innerHTML = "<p style='color: var(--text-muted); font-size: 0.9rem;'>У вас пока нет сохраненных матчей.</p>";
                return;
            }

            // Собираем данные в массив и сортируем их по дате (сначала новые) прямо в JavaScript
            let matches = [];
            querySnapshot.forEach((doc) => {
                matches.push(doc.data());
            });

            matches.sort((a, b) => {
                const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
                const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
                return timeB - timeA; // От новых к старым
            });

            // Рендерим отсортированный список на экран
            matches.forEach((match) => {
                const date = match.timestamp ? match.timestamp.toDate().toLocaleDateString('ru-RU') : "Недавно";
                const mins = Math.floor((match.durationSeconds || 0) / 60);
                const setsP1 = match.p1Sets ? match.p1Sets.join('-') : '0';
                const setsP2 = match.p2Sets ? match.p2Sets.join('-') : '0';

                const matchCard = document.createElement('div');
                matchCard.style.cssText = "background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; border: 1px solid #334155; font-size: 0.9rem;";
                matchCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.8rem; margin-bottom: 4px;">
                        <span>📅 ${date}</span>
                        <span>⏱️ ${mins} мин</span>
                    </div>
                    <div style="font-weight: bold; color: var(--text-main);">
                        ${match.player1} vs ${match.player2}
                    </div>
                    <div style="color: var(--accent-green); margin-top: 2px;">
                        Счет по сетам: <b>${setsP1} : ${setsP2}</b> (Очков: ${match.p1PointsWon} / ${match.p2PointsWon})
                    </div>
                `;
                historyListContainer.appendChild(matchCard);
            });
        })
        .catch((error) => {
            console.error("Ошибка загрузки истории:", error);
            historyListContainer.innerHTML = "<p style='color: var(--accent-red); font-size: 0.85rem;'>Ошибка загрузки истории матчей.</p>";
        });
}


// --- УПРАВЛЕНИЕ КОМНАТАМИ ---
document.getElementById('createRoomBtn').onclick = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    currentRoomCode = code;
    isHost = true;

    if (currentNick) {
        p1NameInput.value = currentNick;
    }

    db.collection("rooms").doc(code).set({
        state: matchState,
        p1Name: p1NameInput.value,
        p2Name: p2NameInput.value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('roomControls').style.display = 'none';
        document.getElementById('roomActiveInfo').style.display = 'block';
        document.getElementById('displayRoomCode').textContent = code;
        document.getElementById('roomRoleText').textContent = "Вы — Судья (Хозяин комнаты)";
    }).catch(err => alert("Ошибка создания комнаты: " + err.message));
};

document.getElementById('joinRoomBtn').onclick = () => {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!code) return alert("Введите код комнаты!");

    currentRoomCode = code;
    isHost = false;

    db.collection("rooms").doc(code).get().then(doc => {
        if (!doc.exists) {
            alert("Комната не найдена!");
            currentRoomCode = null;
            return;
        }

        document.getElementById('roomControls').style.display = 'none';
        document.getElementById('roomActiveInfo').style.display = 'block';
        document.getElementById('displayRoomCode').textContent = code;
        document.getElementById('roomRoleText').textContent = "Вы — Зритель / Подключенный игрок";

        unsubscribeRoom = db.collection("rooms").doc(code).onSnapshot(docSnap => {
            if (docSnap.exists) {
                const data = docSnap.data();
                matchState = data.state;
                p1NameInput.value = data.p1Name;
                p2NameInput.value = data.p2Name;
                updateUI();
            }
        });
    }).catch(err => alert("Ошибка подключения: " + err.message));
};

document.getElementById('leaveRoomBtn').onclick = () => {
    if (unsubscribeRoom) unsubscribeRoom();
    currentRoomCode = null;
    isHost = false;
    document.getElementById('roomControls').style.display = 'block';
    document.getElementById('roomActiveInfo').style.display = 'none';
    document.getElementById('roomCodeInput').value = '';
    alert("Вы покинули комнату");
};

function syncRoom() {
    if (currentRoomCode && isHost) {
        db.collection("rooms").doc(currentRoomCode).set({
            state: matchState,
            p1Name: p1NameInput.value,
            p2Name: p2NameInput.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.error("Ошибка синхронизации:", err));
    }
}


// --- ОСНОВНАЯ ЛОГИКА ТЕННИСНОГО АРБИТРА ---

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
    isStarted: false,
    isPaused: false,
    startTime: null,
    elapsedSeconds: 0,
    p1TotalPointsWon: 0,
    p2TotalPointsWon: 0,
    totalPointsPlayed: 0
};

let timerInterval = null;
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
const matchBadge = document.getElementById('matchBadge');
const matchStatusText = document.getElementById('matchStatusText');
const startPauseBtn = document.getElementById('startPauseBtn');

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
        setTimeout(() => { oscillator.stop(); audioCtx.close(); }, duration);
    } catch (e) { console.log(e); }
}

const fullscreenBtn = document.getElementById('fullscreenBtn');
fullscreenBtn.addEventListener('click', () => {
    document.body.classList.toggle('fullscreen-mode');
    const micSection = document.querySelector('.mic-section');
    const headerBtns = document.querySelector('.header-btns');
    if (document.body.classList.contains('fullscreen-mode')) {
        micSection.appendChild(fullscreenBtn);
        fullscreenBtn.textContent = '✕';
    } else {
        headerBtns.appendChild(fullscreenBtn);
        fullscreenBtn.textContent = '⛶';
    }
});

const settingsModal = document.getElementById('settingsModal');
const statsModal = document.getElementById('statsModal');
document.getElementById('openSettings').onclick = () => settingsModal.classList.add('active');
document.getElementById('closeSettings').onclick = () => settingsModal.classList.remove('active');
document.getElementById('openStats').onclick = () => { updateStatsDisplay(); statsModal.classList.add('active'); };
document.getElementById('closeStats').onclick = () => statsModal.classList.remove('active');

const ttsToggle = document.getElementById('ttsToggle');
const continuousToggle = document.getElementById('continuousToggle');
const beepToggle = document.getElementById('beepToggle');

ttsToggle.checked = settings.ttsEnabled;
continuousToggle.checked = settings.continuous;
beepToggle.checked = settings.beepEnabled;

ttsToggle.onchange = (e) => { settings.ttsEnabled = e.target.checked; localStorage.setItem('tennis_tts', settings.ttsEnabled); };
continuousToggle.onchange = (e) => { settings.continuous = e.target.checked; localStorage.setItem('tennis_continuous', settings.continuous); };
beepToggle.onchange = (e) => { settings.beepEnabled = e.target.checked; localStorage.setItem('tennis_beep', settings.beepEnabled); };

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

function toggleMatchState() {
    if (matchState.isFinished || (!isHost && currentRoomCode)) return;

    if (!matchState.isStarted || matchState.isPaused) {
        matchState.isStarted = true;
        matchState.isPaused = false;
        matchState.startTime = Date.now() - (matchState.elapsedSeconds * 1000);

        matchBadge.className = "match-status-badge active";
        startPauseBtn.textContent = "⏸️ Пауза";
        startPauseBtn.className = "btn btn-yellow";

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (matchState.isStarted && !matchState.isPaused && !matchState.isFinished) {
                matchState.elapsedSeconds = Math.floor((Date.now() - matchState.startTime) / 1000);
                const mins = Math.floor(matchState.elapsedSeconds / 60);
                const secs = matchState.elapsedSeconds % 60;
                matchStatusText.textContent = `Матч идет: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
                syncRoom();
            }
        }, 1000);

        playBeep(900, 200);
        speak("Матч начался");
    } else {
        matchState.isPaused = true;
        if (timerInterval) clearInterval(timerInterval);

        matchBadge.className = "match-status-badge paused";
        startPauseBtn.textContent = "▶️ Продолжить";
        startPauseBtn.className = "btn btn-green";
        matchStatusText.textContent = "Пауза";

        playBeep(500, 150);
        speak("Матч на паузе");
    }
    syncRoom();
}

function finishMatch() {
    if (matchState.isFinished || (!isHost && currentRoomCode)) return;
    matchState.isFinished = true;
    matchState.isPaused = false;
    if (timerInterval) clearInterval(timerInterval);

    matchBadge.className = "match-status-badge finished";
    matchStatusText.textContent = "Матч завершен";
    startPauseBtn.textContent = "▶️ Старт матча";
    startPauseBtn.className = "btn btn-yellow";

    playBeep(400, 300);
    speak("Матч завершен!");
    syncRoom();

    if (currentUser) {
        db.collection("matches").add({
            userId: currentUser.uid,
            player1: p1NameInput.value,
            player2: p2NameInput.value,
            p1Sets: matchState.p1Sets,
            p2Sets: matchState.p2Sets,
            p1PointsWon: matchState.p1TotalPointsWon,
            p2PointsWon: matchState.p2TotalPointsWon,
            durationSeconds: matchState.elapsedSeconds,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.error(err));
    }

    updateStatsDisplay();
    statsModal.classList.add('active');
}

function saveHistory() {
    history.push(JSON.parse(JSON.stringify(matchState)));
    if (history.length > 20) history.shift();
}

function undoLast() {
    if (matchState.isFinished || (!isHost && currentRoomCode)) return;
    if (history.length > 0) {
        matchState = history.pop();
        updateUI();
        syncRoom();
        playBeep(400, 150);
        speak("Очко отменено");
    }
}

function addPoint(player) {
    if (matchState.isFinished || (!isHost && currentRoomCode)) return;
    
    if (!matchState.isStarted || matchState.isPaused) {
        toggleMatchState();
        return;
    }

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
    syncRoom();
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
    if (totalTB % 2 === 1) toggleServer(false);

    if (matchState.p1TBPoints >= 7 && (matchState.p1TBPoints - matchState.p2TBPoints >= 2)) winGame(1);
    else if (matchState.p2TBPoints >= 7 && (matchState.p2TBPoints - matchState.p1TBPoints >= 2)) winGame(2);
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

    if (g1 === 6 && g2 === 6) matchState.isTiebreak = true;
    else if (g1 >= 6 && (g1 - g2 >= 2)) winSet(1);
    else if (g2 >= 6 && (g2 - g1 >= 2)) winSet(2);
}

function winSet(player) {
    matchState.p1Sets.push(matchState.p1Games);
    matchState.p2Sets.push(matchState.p2Games);
    matchState.p1Games = 0;
    matchState.p2Games = 0;

    if (matchState.p1Sets.length + matchState.p2Sets.length >= 3) finishMatch();
}

function toggleServer(userAction = true) {
    if (!isHost && currentRoomCode) return;
    matchState.server = matchState.server === 1 ? 2 : 1;
    updateUI();
    syncRoom();
    if (userAction) speak("Смена подачи");
}

function resetMatch() {
    if (!isHost && currentRoomCode) return;
    if (timerInterval) clearInterval(timerInterval);
    matchState = {
        p1PointsIndex: 0, p2PointsIndex: 0, p1Games: 0, p2Games: 0,
        p1Sets: [], p2Sets: [], server: 1, isTiebreak: false,
        p1TBPoints: 0, p2TBPoints: 0, isFinished: false, isStarted: false,
        isPaused: false, startTime: null, elapsedSeconds: 0,
        p1TotalPointsWon: 0, p2TotalPointsWon: 0, totalPointsPlayed: 0
    };
    
    matchBadge.className = "match-status-badge";
    matchStatusText.textContent = "Ожидание старта матча";
    startPauseBtn.textContent = "▶️ Старт матча";
    startPauseBtn.className = "btn btn-yellow";
    
    history = [];
    updateUI();
    syncRoom();
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
    document.getElementById('statP1Title').textContent = p1NameInput.value;
    document.getElementById('statP2Title').textContent = p2NameInput.value;
    document.getElementById('statP1Points').textContent = matchState.p1TotalPointsWon;
    document.getElementById('statP2Points').textContent = matchState.p2TotalPointsWon;

    const total = matchState.totalPointsPlayed || 1;
    document.getElementById('statP1Pct').textContent = Math.round((matchState.p1TotalPointsWon / total) * 100) + '%';
    document.getElementById('statP2Pct').textContent = Math.round((matchState.p2TotalPointsWon / total) * 100) + '%';

    const mins = Math.floor(matchState.elapsedSeconds / 60);
    const secs = matchState.elapsedSeconds % 60;
    document.getElementById('statDuration').textContent = `${mins} мин ${secs < 10 ? '0' : ''}${secs} сек`;
}

function announceScore() {
    if (!settings.ttsEnabled) return;
    const p1Name = p1NameInput.value;
    const p2Name = p2NameInput.value;

    if (matchState.isFinished) { speak("Матч окончен!"); return; }
    if (matchState.p1PointsIndex === 0 && matchState.p2PointsIndex === 0 && matchState.p1TBPoints === 0 && matchState.p2TBPoints === 0) {
        speak(`Гейм! ${matchState.p1Games} - ${matchState.p2Games}`); return;
    }
    if (matchState.isTiebreak) { speak(`${matchState.p1TBPoints}, ${matchState.p2TBPoints}`); return; }

    const p1 = standardPoints[matchState.p1PointsIndex];
    const p2 = standardPoints[matchState.p2PointsIndex];

    if (p1 === "40" && p2 === "40") speak("Ровно");
    else if (p1 === "АД") speak(`Больше ${p1Name}`);
    else if (p2 === "АД") speak(`Больше ${p2Name}`);
    else speak(`${p1}, ${p2}`);
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
        if (isListening) { manualStop = true; recognition.stop(); }
        else { manualStop = false; try { recognition.start(); } catch(e) { console.log(e); } }
    });

    recognition.onstart = () => { isListening = true; micBtn.classList.add('listening'); statusText.textContent = "Слушаю команды..."; };
    recognition.onend = () => {
        if (!manualStop && settings.continuous) { try { recognition.start(); return; } catch (e) {} }
        isListening = false; micBtn.classList.remove('listening'); statusText.textContent = "Микрофон выключен";
    };
    recognition.onresult = (event) => {
        const transcript = event.results[event.resultIndex][0].transcript.trim().toLowerCase();
        lastCommand.textContent = `Команда: "${transcript}"`;
        processVoiceCommand(transcript);
    };
}

function processVoiceCommand(text) {
    if (currentRoomCode && !isHost) return;
    const p1Name = p1NameInput.value.toLowerCase();
    const p2Name = p2NameInput.value.toLowerCase();

    if (text.includes('старт матча') || text.includes('старт')) { if (!matchState.isStarted || matchState.isPaused) toggleMatchState(); }
    else if (text.includes('пауза') || text.includes('стоп')) { if (matchState.isStarted && !matchState.isPaused) toggleMatchState(); }
    else if (text.includes('завершить матч')) { finishMatch(); }
    else if (text.includes('очко первому') || text.includes('первый') || text.includes('раз') || text.includes(p1Name)) { addPoint(1); }
    else if (text.includes('очко второму') || text.includes('второй') || text.includes('два') || text.includes(p2Name)) { addPoint(2); }
    else if (text.includes('аут первого')) { addPoint(2); }
    else if (text.includes('аут второго')) { addPoint(1); }
    else if (text.includes('отмена') || text.includes('назад')) { undoLast(); }
    else if (text.includes('смена') || text.includes('подача')) { toggleServer(); }
    else if (text.includes('сброс') || text.includes('заново')) { resetMatch(); }
}
