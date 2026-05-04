(function() {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.shiftKey && e.key === 'J') ||
            (e.ctrlKey && e.key === 'U') ||
            (e.ctrlKey && e.key === 'S')) {
            e.preventDefault();
            alert('Developer tools are disabled on this site. Please respect our content.');
            return false;
        }
    });
    const STORAGE_KEYS = ['jss1_expiry', 'jss1_completed', 'jss1_xp'];
    const originalValues = {};
    STORAGE_KEYS.forEach(key => {
        originalValues[key] = localStorage.getItem(key);
    });
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        if (STORAGE_KEYS.includes(key)) {
            console.warn(`Security: localStorage key "${key}" was modified.`);
        }
        originalSetItem.apply(this, arguments);
    };
    setInterval(() => {
        STORAGE_KEYS.forEach(key => {
            const current = localStorage.getItem(key);
            if (current !== originalValues[key]) {
                console.warn(`Security: localStorage key "${key}" changed from ${originalValues[key]} to ${current}`);
                originalValues[key] = current;
            }
        });
    }, 5000);
})();
