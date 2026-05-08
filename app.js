// Save this as app.js - REPLACE EVERYTHING

window.state = {
    currentLevel: 'jss1',
    currentSyllabus: 'waec',
    currentSubject: null,
    currentTopic: null
};

// Show a view
function show(id) {
    var views = ['home-view','syllabus-view','topics-view','lesson-view','textbook-view','pro-view','settings-view'];
    for (var i=0; i<views.length; i++) {
        var v = document.getElementById(views[i]);
        if (v) v.style.display = 'none';
    }
    var t = document.getElementById(id);
    if (t) t.style.display = 'block';
    if (id === 'syllabus-view') loadSubjects();
}

// Load subjects from syllabuses.json
function loadSubjects() {
    var list = document.getElementById('subject-list');
    var level = document.getElementById('level-toggle').value;
    var syllabus = document.getElementById('syllabus-toggle').value;
    
    fetch('syllabuses.json')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var subjects = data[level][syllabus].subjects;
            var names = Object.keys(subjects);
            list.innerHTML = '';
            for (var i=0; i<names.length; i++) {
                var btn = document.createElement('button');
                btn.textContent = names[i];
                btn.style.cssText = 'display:block;width:100%;padding:14px;margin:6px 0;background:#4a90e2;color:white;border:none;border-radius:10px;font-size:16px;cursor:pointer;';
                (function(s, t) {
                    btn.onclick = function() { showTopics(s, t); };
                })(names[i], subjects[names[i]]);
                list.appendChild(btn);
            }
        })
        .catch(function() {
            list.innerHTML = '<p>Could not load subjects. Check connection.</p>';
        });
}

// Show topics for a subject
function showTopics(subject, topics) {
    window.state.currentSubject = subject;
    show('topics-view');
    document.getElementById('current-subject-title').textContent = subject;
    var list = document.getElementById('topics-list');
    list.innerHTML = '';
    for (var i=0; i<topics.length; i++) {
        var div = document.createElement('div');
        div.textContent = '📖 ' + topics[i];
        div.style.cssText = 'padding:14px;margin:6px 0;background:#f5f5f5;border-radius:8px;cursor:pointer;font-size:15px;';
        (function(t) {
            div.onclick = function() { openLesson(t); };
        })(topics[i]);
        list.appendChild(div);
    }
}

// Open a lesson
function openLesson(topic) {
    window.state.currentTopic = topic;
    show('lesson-view');
    document.getElementById('lesson-title').textContent = topic;
    document.getElementById('lesson-content').innerHTML = 
        '<div style="padding:20px;font-size:16px;line-height:1.8;color:#222;">' +
        '<h2>' + topic + '</h2>' +
        '<p><strong>Subject:</strong> ' + window.state.currentSubject + '</p>' +
        '<p><strong>Level:</strong> ' + window.state.currentLevel.toUpperCase() + '</p>' +
        '<hr>' +
        '<h3>📖 Lesson Content</h3>' +
        '<p>This is the lesson on <strong>' + topic + '</strong>. Study this topic carefully and practice with the quiz.</p>' +
        '<button onclick="speakLesson()" style="padding:10px 20px;margin:8px;background:#e67e22;color:white;border:none;border-radius:8px;cursor:pointer;">🔊 Listen</button>' +
        '<button onclick="watchVideo()" style="padding:10px 20px;margin:8px;background:#e74c3c;color:white;border:none;border-radius:8px;cursor:pointer;">📺 Video</button>' +
        '<button onclick="takeQuiz()" style="padding:10px 20px;margin:8px;background:#6f42c1;color:white;border:none;border-radius:8px;cursor:pointer;">📝 Quiz</button>' +
        '</div>';
}

function speakLesson() {
    var text = document.getElementById('lesson-content').innerText;
    var u = new SpeechSynthesisUtterance(text.substring(0, 2000));
    u.lang = 'en-NG';
    speechSynthesis.speak(u);
}

function watchVideo() {
    window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(window.state.currentTopic + ' ' + window.state.currentSubject));
}

function takeQuiz() {
    alert('Quiz coming soon for: ' + window.state.currentTopic);
}

// Nav buttons
document.addEventListener('DOMContentLoaded', function() {
    var navs = document.querySelectorAll('.nav-item[data-view]');
    for (var i=0; i<navs.length; i++) {
        navs[i].addEventListener('click', function() {
            show(this.getAttribute('data-view'));
        });
    }
    document.getElementById('apply-settings-btn').addEventListener('click', loadSubjects);
    document.getElementById('back-to-subjects').addEventListener('click', function() { show('syllabus-view'); });
    document.getElementById('back-to-topics').addEventListener('click', function() { show('topics-view'); });
    
    // Paystack
    document.getElementById('paystack-trigger').addEventListener('click', function() {
        var email = prompt('Enter email:');
        if (!email) return;
        PaystackPop.setup({
            key: 'pk_live_b9ce8aa36118824d41d49c09824d49161a824a5b',
            email: email,
            amount: 200000,
            currency: 'NGN',
            ref: 'D_' + Date.now(),
            callback: function(r) {
                alert('✅ Payment successful! Pro features unlocked.');
                localStorage.setItem('pro', 'true');
            },
            onClose: function() {
                alert('Payment cancelled.');
            }
        }).openIframe();
    });
});