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

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let currentUser = null;
let currentNick = "";
let currentRoomCode = null;
let isHost = false;
let userRole = "viewer"; // "host", "p1", "p2", "viewer"
let pendingRoomCode = null;
let unsubscribeRoom = null;
let isRegisterMode = false;
let myParticipantEntry = null; // Точная запись текущего пользователя в списке участников

// --- DOM ЭЛЕМЕНТЫ ---
const p1NameInput = document.getElementById('p1Name');
const p2NameInput = document.getElementById('p2Name');
const authNickname = document.getElementById('authNickname');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const registerBtn = document.getElementById('registerBtn');
const authModal = document.getElementById('authModal');
const roomModal = document.getElementById('roomModal');
const profileModal = document.getElementById('profileModal');
const settingsModal = document.getElementById('settingsModal');
const statsModal = document.getElementById('statsModal');
const micBtn = document.getElementById('micBtn');
const statusText = document.getElementById('statusText');
const lastCommand = document.getElementById('lastCommand');
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
const fullscreenBtn = document.getElementById('fullscreenBtn');
const ttsToggle = document.getElementById('ttsToggle');
const continuousToggle = document.getElementById('continuousToggle');
const beepToggle = document.getElementById('beepToggle');

// --- УПРАВЛЕНИЕ ПРАВАМИ И ДОСТУПОМ ---
function updateControlPermissions() {
    if (currentRoomCode && userRole === "viewer") {
        document.body.classList.add('viewer-mode');
    } else {
        document.body.classList.remove('viewer-mode');
    }
}

// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---
showRegisterBtn.onclick = () => {
    if (!isRegisterMode) {
        isRegisterMode = true;
        authNickname.style.display = 'block';
        registerBtn.style.display = 'block';
        showRegisterBtn.style.display = 'none';
    }
};

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

document.getElementById('openAuth').onclick = () => authModal.classList.add('active');
document.getElementById('closeAuth').onclick = () => authModal.classList.remove('active');

document.getElementById('openRoom').onclick = () => roomModal.classList.add('active');
document.getElementById('closeRoom').onclick = () => roomModal.classList.remove('active');

document.getElementById('loginBtn').onclick = () => {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    auth.signInWithEmailAndPassword(email, password)
        .then(() => { alert("Успешный вход!"); authModal.classList.remove('active'); })
        .catch((error) => alert("Ошибка входа: " + error.message));
};

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

            let matches = [];
            querySnapshot.forEach((doc) => { matches.push(doc.data()); });

            matches.sort((a, b) => {
                const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
                const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
                return timeB - timeA;
            });

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

// --- УПРАВЛЕНИЕ КОМНАТАМИ И РОЛЯМИ ---
document.getElementById('createRoomBtn').onclick = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    currentRoomCode = code;
    isHost = true;
    userRole = "host";
    updateControlPermissions();

    const hostName = currentNick || "Судья";
    myParticipantEntry = hostName + " (Судья)";

    resetMatchStateOnly();

    db.collection("rooms").doc(code).set({
        state: matchState,
        p1Name: p1NameInput.value,
        p2Name: p2NameInput.value,
        player1Id: null,
        player2Id: null,
        participants: [myParticipantEntry],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('roomControls').style.display = 'none';
        document.getElementById('roomActiveInfo').style.display = 'block';
        document.getElementById('displayRoomCode').textContent = code;
        document.getElementById('roomRoleText').textContent = "Вы — Судья (Хозяин комнаты)";
        subscribeToRoom(code);
    }).catch(err => alert("Ошибка создания комнаты: " + err.message));
};

document.getElementById('checkRoomBtn').onclick = () => {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!code) return alert("Введите код комнаты!");

    db.collection("rooms").doc(code).get().then(doc => {
        if (!doc.exists) {
            alert("Комната не найдена!");
            return;
        }
        pendingRoomCode = code;
        document.getElementById('roomControls').style.display = 'none';
        document.getElementById('roomRoleSelection').style.display = 'block';
    }).catch(err => alert("Ошибка: " + err.message));
};

document.getElementById('backToRoomCodeBtn').onclick = () => {
    document.getElementById('roomRoleSelection').style.display = 'none';
    document.getElementById('roomControls').style.display = 'block';
    pendingRoomCode = null;
};

document.getElementById('selectRoleP1').onclick = () => joinAsRole("p1");
document.getElementById('selectRoleP2').onclick = () => joinAsRole("p2");
document.getElementById('selectRoleViewer').onclick = () => joinAsRole("viewer");

function joinAsRole(role) {
    if (!currentUser && role !== "viewer") {
        alert("Для участия в качестве игрока необходимо войти в аккаунт!");
        authModal.classList.add('active');
        return;
    }

    currentRoomCode = pendingRoomCode;
    userRole = role;
    isHost = false;
    updateControlPermissions();

    db.collection("rooms").doc(currentRoomCode).get().then(doc => {
        if (!doc.exists) return alert("Комната не найдена!");
        
        const data = doc.data();
        let p1Name = data.p1Name;
        let p2Name = data.p2Name;
        let p1Id = data.player1Id;
        let p2Id = data.player2Id;
        const myName = currentNick || (currentUser ? currentUser.email : "Зритель");

        if (role === "p1") {
            if (p1Id && p1Id !== currentUser.uid) {
                alert("Место Игрока 1 уже занято другим игроком!");
                return;
            }
            p1Id = currentUser.uid;
            p1Name = currentNick;
        } else if (role === "p2") {
            if (p2Id && p2Id !== currentUser.uid) {
                alert("Место Игрока 2 уже занято другим игроком!");
                return;
            }
            p2Id = currentUser.uid;
            p2Name = currentNick;
        }

        let participants = data.participants || [];
        participants = participants.filter(p => !p.startsWith(myName));

        const roleLabel = role === "p1" ? " (Игрок 1)" : role === "p2" ? " (Игрок 2)" : " (Зритель)";
        myParticipantEntry = myName + roleLabel;
        participants.push(myParticipantEntry);

        db.collection("rooms").doc(currentRoomCode).update({
            p1Name: p1Name,
            p2Name: p2Name,
            player1Id: p1Id,
            player2Id: p2Id,
            participants: participants
        }).then(() => {
            document.getElementById('roomRoleSelection').style.display = 'none';
            document.getElementById('roomActiveInfo').style.display = 'block';
            document.getElementById('displayRoomCode').textContent = currentRoomCode;
            document.getElementById('roomRoleText').textContent = role === "viewer" ? "Вы — Зритель" : `Вы играете как ${currentNick}`;
            subscribeToRoom(currentRoomCode);
        });
    });
}

function subscribeToRoom(code) {
    if (unsubscribeRoom) unsubscribeRoom();

    unsubscribeRoom = db.collection("rooms").doc(code).onSnapshot(docSnap => {
        if (docSnap.exists) {
            const data = docSnap.data();
            const wasFinished = matchState.isFinished;

            // Принимаем данные от сервера ТОЛЬКО ЕСЛИ их версия новее или равна нашей локальной версии
            if (data.state) {
                const serverVersion = data.state.version || 0;
                if (serverVersion >= matchState.version) {
                    matchState = data.state;
                    updateUI();
                }
            }

            if (data.p1Name) p1NameInput.value = data.p1Name;
            if (data.p2Name) p2NameInput.value = data.p2Name;

            if (data.participants && Array.isArray(data.participants)) {
                const playersListEl = document.getElementById('roomPlayersList');
                if (playersListEl) {
                    playersListEl.innerHTML = data.participants.length > 0 
                        ? data.participants.join('<br>') 
                        : "Ожидание участников...";
                }
            }

            if (matchState.isFinished && !wasFinished) {
                if (currentUser && (userRole === "p1" || userRole === "p2" || isHost)) {
                    saveMatchToPersonalHistory();
                }

                updateStatsDisplay();
                statsModal.classList.add('active');
            }
        }
    });
}

document.getElementById('leaveRoomBtn').onclick = () => {
    leaveCurrentRoom();
};

function leaveCurrentRoom() {
    if (currentRoomCode && myParticipantEntry) {
        let updateData = {
            participants: firebase.firestore.FieldValue.arrayRemove(myParticipantEntry)
        };
        if (userRole === "p1") {
            updateData.player1Id = null;
            updateData.p1Name = "Игрок 1";
        } else if (userRole === "p2") {
            updateData.player2Id = null;
            updateData.p2Name = "Игрок 2";
        }
        db.collection("rooms").doc(currentRoomCode).update(updateData).catch(err => console.log(err));
    }

    cleanupRoomState();
    alert("Вы покинули комнату");
}

window.addEventListener('beforeunload', () => {
    if (currentRoomCode && myParticipantEntry) {
        let updateData = {
            participants: firebase.firestore.FieldValue.arrayRemove(myParticipantEntry)
        };
        if (userRole === "p1") {
            updateData.player1Id = null;
        } else if (userRole === "p2") {
            updateData.player2Id = null;
        }
        db.collection("rooms").doc(currentRoomCode).update(updateData).catch(() => {});
    }
});

function cleanupRoomState() {
    if (unsubscribeRoom) unsubscribeRoom();
    currentRoomCode = null;
    isHost = false;
    userRole = "viewer";
    myParticipantEntry = null;
    
    updateControlPermissions();
    
    document.getElementById('roomControls').style.display = 'block';
    document.getElementById('roomActiveInfo').style.display = 'none';
    document.getElementById('roomRoleSelection').style.display = 'none';
    document.getElementById('roomCodeInput').value = '';
    
    resetMatchStateOnly();
    updateUI();
}

function resetMatchStateOnly() {
    if (timerInterval) clearInterval(timerInterval);
    matchState = {
        version: 0,
        p1PointsIndex: 0, p2PointsIndex: 0, p1Games: 0, p2Games: 0,
        p1Sets: [], p2Sets: [], server: 1, isTiebreak: false,
        p1TBPoints: 0, p2TBPoints: 0, isFinished: false, isStarted: false,
        isPaused: false, startTime: null, elapsedSeconds: 0,
        p1TotalPointsWon: 0, p2TotalPointsWon: 0, totalPointsPlayed: 0,
        badgeClass: "match-status-badge",
        statusText: "Ожидание старта матча"
    };
    history = [];
}

function syncRoom() {
    if (currentRoomCode && (isHost || userRole === "p1" || userRole === "p2")) {
        // Увеличиваем версию при каждом локальном действии перед отправкой в базу
        matchState.version++;

        db.collection("rooms").doc(currentRoomCode).set({
            state: matchState,
            p1Name: p1NameInput.value,
            p2Name: p2NameInput.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(err => {
            console.error("Ошибка синхронизации:", err);
        });
    }
}

p1NameInput.oninput = () => { syncRoom(); };
p2NameInput.oninput = () => { syncRoom(); };


// --- ОСНОВНАЯ ЛОГИКА ТЕННИСНОГО АРБИТРА ---
let settings = {
    ttsEnabled: localStorage.getItem('tennis_tts') !== 'false',
    continuous: localStorage.getItem('tennis_continuous') !== 'false',
    beepEnabled: localStorage.getItem('tennis_beep') !== 'false'
};

let matchState = {
    version: 0,
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
    totalPointsPlayed: 0,
    badgeClass: "match-status-badge",
    statusText: "Ожидание старта матча"
};

let timerInterval = null;
const standardPoints = ["0", "15", "30", "40", "АД"];
let history = [];

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

document.getElementById('openSettings').onclick = () => settingsModal.classList.add('active');
document.getElementById('closeSettings').onclick = () => settingsModal.classList.remove('active');
document.getElementById('openStats').onclick = () => { updateStatsDisplay(); statsModal.classList.add('active'); };
document.getElementById('closeStats').onclick = () => statsModal.classList.remove('active');

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
    if (currentRoomCode && !isHost && userRole !== "p1" && userRole !== "p2") {
        alert("Зрители не могут управлять матчем!");
        return;
    }
    if (matchState.isFinished) return;

    if (!matchState.isStarted || matchState.isPaused) {
        matchState.isStarted = true;
        matchState.isPaused = false;
        matchState.startTime = Date.now() - (matchState.elapsedSeconds * 1000);

        matchState.badgeClass = "match-status-badge active";
        matchState.statusText = `Матч идет: 0:00`;

        updateUI();

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (matchState.isStarted && !matchState.isPaused && !matchState.isFinished) {
                matchState.elapsedSeconds = Math.floor((Date.now() - matchState.startTime) / 1000);
                const mins = Math.floor(matchState.elapsedSeconds / 60);
                const secs = matchState.elapsedSeconds % 60;
                matchState.statusText = `Матч идет: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
                
                if (matchStatusText) {
                    matchStatusText.textContent = matchState.statusText;
                }

                if (currentRoomCode) {
                    syncRoom();
                }
            }
        }, 1000);

        playBeep(900, 200);
        speak("Матч начался");
    } else {
        matchState.isPaused = true;
        if (timerInterval) clearInterval(timerInterval);

        matchState.badgeClass = "match-status-badge paused";
        matchState.statusText = "Пауза";

        updateUI();

        playBeep(500, 150);
        speak("Матч на паузе");
    }
    syncRoom();
}

function finishMatch() {
    if (currentRoomCode && !isHost && userRole !== "p1" && userRole !== "p2") return;
    if (matchState.isFinished) return;
    
    matchState.isFinished = true;
    matchState.isPaused = false;
    if (timerInterval) clearInterval(timerInterval);

    matchState.badgeClass = "match-status-badge finished";
    matchState.statusText = "Матч завершен";

    playBeep(400, 300);
    speak("Матч завершен!");
    
    syncRoom();
    saveMatchToPersonalHistory();

    updateStatsDisplay();
    statsModal.classList.add('active');
}

function saveMatchToPersonalHistory() {
    if (!currentUser) return;

    const matchData = {
        userId: currentUser.uid,
        player1: p1NameInput.value,
        player2: p2NameInput.value,
        p1Sets: matchState.p1Sets,
        p2Sets: matchState.p2Sets,
        p1PointsWon: matchState.p1TotalPointsWon,
        p2PointsWon: matchState.p2TotalPointsWon,
        durationSeconds: matchState.elapsedSeconds,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("matches").add(matchData)
        .then(() => console.log("Матч успешно сохранен в личный кабинет!"))
        .catch(err => console.error("Ошибка сохранения матча в историю:", err));
}

function saveHistory() {
    history.push(JSON.parse(JSON.stringify(matchState)));
    if (history.length > 20) history.shift();
}

function undoLast() {
    if (currentRoomCode && !isHost && userRole !== "p1" && userRole !== "p2") return;
    if (matchState.isFinished) return;
    if (history.length > 0) {
        matchState = history.pop();
        updateUI();
        syncRoom();
        playBeep(400, 150);
        speak("Очко отменено");
    }
}

function addPoint(player) {
    if (currentRoomCode && !isHost && userRole !== "p1" && userRole !== "p2") {
        alert("Зрители не могут начислять очки!");
        return;
    }

    if (matchState.isFinished) return;
    
    if (!matchState.isStarted || matchState.isPaused) {
        matchState.isStarted = true;
        matchState.isPaused = false;
        matchState.startTime = Date.now() - (matchState.elapsedSeconds * 1000);
        matchState.badgeClass = "match-status-badge active";
        matchState.statusText = "Матч идет: 0:00";
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
    if (currentRoomCode && !isHost && userRole !== "p1" && userRole !== "p2") return;
    matchState.server = matchState.server === 1 ? 2 : 1;
    updateUI();
    syncRoom();
    if (userAction) speak("Смена подачи");
}

function resetMatch() {
    if (currentRoomCode && !isHost && userRole !== "p1" && userRole !== "p2") return;
    if (timerInterval) clearInterval(timerInterval);
    
    matchState = {
        version: matchState.version + 1,
        p1PointsIndex: 0, p2PointsIndex: 0, p1Games: 0, p2Games: 0,
        p1Sets: [], p2Sets: [], server: 1, isTiebreak: false,
        p1TBPoints: 0, p2TBPoints: 0, isFinished: false, isStarted: false,
        isPaused: false, startTime: null, elapsedSeconds: 0,
        p1TotalPointsWon: 0, p2TotalPointsWon: 0, totalPointsPlayed: 0,
        badgeClass: "match-status-badge",
        statusText: "Ожидание старта матча"
    };
    
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

    if (matchState.badgeClass) {
        matchBadge.className = matchState.badgeClass;
    }
    if (matchState.statusText) {
        matchStatusText.textContent = matchState.statusText;
    }

    if (matchState.isStarted && !matchState.isFinished && !matchState.isPaused) {
        startPauseBtn.textContent = "⏸️ Пауза";
        startPauseBtn.className = "btn btn-yellow";
    } else if (matchState.isPaused) {
        startPauseBtn.textContent = "▶️ Продолжить";
        startPauseBtn.className = "btn btn-green";
    } else {
        startPauseBtn.textContent = "▶️ Старт матча";
        startPauseBtn.className = "btn btn-yellow";
    }

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

// --- УПРАВЛЕНИЕ БЛОКИРОВКОЙ ЭКРАНА (Wake Lock API) ---
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
            });
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
}

document.addEventListener('click', () => {
    if (!wakeLock && document.visibilityState === 'visible') {
        requestWakeLock();
    }
}, { once: true });

document.addEventListener('visibilitychange', async () => {
    if (wakeLock === null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

// --- ГОЛОСОВОЕ УПРАВЛЕНИЕ ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'ru-RU';

    let isListening = false;
    let manualStop = false;

    micBtn.addEventListener('click', () => {
        if (currentRoomCode && userRole === "viewer") return;
        if (isListening) { manualStop = true; recognition.stop(); }
        else { manualStop = false; try { recognition.start(); } catch(e) { console.log(e); } }
    });

    recognition.onstart = () => { isListening = true; micBtn.classList.add('listening'); statusText.textContent = "Слушаю команды..."; };
    recognition.onend = () => {
        if (!manualStop && settings.continuous) { try { recognition.start(); return; } catch (e) {} }
        isListening = false; micBtn.classList.remove('listening'); statusText.textContent = "Микрофон выключен";
    };
    recognition.onresult = (event) => {
        if (currentRoomCode && userRole === "viewer") return;
        const transcript = event.results[event.resultIndex][0].transcript.trim().toLowerCase();
        lastCommand.textContent = `Команда: "${transcript}"`;
        processVoiceCommand(transcript);
    };
}

function processVoiceCommand(text) {
    if (currentRoomCode && !isHost && userRole !== "p1" && userRole !== "p2") return;
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
