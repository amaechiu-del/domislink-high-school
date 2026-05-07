// ========================================
// DOMISLINK HIGH SCHOOL - CLEAN APP LOGIC
// ========================================

// Global state
window.state = {
    currentLevel: "jss1",
    currentSyllabus: "waec",
    currentSubject: null,
    currentTopic: null
};

// ========== SWITCH VIEW (Navigation) ==========
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    
    // Auto-render when Switching to Learn
    if (viewId === 'syllabus-view' && typeof renderSyllabus === 'function') {
        renderSyllabus();
    }
}

// ========== NAVIGATION: Bottom bar click handlers ==========
document.addEventListener('DOMContentLoaded', function() {
    // Set up all nav buttons
    const navButtons = document.querySelectorAll('.nav-item[data-view]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const viewId = this.getAttribute('data-view');
            switchView(viewId);
        });
    });

    // Load syllabuses if available
    if (window.syllabuses) {
        console.log('✅ Preloaded syllabuses found');
        renderSyllabus();
    } else if (typeof fetch === 'function') {
        console.log('📥 Fetching syllabuses.json...');
        fetch('syllabuses.json')
            .then(res => res.json())
            .then(data => {
                window.syllabuses = data;
                console.log('✅ syllabuses.json loaded');
                renderSyllabus();
            })
            .catch(err => {
                console.warn('⚠️ Could not fetch syllabuses.json:', err.message);
                const list = document.getElementById('subject-list');
                if (list) list.innerHTML = '<p>⚠️ Syllabus data not available. Please check your connection.</p>';
            });
    }
});

// ========== RENDER SUBJECTS ==========
function renderSyllabus() {
    const list = document.getElementById('subject-list');
    if (!list) return;
    list.innerHTML = '';

    if (!window.syllabuses || !window.state) {
        list.innerHTML = '<p>⏳ Loading syllabuses...</p>';
        return;
    }

    // Try current level/syllabus combos
    const levelData = window.syllabuses[window.state.currentLevel + '_' + window.state.currentSyllabus] 
                   || window.syllabuses[window.state.currentLevel];

    if (!levelData || !levelData.subjects) {
        list.innerHTML = '<p>No subjects found for this level. Available levels: ' 
            + Object.keys(window.syllabuses).join(', ') + '</p>';
        return;
    }

    const subjects = Object.keys(levelData.subjects);
    subjects.forEach(subject => {
        const btn = document.createElement('button');
        btn.className = 'btn-subject';
        btn.textContent = subject;
        btn.onclick = function() {
            window.state.currentSubject = subject;
            showTopics(subject, levelData.subjects[subject]);
        };
        list.appendChild(btn);

        // Textbook button
        const tb = document.createElement('button');
        tb.className = 'btn-subject';
        tb.textContent = '📘 ' + subject;
        tb.style.background = '#e8f5e9';
        tb.style.color = '#2e7d32';
        tb.onclick = function() {
            if (typeof openTextbookForSubject === 'function') {
                openTextbookForSubject(window.state.currentLevel, window.state.currentSyllabus, subject);
            } else {
                alert('Textbook coming soon!');
            }
        };
        list.appendChild(tb);
    });

    console.log('✅ Rendered', subjects.length, 'subjects');
}

// ========== SHOW TOPICS (Inside a Subject) ==========
function showTopics(subject, topics) {
    const topicsView = document.getElementById('topics-view');
    const topicsList = document.getElementById('topics-list');
    const subjectTitle = document.getElementById('current-subject-title');

    if (!topicsView || !topicsList) {
        alert('Topics view not available');
        return;
    }

    switchView('topics-view');
    if (subjectTitle) subjectTitle.textContent = subject;
    
    topicsList.innerHTML = '';
    topics.forEach(topic => {
        const div = document.createElement('div');
        div.className = 'topic-item';
        div.style.padding = '12px';
        div.style.margin = '8px 0';
        div.style.background = '#f5f5f5';
        div.style.borderRadius = '8px';
        div.style.cursor = 'pointer';
        div.innerHTML = '<span>📖 ' + topic + '</span>';
        div.onclick = function() {
            window.state.currentTopic = topic;
            openLesson(topic);
        };
        topicsList.appendChild(div);
    });
}

// ========== OPEN LESSON ==========
function openLesson(topic) {
    const lessonView = document.getElementById('lesson-view');
    const lessonContent = document.getElementById('lesson-content');
    const lessonTitle = document.getElementById('lesson-title');

    if (!lessonView || !lessonContent) {
        alert('Lesson view not available');
        return;
    }

    switchView('lesson-view');
    if (lessonTitle) lessonTitle.textContent = topic;
    lessonContent.innerHTML = '<p>📚 Lesson on <strong>' + topic + '</strong> will load here.</p>';
}

// ========== TEXTBOOK VIEW ==========
function openTextbookForSubject(level, syllabus, subject) {
    switchView('textbook-view');
    const title = document.getElementById('textbook-title');
    if (title) title.textContent = '📖 ' + subject;

    // Get topics for this subject
    const levelData = window.syllabuses[level + '_' + syllabus] || window.syllabuses[level];
    if (!levelData || !levelData.subjects || !levelData.subjects[subject]) {
        alert('No topics found for this subject.');
        return;
    }

    const topics = levelData.subjects[subject];
    const wrapper = document.getElementById('textbook-slides-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = '';
    topics.forEach(function(topic) {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = '<h3>' + topic + '</h3><p>📖 Study this topic in the full textbook.</p>';
        wrapper.appendChild(slide);
    });

    // Init or update Swiper
    if (typeof Swiper !== 'undefined') {
        if (window.textbookSwiper) window.textbookSwiper.destroy();
        window.textbookSwiper = new Swiper('.textbook-swiper', {
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev'
            },
            pagination: { el: '.swiper-pagination', clickable: true }
        });
    }
}

// ========== PAYSTACK INTEGRATION ==========
document.addEventListener('DOMContentLoaded', function() {
    const payBtn = document.getElementById('paystack-trigger');
    if (!payBtn) return;

    payBtn.addEventListener('click', function() {
        const email = prompt('Enter your email to continue:');
        if (!email) return;

        if (typeof PaystackPop !== 'undefined') {
            PaystackPop.setup({
                key: 'pk_live_b9ce8aa36118824d41d49c09824d49161a824a5b',
                email: email,
                amount: 200000,
                currency: 'NGN',
                ref: 'DOM_' + Math.floor(Math.random() * 1000000000),
                callback: function(response) {
                    const status = document.getElementById('payment-status');
                    if (status) status.textContent = '✅ Payment successful! Ref: ' + response.reference;
                },
                onClose: function() {
                    const status = document.getElementById('payment-status');
                    if (status) status.textContent = 'Payment cancelled. Try again.';
                }
            }).openIframe();
        } else {
            alert('Payment system loading... please refresh and try again.');
        }
    });
});

console.log('✅ DomisLink app ready');