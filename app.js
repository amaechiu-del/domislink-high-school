window.state = {
    currentLevel: 'jss1',
    currentSyllabus: 'waec',
    currentSubject: null,
    currentTopic: null
};

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(function(v) { v.classList.add('hidden'); });
    var target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    if (viewId === 'syllabus-view' && typeof renderSyllabus === 'function') renderSyllabus();
}

function renderSyllabus() {
    var list = document.getElementById('subject-list');
    if (!list) return;
    list.innerHTML = '';
    var levelSelect = document.getElementById('level-toggle');
    var syllabusSelect = document.getElementById('syllabus-toggle');
    var level = levelSelect ? levelSelect.value : 'jss1';
    var syllabus = syllabusSelect ? syllabusSelect.value : 'waec';
    window.state.currentLevel = level;
    window.state.currentSyllabus = syllabus;
    if (!window.syllabuses) { list.innerHTML = '<p>Loading...</p>'; return; }
    var levelObj = window.syllabuses[level];
    if (!levelObj) { list.innerHTML = '<p>Level not found.</p>'; return; }
    var syllabusObj = levelObj[syllabus];
    if (!syllabusObj || !syllabusObj.subjects) { list.innerHTML = '<p>Syllabus not found.</p>'; return; }
    var subjects = Object.keys(syllabusObj.subjects);
    for (var i = 0; i < subjects.length; i++) {
        var subject = subjects[i];
        var btn = document.createElement('button');
        btn.className = 'btn-subject';
        btn.textContent = subject;
        btn.onclick = (function(s) { return function() { showTopics(s, syllabusObj.subjects[s]); }; })(subject);
        list.appendChild(btn);
        var tb = document.createElement('button');
        tb.className = 'btn-subject';
        tb.textContent = '📘 ' + subject;
        tb.style.background = '#e8f5e9';
        tb.style.color = '#2e7d32';
        tb.onclick = (function(s) { return function() { openTextbookForSubject(level, syllabus, s); }; })(subject);
        list.appendChild(tb);
    }
}

function showTopics(subject, topics) {
    window.state.currentSubject = subject;
    var view = document.getElementById('topics-view');
    var list = document.getElementById('topics-list');
    var title = document.getElementById('current-subject-title');
    if (!view || !list) return;
    switchView('topics-view');
    if (title) title.textContent = subject;
    list.innerHTML = '';
    for (var i = 0; i < topics.length; i++) {
        var div = document.createElement('div');
        div.className = 'topic-item';
        div.textContent = '📖 ' + topics[i];
        div.onclick = (function(t) { return function() { openLesson(t); }; })(topics[i]);
        list.appendChild(div);
    }
}

function getTopicId(level, syllabus, subject, topic) {
    var s = function(str) { return (str||'').toLowerCase().replace(/[^a-z0-9]/g, '_'); };
    return s(level) + '_' + s(syllabus) + '_' + s(subject) + '_' + s(topic);
}

function openLesson(topic) {
    window.state.currentTopic = topic;
    var view = document.getElementById('lesson-view');
    var content = document.getElementById('lesson-content');
    var title = document.getElementById('lesson-title');
    if (!view || !content) return;
    switchView('lesson-view');
    if (title) title.textContent = topic;
    content.innerHTML = '<p>📥 Loading lesson...</p>';
    var id = getTopicId(window.state.currentLevel, window.state.currentSyllabus, window.state.currentSubject, topic);
    
    fetch('/lessons/' + id + '.html')
        .then(function(res) { if (!res.ok) throw new Error('Not found'); return res.text(); })
        .then(function(html) { content.innerHTML = html; })
        .catch(function() {
            content.innerHTML = '<h3>' + topic + '</h3><p>📚 Lesson loading...</p>';
        });
}

// AUDIO - Text to Speech
function speakLesson() {
    var content = document.getElementById('lesson-content');
    if (!content || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var text = content.innerText || content.textContent;
    var utterance = new SpeechSynthesisUtterance(text.substring(0, 2000));
    utterance.lang = 'en-NG';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// VIDEO - Open YouTube search
function watchVideo() {
    var query = window.state.currentTopic + ' ' + window.state.currentSubject + ' JSS1 lesson';
    window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(query), '_blank');
}

// QUIZ - Load from quizzes.json
function takeQuiz() {
    var id = getTopicId(window.state.currentLevel, window.state.currentSyllabus, window.state.currentSubject, window.state.currentTopic);
    var quizBox = document.getElementById('quiz-container');
    if (!quizBox) return;
    quizBox.classList.remove('hidden');
    quizBox.innerHTML = '<p>📝 Loading quiz...</p>';
    fetch('/quizzes.json')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var quiz = data[id];
            if (!quiz || !quiz.length) { quizBox.innerHTML = '<p>No quiz available for this topic.</p>'; return; }
            var html = '<h3>📝 Quiz: ' + window.state.currentTopic + '</h3>';
            for (var i = 0; i < quiz.length; i++) {
                var q = quiz[i];
                html += '<div style="margin:12px 0;padding:12px;background:#f9f9f9;border-radius:8px;">';
                html += '<p><strong>' + (i+1) + '. ' + q.question + '</strong></p>';
                for (var j = 0; j < q.options.length; j++) {
                    html += '<button class="quiz-option" data-q="'+i+'" data-a="'+j+'" style="display:block;width:100%;margin:4px 0;padding:8px;border:1px solid #ddd;border-radius:6px;background:white;cursor:pointer;text-align:left;">' + q.options[j] + '</button>';
                }
                html += '<p class="quiz-feedback" id="fb-'+i+'" style="font-weight:bold;margin-top:4px;"></p></div>';
            }
            quizBox.innerHTML = html;
            document.querySelectorAll('.quiz-option').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var qIdx = parseInt(this.getAttribute('data-q'));
                    var aIdx = parseInt(this.getAttribute('data-a'));
                    var fb = document.getElementById('fb-' + qIdx);
                    if (aIdx === quiz[qIdx].answerIndex) {
                        fb.textContent = '✅ Correct!';
                        fb.style.color = '#27ae60';
                    } else {
                        fb.textContent = '❌ Wrong. Correct: ' + quiz[qIdx].options[quiz[qIdx].answerIndex];
                        fb.style.color = '#e74c3c';
                    }
                    var btns = this.parentElement.querySelectorAll('.quiz-option');
                    btns.forEach(function(b) { b.disabled = true; b.style.opacity = '0.6'; });
                    this.style.opacity = '1';
                    this.style.border = '2px solid #4a90e2';
                });
            });
        })
        .catch(function() { quizBox.innerHTML = '<p>Could not load quiz.</p>'; });
}

function openTextbookForSubject(level, syllabus, subject) {
    switchView('textbook-view');
    var title = document.getElementById('textbook-title');
    if (title) title.textContent = '📖 ' + subject;
    var levelObj = window.syllabuses[level];
    if (!levelObj) return;
    var syllabusObj = levelObj[syllabus];
    if (!syllabusObj || !syllabusObj.subjects || !syllabusObj.subjects[subject]) return;
    var wrapper = document.getElementById('textbook-slides-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    var topics = syllabusObj.subjects[subject];
    for (var i = 0; i < topics.length; i++) {
        var slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = '<h3>' + topics[i] + '</h3><p>📖 Tap to open this topic</p>';
        slide.onclick = (function(t) { return function() { openLesson(t); }; })(topics[i]);
        wrapper.appendChild(slide);
    }
    if (typeof Swiper !== 'undefined') {
        if (window.textbookSwiper) window.textbookSwiper.destroy();
        window.textbookSwiper = new Swiper('.textbook-swiper', {
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            pagination: { el: '.swiper-pagination', clickable: true }
        });
    }
}

// PAYSTACK with delivery
function handlePaystack() {
    var email = prompt('Enter your email to continue:');
    if (!email) return;
    if (typeof PaystackPop !== 'undefined') {
        PaystackPop.setup({
            key: 'pk_live_b9ce8aa36118824d41d49c09824d49161a824a5b',
            email: email,
            amount: 200000,
            currency: 'NGN',
            ref: 'DOM_' + Math.floor(Math.random() * 1000000000),
            callback: function(r) {
                var s = document.getElementById('payment-status');
                if (s) { s.textContent = '✅ Payment successful! Pro features unlocked.'; s.style.color = '#27ae60'; }
                // DELIVER THE GOODS
                localStorage.setItem('pro_unlocked', 'true');
                localStorage.setItem('pro_email', email);
                localStorage.setItem('pro_ref', r.reference);
                alert('✅ Payment successful! All Pro features are now unlocked.\n\n📚 Full textbook access\n🎧 Audio lessons\n📝 Quizzes & Trivia\n📺 Video lessons');
            },
            onClose: function() {
                var s = document.getElementById('payment-status');
                if (s) { s.textContent = 'Payment cancelled.'; s.style.color = '#e67e22'; }
            }
        }).openIframe();
    } else {
        alert('Payment system loading. Please refresh.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-item[data-view]').forEach(function(btn) {
        btn.addEventListener('click', function() { switchView(this.getAttribute('data-view')); });
    });
    
    var applyBtn = document.getElementById('apply-settings-btn');
    if (applyBtn) applyBtn.addEventListener('click', renderSyllabus);
    
    var backBtn = document.getElementById('back-to-subjects');
    if (backBtn) backBtn.addEventListener('click', function() { switchView('syllabus-view'); });
    
    var backTopicsBtn = document.getElementById('back-to-topics');
    if (backTopicsBtn) backTopicsBtn.addEventListener('click', function() { switchView('topics-view'); });
    
    var payBtn = document.getElementById('paystack-trigger');
    if (payBtn) payBtn.addEventListener('click', handlePaystack);
    
    var speakBtn = document.getElementById('speak-btn');
    if (speakBtn) speakBtn.addEventListener('click', speakLesson);
    
    var videoBtn = document.getElementById('video-btn');
    if (videoBtn) videoBtn.addEventListener('click', watchVideo);
    
    var quizBtn = document.getElementById('quiz-btn');
    if (quizBtn) quizBtn.addEventListener('click', takeQuiz);
    
    // Check Pro status
    if (localStorage.getItem('pro_unlocked') === 'true') {
        var s = document.getElementById('payment-status');
        if (s) s.textContent = '✅ Pro Active — ' + localStorage.getItem('pro_email');
    }
    
    if (window.syllabuses) { renderSyllabus(); }
    else {
        fetch('syllabuses.json').then(function(r) { return r.json(); }).then(function(d) {
            window.syllabuses = d; renderSyllabus();
        }).catch(function() {
            var list = document.getElementById('subject-list');
            if (list) list.innerHTML = '<p>⚠️ Syllabus data not available.</p>';
        });
    }
});

console.log('✅ DomisLink app ready');