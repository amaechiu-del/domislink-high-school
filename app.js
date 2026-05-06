// Global state
window.state = {
    currentLevel: "sss1",
    currentSyllabus: "waec",
    currentSubject: null
};
function getTopicId(level, syllabus, subject, topic) {
    const sanitize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${sanitize(level)}_${sanitize(syllabus)}_${sanitize(subject)}_${sanitize(topic)}`;
}
// DomisLink High School Academy - Complete App
const PAYSTACK_PUBLIC_KEY = "pk_live_b9ce8aa36118824d41d49c09824d49161a824a5b";
const XP_PER_TOPIC = 100;
const XP_PER_QUIZ_RIGHT = 20;
const PRICE_PER_DAY = 300;

let syllabuses = {};

// Translations
const translations = {
    english: { back: "← Back to Subjects", pay: "Pay via Paystack", listen: "🔊 Listen to Lesson", complete: "Mark as Completed", video: "📺 Watch Video Lesson", ask: "Ask", placeholder: "Ask anything about this topic...", quiz: "📝 Take Topic Quiz" },
    pidgin: { back: "← Go back to Subjects", pay: "Pay via Paystack", listen: "🔊 Hear the Lesson", complete: "I don finish am", video: "📺 Watch Video", ask: "Ask", placeholder: "Ask any question about wetin you learn..." },
    yoruba: { back: "← Paada si Awọn Koko-ọrọ", pay: "San pẹlu Paystack", listen: "🔊 Tẹtí sí Ẹ̀kọ́", complete: "Samisi bi o ti pari", video: "📺 Wo Fidio Ẹ̀kọ́", ask: "Beere", placeholder: "Beere ohun rárá nipa akọle yii..." },
    hausa: { back: "← Koma zuwa Batutuwa", pay: "Biya ta Paystack", listen: "🔊 Saurari Darasi", complete: "Yi alama a matsayin an gama", video: "📺 Kalli Bidiyon Darasi", ask: "Tambaya", placeholder: "Tambayi komai game da wannan batu..." },
    igbo: { back: "← Laghachi na Ihe Ọmụmụ", pay: "Kwụọ site na Paystack", listen: "🔊 Gee ntị na Ihe Ọmụmụ", complete: "Gosi na emechara ya", video: "📺 Lelee Vidio Ihe Ọmụmụ", ask: "Jụọ", placeholder: "Jụọ ihe ọ bụla gbasara isiokwu a..." },
    french: { back: "← Retour aux Sujets", pay: "Payer via Paystack", listen: "🔊 Écouter la Leçon", complete: "Marquer comme Terminé", video: "📺 Regarder la Vidéo", ask: "Demander", placeholder: "Posez n'importe quelle question..." }
};

function updateUILanguage() {
    const lang = state.currentLanguage;
    const t = translations[lang] || translations.english;
    document.getElementById("back-to-subjects").innerText = t.back;
    document.getElementById("pay-button").innerText = t.pay;
    document.getElementById("speak-btn").innerText = t.listen;
    document.getElementById("complete-btn").innerText = t.complete;
    document.getElementById("video-btn").innerText = t.video;
    document.getElementById("quiz-btn").innerText = t.quiz;
    document.getElementById("ask-btn").innerText = t.ask;
    document.getElementById("user-question").placeholder = t.placeholder;
}

function formatContent(text) {
    let formatted = text.replace(/```(?:xml|svg|html)?\n([\s\S]*?)\n```/g, '$1');
    formatted = formatted.replace(/```[\s\S]*?```/g, "");
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/^\s*[\-\*]\s+(.*)$/gm, '<ul><li>$1</li></ul>');
    formatted = formatted.replace(/<\/ul>\s*<ul>/g, '');
    return formatted.trim().split(/(<svg[\s\S]*?<\/svg>)/g).map(part => {
        return part.startsWith('<svg') ? part : part.replace(/\n/g, '<br>');
    }).join('');
}

const state = {
    hasAccess: false,
    currentLevel: "jss1",
    currentSyllabus: "nerdc",
    currentLanguage: "english",
    currentSubject: null,
    currentTopic: null,
    currentLessonText: "",
    xp: Number(localStorage.getItem("jss1_xp")) || 0,
    level: Number(localStorage.getItem("jss1_level")) || 1,
    dailyStreak: Number(localStorage.getItem("jss1_dailyStreak")) || 0,
    lastActivityDate: localStorage.getItem("jss1_lastActivityDate") || null,
    expiryTime: Number(localStorage.getItem("jss1_expiry")) || 0,
    completedTopics: JSON.parse(localStorage.getItem("jss1_completed") || "[]")
};

// IndexedDB for offline storage
let db;
const request = indexedDB.open("DomisLinkOfflineStore", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("lessons")) db.createObjectStore("lessons", { keyPath: "id" });
    if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
};
request.onsuccess = (e) => { db = e.target.result; };

async function saveLessonLocally(id, content) {
    const tx = db.transaction("lessons", "readwrite");
    tx.objectStore("lessons").put({ id, content, timestamp: Date.now() });
}

async function getLocalLesson(id) {
    return new Promise((resolve) => {
        const tx = db.transaction("lessons", "readonly");
        const req = tx.objectStore("lessons").get(id);
        req.onsuccess = () => resolve(req.result ? req.result.content : null);
    });
}

async function requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log(`Storage persisted: ${isPersisted}`);
    }
}

async function autoSyncSyllabus() {
    try {
        const response = await fetch('syllabuses.json?cache-bust=' + Date.now());
        if (!response.ok) return;
        const newSyllabuses = await response.json();
        if (JSON.stringify(newSyllabuses) !== JSON.stringify(syllabuses)) {
            syllabuses = newSyllabuses;
            if (state.hasAccess) {
                renderSyllabus();
                if (state.currentSubject) showTopics(state.currentSubject);
                if (state.currentTopic) startTeaching(state.currentSubject, state.currentTopic);
            }
        }
    } catch (e) { console.warn("Syllabus sync failed. Working with cached version."); }
}

async function init() {
    checkDailyStreak();
    await requestPersistence();
    await autoSyncSyllabus();
    checkAccess();
    renderSyllabus();
    document.getElementById("pay-button").addEventListener("click", payWithPaystack);
    document.getElementById("ask-btn").addEventListener("click", askFollowUp);
    document.getElementById("speak-btn").addEventListener("click", speakLesson);
    document.getElementById("complete-btn").addEventListener("click", markTopicCompleted);
    document.getElementById("voice-btn").addEventListener("click", startVoiceInput);
    document.getElementById("level-toggle").addEventListener("change", (e) => {
        state.currentLevel = e.target.value;
        renderSyllabus();
    });
    document.getElementById("quiz-btn").addEventListener("click", takeQuiz);
    document.getElementById("video-btn").addEventListener("click", () => {
        const syllabusName = syllabuses[state.currentSyllabus]?.name || 'Curriculum';
        const query = `${syllabusName} ${state.currentLevel} ${state.currentSubject} ${state.currentTopic} lesson`;
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
    });
    document.getElementById("back-to-subjects").addEventListener("click", () => {
        document.getElementById("subject-container").classList.remove("hidden");
        document.getElementById("topic-container").classList.add("hidden");
    });
    document.getElementById("syllabus-toggle").addEventListener("change", (e) => {
        state.currentSyllabus = e.target.value;
        state.currentSubject = null;
        renderSyllabus();
        document.getElementById("subject-container").classList.remove("hidden");
        document.getElementById("topic-container").classList.add("hidden");
    });
    document.getElementById("language-toggle").addEventListener("change", (e) => {
        state.currentLanguage = e.target.value;
        updateUILanguage();
    });
    renderGamificationUI();
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js").then(reg => {
            reg.onupdatefound = () => {
                const installingWorker = reg.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        document.getElementById("update-banner").classList.remove("hidden");
                    }
                };
            };
        });
    }
    setInterval(autoSyncSyllabus, 3600000);
}

function getDaysFromDuration() {
    const typeSelect = document.getElementById("sub-duration-type");
    const valueInput = document.getElementById("sub-duration-value");
    if (!typeSelect || !valueInput) return 0;
    const type = typeSelect.value;
    let val = parseInt(valueInput.value) || 0;
    if (type === "days") return val;
    if (type === "weeks") return val * 7;
    if (type === "months") return val * 30;
    if (type === "term") return 90;
    return 0;
}

function checkAccess() {
    const now = Date.now();
    if (now < state.expiryTime) {
        state.hasAccess = true;
        document.getElementById("classroom").classList.remove("hidden");
        document.getElementById("paywall").classList.add("hidden");
        checkDailyStreak();
        startTimer();
    } else {
        updateUILanguage();
        state.hasAccess = false;
        document.getElementById("classroom").classList.add("hidden");
        document.getElementById("paywall").classList.remove("hidden");
        state.currentLessonText = "";
        document.getElementById("ai-output").innerHTML = "<p>Access expired. Please subscribe to continue.</p>";
        checkDailyStreak();
    }
}

function startTimer() {
    const timerEl = document.getElementById("access-timer");
    const update = () => {
        const remaining = state.expiryTime - Date.now();
        if (remaining <= 0) {
            checkAccess();
            return;
        }
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remaining % (1000 * 60)) / 1000);
        timerEl.innerText = `Access: ${days}d ${hours}h ${mins}m ${secs}s`;
        requestAnimationFrame(update);
    };
    update();
}

function renderSyllabus() {
    if (!syllabuses[state.currentLevel]) {
        document.getElementById("subject-list").innerHTML = "<p>Syllabus data for this level is being synced...</p>";
        return;
    }
    const list = document.getElementById("subject-list");
    list.innerHTML = "";
    const levelData = syllabuses[state.currentLevel][state.currentSyllabus];
    if (!levelData || !levelData.subjects) {
        document.getElementById("subject-list").innerHTML = "<p>No subjects found for this syllabus.</p>";
        return;
    }
    const subjects = Object.keys(levelData.subjects);
    subjects.forEach(subject => {
        // Original topic button
        const btn = document.createElement("button");
        btn.innerText = subject;
        btn.className = "btn-subject";
        btn.onclick = () => { showTopics(subject); fetchSubjectTrivia(subject); };
        list.appendChild(btn);
        // NEW: Textbook button
        const textbookBtn = document.createElement("button");
        textbookBtn.innerText = `📘 ${subject}`;
        textbookBtn.className = "btn-subject";
        textbookBtn.onclick = () => {
            if (typeof openTextbookForSubject === 'function') {
                openTextbookForSubject(state.currentLevel, state.currentSyllabus, subject);
            } else {
                alert("Textbook feature loading...");
            }
        };
        list.appendChild(textbookBtn);
    });
}

async function callGemini(prompt, provider = 'deepseek') {
    const response = await fetch(`/api/llm?provider=${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
    const data = await response.json();
    if (!data.candidates || !data.candidates[0]) throw new Error("No response from LLM");
    return data.candidates[0].content.parts[0].text;
}


async function fetchSubjectTrivia(subject) {
    const triviaEl = document.getElementById("subject-trivia");
    triviaEl.classList.add("hidden");
    try {
        const prompt = `Provide one short, amazing fun fact or trivia about ${subject} in a Nigerian context for a ${state.currentLevel.toUpperCase()} student. Keep it under 30 words. Language: ${state.currentLanguage}`;
        const text = await await callGemini(prompt);
        triviaEl.innerHTML = `<strong>Empire Trivia:</strong> ${text}`;
        triviaEl.classList.remove("hidden");
    } catch (e) { console.warn("Trivia failed", e); }
}

async function fetchTopicTrivia(subject, topic) {
    const triviaEl = document.getElementById("topic-trivia");
    triviaEl.classList.add("hidden");
    try {
        const prompt = `Provide one mind-blowing, short fun fact about the specific topic "${topic}" in "${subject}" for a ${state.currentLevel.toUpperCase()} student. Use ${state.currentLanguage}. Keep it under 25 words.`;
        const text = await await callGemini(prompt);
        triviaEl.innerHTML = `<strong>Topic Trivia:</strong> ${text}`;
        triviaEl.classList.remove("hidden");
    } catch (e) { console.warn("Topic trivia failed", e); }
}

function showTopics(subject) {
    state.currentSubject = subject;
    document.getElementById("subject-trivia").classList.add("hidden");
    document.getElementById("topic-trivia").classList.add("hidden");
    document.getElementById("follow-up-container").classList.add("hidden");
    document.getElementById("lesson-header").classList.add("hidden");
    document.getElementById("quiz-container").classList.add("hidden");
    document.getElementById("subject-container").classList.add("hidden");
    document.getElementById("topic-container").classList.remove("hidden");
    document.getElementById("current-subject-title").innerText = subject;

    const list = document.getElementById("topic-list");
    list.innerHTML = "";
    const levelData = syllabuses[state.currentLevel]?.[state.currentSyllabus];
    if (!levelData || !levelData.subjects || !levelData.subjects[subject]) {
        list.innerHTML = "<p>No topics found for this subject.</p>";
        return;
    }
    const topics = levelData.subjects[subject];
    topics.forEach(topic => {
        const btn = document.createElement("button");
        btn.innerText = topic;
        const isCompleted = state.completedTopics.includes(`${state.currentSyllabus}-${state.currentSubject}-${topic}`);
        btn.className = `btn-topic ${isCompleted ? 'completed' : ''}`;
        btn.onclick = () => startTeaching(subject, topic);
        list.appendChild(btn);
    });
}

async function startTeaching(subject, topic) {
    const topicId = `${state.currentSyllabus}-${subject}-${topic}-${state.currentLanguage}`;
    if (Date.now() >= state.expiryTime) {
        checkAccess();
        return;
    }
    fetchTopicTrivia(subject, topic);
    const cachedLesson = await getLocalLesson(topicId);
    if (cachedLesson && !navigator.onLine) {
        renderLessonToUI(subject, topic, cachedLesson);
        return;
    }
    state.currentTopic = topic;
    const output = document.getElementById("ai-output");
    const followUp = document.getElementById("follow-up-container");
    const lessonHeader = document.getElementById("lesson-header");
    const quizBox = document.getElementById("quiz-container");
    const loaderContainer = document.getElementById("loader-container");
    const progressFill = document.getElementById("progress-bar-fill");
    const progressText = document.getElementById("progress-text");

    output.innerHTML = "";
    loaderContainer.classList.remove("hidden");
    followUp.classList.add("hidden");
    lessonHeader.classList.add("hidden");
    quizBox.classList.add("hidden");
    document.getElementById("follow-up-result").innerHTML = "";

    progressFill.style.width = "0%";
    progressText.innerText = "0%";
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
        }
        progressFill.style.width = `${progress}%`;
        progressText.innerText = `${progress}%`;
    }, 150);

    try {
        const levelData = syllabuses[state.currentLevel]?.[state.currentSyllabus];
        const syllabusName = levelData?.name || "Nigerian Curriculum";
        const langInstruction = state.currentLanguage === "english" ? "in simple English" : `in ${state.currentLanguage}`;
        const prompt = `You are a world-class ${state.currentLevel.toUpperCase()} teacher in Nigeria. Teach a detailed and interactive lesson on the topic "${topic}" in the subject "${subject}" based on the ${syllabusName} syllabus, ${langInstruction}. Include: 1. An Animated SVG illustration. 2. A "Fun Fact" trivia snippet. 3. Examples. 4. 3 practice questions.`;
        const lessonText = await await callGemini(prompt);
        await new Promise(resolve => setTimeout(resolve, 200));
        clearInterval(interval);
        progressFill.style.width = "100%";
        progressText.innerText = "100%";
        await new Promise(resolve => setTimeout(resolve, 300));
        state.currentLessonText = lessonText;
        await saveLessonLocally(topicId, lessonText);
        renderLessonToUI(subject, topic, lessonText);
    } catch (e) {
        clearInterval(interval);
        loaderContainer.classList.add("hidden");
        if (cachedLesson) {
            renderLessonToUI(subject, topic, cachedLesson);
        } else {
            output.innerHTML = "<p>You are offline and this lesson hasn't been downloaded yet. Please connect to internet once to load it.</p>";
        }
    } finally {
        loaderContainer.classList.add("hidden");
    }
}

async function takeQuiz() {
    const quizBox = document.getElementById("quiz-container");
    quizBox.innerHTML = "<p>Generating Empire Quiz... 📝</p>";
    quizBox.classList.remove("hidden");
    try {
        const prompt = `Generate a 3-question multiple-choice quiz about ${state.currentTopic} for ${state.currentLevel.toUpperCase()} students in ${state.currentLanguage}. Return ONLY valid JSON in this format: [{"q": "Question", "o": ["Opt1", "Opt2", "Opt3", "Opt4"], "a": 0}] where 'a' is the index of correct option.`;
        const responseText = await await callGemini(prompt);
        const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "");
        const questions = JSON.parse(cleanJson);
        renderQuiz(questions);
    } catch (e) {
        quizBox.innerHTML = "<p>Oops! The quiz machine is resting. Try again in a moment.</p>";
    }
}

function renderQuiz(questions) {
    const quizBox = document.getElementById("quiz-container");
    quizBox.innerHTML = "<h3>Empire Knowledge Check</h3>";
    questions.forEach((item, qIndex) => {
        const qDiv = document.createElement("div");
        qDiv.innerHTML = `<p><strong>Q${qIndex+1}: ${item.q}</strong></p>`;
        item.o.forEach((opt, oIndex) => {
            const btn = document.createElement("button");
            btn.className = "quiz-option";
            btn.innerText = opt;
            btn.onclick = () => {
                if (oIndex === item.a) {
                    btn.style.background = "#d4edda";
                    btn.disabled = true;
                    state.xp += XP_PER_QUIZ_RIGHT;
                    localStorage.setItem("jss1_xp", state.xp);
                    renderGamificationUI();
                    alert("Correct! +20 XP 👑");
                } else {
                    btn.style.background = "#f8d7da";
                    alert("Not quite! Try another one.");
                }
            };
            qDiv.appendChild(btn);
        });
        quizBox.appendChild(qDiv);
    });
}

function renderLessonToUI(subject, topic, text) {
    const output = document.getElementById("ai-output");
    const loader = document.getElementById("loader-container");
    loader.classList.add("hidden");
    output.innerHTML = `<h3>${subject} Lesson</h3><div class="lesson-content">${formatContent(text)}</div>`;
    document.getElementById("follow-up-container").classList.remove("hidden");
    document.getElementById("lesson-header").classList.remove("hidden");
}

function calculateLevel(xp) {
    return Math.floor(xp / 500) + 1;
}

function markTopicCompleted() {
    const topicId = `${state.currentSyllabus}-${state.currentSubject}-${state.currentTopic}`;
    if (!state.completedTopics.includes(topicId)) {
        state.xp += XP_PER_TOPIC;
        localStorage.setItem("jss1_xp", state.xp);
        const newLevel = calculateLevel(state.xp);
        if (newLevel > state.level) {
            state.level = newLevel;
            localStorage.setItem("jss1_level", state.level);
            alert(`Congratulations! You've reached Level ${state.level}!`);
        }
        renderGamificationUI();
        checkDailyStreak(true);
        state.completedTopics.push(topicId);
        localStorage.setItem("jss1_completed", JSON.stringify(state.completedTopics));
        alert("Topic marked as completed!");
        showTopics(state.currentSubject);
    }
}

function checkDailyStreak(activityTriggered = false) {
    const today = new Date().toISOString().slice(0, 10);
    const lastActivity = state.lastActivityDate;
    if (lastActivity === today) return;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (lastActivity === yesterday) {
        state.dailyStreak++;
    } else if (lastActivity === null || lastActivity < yesterday) {
        state.dailyStreak = 1;
    }
    state.lastActivityDate = today;
    localStorage.setItem("jss1_dailyStreak", state.dailyStreak);
    localStorage.setItem("jss1_lastActivityDate", state.lastActivityDate);
    renderGamificationUI();
}

function renderGamificationUI() {
    document.getElementById("xp-display").innerText = `XP: ${state.xp}`;
    document.getElementById("level-display").innerText = `Level: ${state.level}`;
    document.getElementById("streak-display").innerText = `Streak: ${state.dailyStreak} 🔥`;
}

const langCodes = {
    english: 'en-NG',
    pidgin: 'en-NG',
    yoruba: 'yo-NG',
    hausa: 'ha-NG',
    igbo: 'ig-NG',
    french: 'fr-FR'
};

function speakLesson() {
    if ('speechSynthesis' in window && state.currentLessonText) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(state.currentLessonText);
        utterance.lang = langCodes[state.currentLanguage] || 'en-NG';
        window.speechSynthesis.speak(utterance);
    }
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Voice recognition is not supported in this browser.");
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = langCodes[state.currentLanguage] || 'en-NG';
    recognition.start();
    const voiceBtn = document.getElementById("voice-btn");
    voiceBtn.innerText = "🛑";
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById("user-question").value = transcript;
    };
    recognition.onend = () => {
        voiceBtn.innerText = "🎤";
    };
}

async function askFollowUp() {
    if (Date.now() >= state.expiryTime) {
        checkAccess();
        return;
    }
    const questionInput = document.getElementById("user-question");
    const resultBox = document.getElementById("follow-up-result");
    const question = questionInput.value.trim();
    if (!question) return;
    resultBox.innerHTML = "Thinking...";
    questionInput.value = "";
    try {
        const langInstruction = state.currentLanguage === "english" ? "in English" : `in ${state.currentLanguage}`;
        const prompt = `I am a ${state.currentLevel.toUpperCase()} student. We just discussed "${state.currentTopic}" in "${state.currentSubject}". I have a follow-up question: "${question}". Please answer simply and clearly ${langInstruction}.`;
        const answer = await await callGemini(prompt);
        resultBox.innerHTML = `<strong>You asked:</strong> ${question}<br><br><strong>Teacher:</strong> ${formatContent(answer)}`;
    } catch (e) {
        resultBox.innerHTML = "Sorry, I couldn't answer that right now. Please try again.";
    }
}

function payWithPaystack() {
    const email = document.getElementById("sub-email").value;
    const days = getDaysFromDuration();
    const totalAmount = days * PRICE_PER_DAY;
    if (!PAYSTACK_PUBLIC_KEY || PAYSTACK_PUBLIC_KEY.includes("YOUR_")) {
        alert("Paystack is not configured. Please contact DomisLink support.");
        return;
    }
    if (!email || !email.includes('@')) {
        alert("Please enter a valid email address to receive your receipt.");
        return;
    }
    if (days <= 0) {
        alert("Please select a valid duration.");
        return;
    }
    const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: totalAmount * 100,
        currency: "NGN",
        callback: function(response) {
            alert("Payment successful! Verifying access...");
            const expiry = Date.now() + (days * 24 * 60 * 60 * 1000);
            localStorage.setItem("jss1_expiry", expiry);
            state.expiryTime = expiry;
            alert(`Access granted for ${days} day(s).`);
            checkAccess();
        },
        onClose: function() {
            alert("Payment cancelled.");
        }
    });
    handler.openIframe();
}

window.onload = init;




function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    if (viewId === 'syllabus-view' && typeof renderSyllabus === 'function') {
        renderSyllabus();
    }
}
