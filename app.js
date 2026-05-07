window.state = {
    currentLevel: 'jss1',
    currentSyllabus: 'waec',
    currentSubject: null,
    currentTopic: null
};

function switchView(viewId) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
        views[i].classList.add('hidden');
    }
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

    var key = level + '_' + syllabus;
    var levelData = window.syllabuses[key] || window.syllabuses[level];

    if (!levelData || !levelData.subjects) {
        list.innerHTML = '<p>No subjects found for ' + key + '. Try a different level/syllabus.</p>';
        return;
    }

    var subjects = Object.keys(levelData.subjects);
    for (var i = 0; i < subjects.length; i++) {
        var subject = subjects[i];
        var btn = document.createElement('button');
        btn.className = 'btn-subject';
        btn.textContent = subject;
        btn.onclick = (function(s) {
            return function() { showTopics(s, levelData.subjects[s]); };
        })(subject);
        list.appendChild(btn);
        
        var tb = document.createElement('button');
        tb.className = 'btn-subject';
        tb.textContent = '📘 ' + subject;
        tb.style.background = '#e8f5e9';
        tb.style.color = '#2e7d32';
        tb.onclick = (function(s) {
            return function() {
                if (typeof openTextbookForSubject === 'function') {
                    openTextbookForSubject(level, syllabus, s);
                }
            };
        })(subject);
        list.appendChild(tb);
    }
}

function showTopics(subject, topics) {
    var view = document.getElementById('topics-view');
    var list = document.getElementById('topics-list');
    var title = document.getElementById('current-subject-title');
    if (!view || !list) return;
    switchView('topics-view');
    if (title) title.textContent = subject;
    list.innerHTML = '';
    for (var i = 0; i < topics.length; i++) {
        var div = document.createElement('div');
        div.style.padding = '12px';
        div.style.margin = '8px 0';
        div.style.background = '#f5f5f5';
        div.style.borderRadius = '8px';
        div.style.cursor = 'pointer';
        div.textContent = '📖 ' + topics[i];
        div.onclick = (function(t) {
            return function() { openLesson(t); };
        })(topics[i]);
        list.appendChild(div);
    }
}

function openLesson(topic) {
    var view = document.getElementById('lesson-view');
    var content = document.getElementById('lesson-content');
    var title = document.getElementById('lesson-title');
    if (!view || !content) return;
    switchView('lesson-view');
    if (title) title.textContent = topic;
    content.innerHTML = '<p>📚 Lesson on <strong>' + topic + '</strong> will load here.</p>';
}

function openTextbookForSubject(level, syllabus, subject) {
    switchView('textbook-view');
    var title = document.getElementById('textbook-title');
    if (title) title.textContent = '📖 ' + subject;
    var key = level + '_' + syllabus;
    var levelData = window.syllabuses[key] || window.syllabuses[level];
    if (!levelData || !levelData.subjects || !levelData.subjects[subject]) return;
    var wrapper = document.getElementById('textbook-slides-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    var topics = levelData.subjects[subject];
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
    var navButtons = document.querySelectorAll('.nav-item[data-view]');
    for (var i = 0; i < navButtons.length; i++) {
        navButtons[i].addEventListener('click', function() {
            switchView(this.getAttribute('data-view'));
        });
    }

    var applyBtn = document.getElementById('apply-settings-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            renderSyllabus();
        });
    }

    var backBtn = document.getElementById('back-to-subjects');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            switchView('syllabus-view');
        });
    }

    var backTopicsBtn = document.getElementById('back-to-topics');
    if (backTopicsBtn) {
        backTopicsBtn.addEventListener('click', function() {
            switchView('topics-view');
        });
    }
    
    var payBtn = document.getElementById('paystack-trigger');
    if (payBtn) {
        payBtn.addEventListener('click', function() {
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
                        if (s) s.textContent = '✅ Payment successful! Ref: ' + r.reference;
                    },
                    onClose: function() {
                        var s = document.getElementById('payment-status');
                        if (s) s.textContent = 'Payment cancelled.';
                    }
                }).openIframe();
            } else {
                alert('Payment system loading. Please refresh.');
            }
        });
    }
    
    if (window.syllabuses) {
        renderSyllabus();
    } else {
        fetch('syllabuses.json')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                window.syllabuses = data;
                renderSyllabus();
            })
            .catch(function() {
                var list = document.getElementById('subject-list');
                if (list) list.innerHTML = '<p>⚠️ Syllabus data not available.</p>';
            });
    }
});

console.log('✅ DomisLink app ready');
