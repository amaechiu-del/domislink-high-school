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
    if (viewId === 'syllabus-view') renderSyllabus();
}

function renderSyllabus() {
    var list = document.getElementById('subject-list');
    if (!list) return;
    list.innerHTML = '';
    var level = (document.getElementById('level-toggle')||{}).value || 'jss1';
    var syllabus = (document.getElementById('syllabus-toggle')||{}).value || 'waec';
    window.state.currentLevel = level;
    window.state.currentSyllabus = syllabus;
    if (!window.syllabuses) { list.innerHTML = '<p>Loading...</p>'; return; }
    var obj = (window.syllabuses[level]||{})[syllabus];
    if (!obj || !obj.subjects) { list.innerHTML = '<p>No subjects. Try JSS1 + WAEC.</p>'; return; }
    Object.keys(obj.subjects).forEach(function(subject) {
        var btn = document.createElement('button');
        btn.className = 'btn-subject';
        btn.textContent = subject;
        btn.onclick = function() { showTopics(subject, obj.subjects[subject]); };
        list.appendChild(btn);
        var tb = document.createElement('button');
        tb.className = 'btn-subject';
        tb.textContent = '📘 ' + subject;
        tb.style.background = '#e8f5e9';
        tb.style.color = '#2e7d32';
        tb.onclick = function() { openTextbook(level, syllabus, subject); };
        list.appendChild(tb);
    });
}

function showTopics(subject, topics) {
    window.state.currentSubject = subject;
    switchView('topics-view');
    var title = document.getElementById('current-subject-title');
    if (title) title.textContent = subject;
    var list = document.getElementById('topics-list');
    if (!list) return;
    list.innerHTML = '';
    topics.forEach(function(topic) {
        var div = document.createElement('div');
        div.className = 'topic-item';
        div.textContent = '📖 ' + topic;
        div.onclick = function() { openLesson(topic); };
        list.appendChild(div);
    });
}

function openLesson(topic) {
    window.state.currentTopic = topic;
    switchView('lesson-view');
    var title = document.getElementById('lesson-title');
    if (title) title.textContent = topic;
    var content = document.getElementById('lesson-content');
    if (!content) return;
    content.innerHTML = '<p>📥 Loading...</p>';
    
    // Show lesson content directly (no fetch needed for now)
    var level = window.state.currentLevel;
    var subject = window.state.currentSubject;
    content.innerHTML = '<div style="padding:16px;color:#222;background:#fff;line-height:1.8;font-size:1.05rem;">' +
        '<h2 style="color:#2c3e50;">' + topic + '</h2>' +
        '<p style="color:#555;">📚 <strong>Subject:</strong> ' + subject + ' | <strong>Level:</strong> ' + level.toUpperCase() + '</p>' +
        '<hr style="border:1px solid #eee;">' +
        '<h3 style="color:#4a90e2;">📖 Lesson Overview</h3>' +
        '<p>Welcome to the lesson on <strong>' + topic + '</strong>. This topic is part of the ' + subject + ' curriculum for ' + level.toUpperCase() + ' students.</p>' +
        '<h3 style="color:#4a90e2;">🎯 Learning Objectives</h3>' +
        '<ul><li>Understand the key concepts of ' + topic + '</li><li>Apply knowledge to solve problems</li><li>Prepare for exams with confidence</li></ul>' +
        '<h3 style="color:#4a90e2;">📝 Key Points</h3>' +
        '<p>Study this topic carefully. Take notes and practice regularly. Use the <strong>🔊 Listen</strong> button to hear this lesson, <strong>📺 Video</strong> for visual learning, and <strong>📝 Quiz</strong> to test yourself.</p>' +
        '<p style="text-align:center;margin-top:20px;color:#888;">✨ More detailed lessons coming soon!</p>' +
        '</div>';
}

function speakLesson() {
    var content = document.getElementById('lesson-content');
    if (!content || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var text = (content.innerText || '').substring(0, 3000);
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-NG';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
}

function watchVideo() {
    var q = (window.state.currentTopic||'') + ' ' + (window.state.currentSubject||'') + ' JSS1';
    window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank');
}

function takeQuiz() {
    var box = document.getElementById('quiz-container');
    if (!box) return;
    box.classList.remove('hidden');
    box.innerHTML = '<p>📝 Quiz loading...</p>';
    fetch('/quizzes.json').then(function(r) { return r.json(); }).then(function(data) {
        var id = (window.state.currentLevel||'') + '_' + (window.state.currentSyllabus||'') + '_' + (window.state.currentSubject||'') + '_' + (window.state.currentTopic||'');
        id = id.toLowerCase().replace(/[^a-z0-9]/g, '_');
        var quiz = data[id];
        if (!quiz || !quiz.length) { box.innerHTML = '<p>No quiz for this topic yet.</p>'; return; }
        var html = '<h3>📝 Quiz</h3>';
        quiz.forEach(function(q, i) {
            html += '<div style="margin:12px 0;padding:12px;background:#f9f9f9;border-radius:8px;">';
            html += '<p><strong>' + (i+1) + '. ' + q.question + '</strong></p>';
            q.options.forEach(function(opt, j) {
                html += '<button class="qbtn" data-q="'+i+'" data-a="'+j+'" style="display:block;width:100%;margin:4px 0;padding:8px;border:1px solid #ddd;border-radius:6px;background:white;cursor:pointer;text-align:left;">' + opt + '</button>';
            });
            html += '<p id="fb-'+i+'" style="font-weight:bold;margin-top:4px;"></p></div>';
        });
        box.innerHTML = html;
        document.querySelectorAll('.qbtn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var qi = +this.getAttribute('data-q');
                var ai = +this.getAttribute('data-a');
                var fb = document.getElementById('fb-'+qi);
                if (ai === quiz[qi].answerIndex) { fb.textContent = '✅ Correct!'; fb.style.color = '#27ae60'; }
                else { fb.textContent = '❌ Answer: ' + quiz[qi].options[quiz[qi].answerIndex]; fb.style.color = '#e74c3c'; }
                this.parentElement.querySelectorAll('.qbtn').forEach(function(b) { b.disabled = true; b.style.opacity = '0.6'; });
                this.style.opacity = '1';
                this.style.border = '2px solid #4a90e2';
            });
        });
    }).catch(function() { box.innerHTML = '<p>Quiz unavailable.</p>'; });
}

function openTextbook(level, syllabus, subject) {
    switchView('textbook-view');
    var title = document.getElementById('textbook-title');
    if (title) title.textContent = '📖 ' + subject;
    var obj = (window.syllabuses[level]||{})[syllabus];
    if (!obj || !obj.subjects || !obj.subjects[subject]) return;
    var wrapper = document.getElementById('textbook-slides-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    obj.subjects[subject].forEach(function(topic) {
        var slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.style.cssText = 'padding:24px;background:#fff;border-radius:12px;cursor:pointer;min-height:150px;';
        slide.innerHTML = '<h3 style="color:#2c3e50;">' + topic + '</h3><p style="color:#666;">Tap to open lesson</p>';
        slide.onclick = function() { openLesson(topic); };
        wrapper.appendChild(slide);
    });
    if (typeof Swiper !== 'undefined') {
        if (window.textbookSwiper) window.textbookSwiper.destroy();
        window.textbookSwiper = new Swiper('.textbook-swiper', {
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            pagination: { el: '.swiper-pagination', clickable: true }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-item[data-view]').forEach(function(btn) {
        btn.addEventListener('click', function() { switchView(this.getAttribute('data-view')); });
    });
    var ab = document.getElementById('apply-settings-btn');
    if (ab) ab.addEventListener('click', renderSyllabus);
    var bb = document.getElementById('back-to-subjects');
    if (bb) bb.addEventListener('click', function() { switchView('syllabus-view'); });
    var bt = document.getElementById('back-to-topics');
    if (bt) bt.addEventListener('click', function() { switchView('topics-view'); });
    var pb = document.getElementById('paystack-trigger');
    if (pb) pb.addEventListener('click', function() {
        var email = prompt('Enter your email:');
        if (!email) return;
        if (typeof PaystackPop !== 'undefined') {
            PaystackPop.setup({
                key: 'pk_live_b9ce8aa36118824d41d49c09824d49161a824a5b',
                email: email, amount: 200000, currency: 'NGN',
                ref: 'D_' + Math.floor(Math.random() * 1000000000),
                callback: function(r) {
                    var s = document.getElementById('payment-status');
                    if (s) { s.textContent = '✅ Pro unlocked!'; s.style.color = '#27ae60'; }
                    localStorage.setItem('pro_unlocked', 'true');
                    localStorage.setItem('pro_email', email);
                    alert('✅ Pro features unlocked!');
                },
                onClose: function() {
                    var s = document.getElementById('payment-status');
                    if (s) { s.textContent = 'Cancelled.'; s.style.color = '#e67e22'; }
                }
            }).openIframe();
        }
    });
    document.getElementById('speak-btn').addEventListener('click', speakLesson);
    document.getElementById('video-btn').addEventListener('click', watchVideo);
    document.getElementById('quiz-btn').addEventListener('click', takeQuiz);
    if (localStorage.getItem('pro_unlocked') === 'true') {
        var s = document.getElementById('payment-status');
        if (s) s.textContent = '✅ Pro Active';
    }
    if (window.syllabuses) { renderSyllabus(); }
    else {
        fetch('syllabuses.json').then(function(r) { return r.json(); }).then(function(d) {
            window.syllabuses = d; renderSyllabus();
        }).catch(function() {
            var list = document.getElementById('subject-list');
            if (list) list.innerHTML = '<p>⚠️ Syllabus unavailable.</p>';
        });
    }
});
console.log('✅ DomisLink ready');
