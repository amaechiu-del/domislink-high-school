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
    if (viewId === 'syllabus-view' && typeof renderSyllabus === 'function') {
        renderSyllabus();
    }
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
    if (!window.syllabuses) {
        list.innerHTML = '<p>Loading syllabus data...</p>';
        return;
    }
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
        tb.onclick = (function(s) { return function() { if (typeof openTextbookForSubject === 'function') openTextbookForSubject(level, syllabus, s); }; })(subject);
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
    var videoBtn = document.getElementById('video-btn');
    var speakBtn = document.getElementById('speak-btn');
    var quizBtn = document.getElementById('quiz-btn');
    if (!view || !content) return;
    switchView('lesson-view');
    if (title) title.textContent = topic;
    
    var id = getTopicId(window.state.currentLevel, window.state.currentSyllabus, window.state.currentSubject, topic);
    content.innerHTML = '<p>📥 Loading lesson...</p>';
    
    fetch('/lessons/' + id + '.html')
        .then(function(res) {
            if (!res.ok) throw new Error('Not found');
            return res.text();
        })
        .then(function(html) {
            content.innerHTML = html;
            if (speakBtn) speakBtn.style.display = 'inline-block';
            if (videoBtn) videoBtn.style.display = 'inline-block';
            if (quizBtn) quizBtn.style.display = 'inline-block';
        })
        .catch(function() {
            content.innerHTML = '<h3>' + topic + '</h3><p>📚 Lesson is being generated. Check back soon!</p><p>Topic ID: ' + id + '</p>';
            if (speakBtn) speakBtn.style.display = 'none';
            if (videoBtn) videoBtn.style.display = 'none';
            if (quizBtn) quizBtn.style.display = 'none';
        });
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
        slide.innerHTML = '<h3>' + topics[i] + '</h3><p>📖 Study this topic in the full textbook.</p>';
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
    if (payBtn) {
        payBtn.addEventListener('click', function() {
            var email = prompt('Enter your email:');
            if (!email) return;
            if (typeof PaystackPop !== 'undefined') {
                PaystackPop.setup({
                    key: 'pk_live_b9ce8aa36118824d41d49c09824d49161a824a5b',
                    email: email, amount: 200000, currency: 'NGN',
                    ref: 'DOM_' + Math.floor(Math.random() * 1000000000),
                    callback: function(r) {
                        var s = document.getElementById('payment-status');
                        if (s) s.textContent = '✅ Paid! Ref: ' + r.reference;
                        localStorage.setItem('pro_unlocked', 'true');
                    },
                    onClose: function() {
                        var s = document.getElementById('payment-status');
                        if (s) s.textContent = 'Cancelled.';
                    }
                }).openIframe();
            }
        });
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
