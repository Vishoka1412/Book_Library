/**
 * LuminaLib Client Interactivity
 */

document.addEventListener('DOMContentLoaded', () => {
    initStarRating();
    initThemeToggle();
    initViewModeToggle();
    initToastDismiss();
});

/**
 * Initialize Star Rating Picker for Add/Edit forms
 */
function initStarRating() {
    const starPicker = document.getElementById('starRatingPicker');
    const ratingInput = document.getElementById('ratingInput');

    if (!starPicker || !ratingInput) return;

    const stars = starPicker.querySelectorAll('.star');
    const currentVal = parseInt(ratingInput.value || '0', 10);

    updateStarsDisplay(stars, currentVal);

    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.getAttribute('data-val'), 10);
            ratingInput.value = val;
            updateStarsDisplay(stars, val);
        });

        star.addEventListener('mouseover', () => {
            const val = parseInt(star.getAttribute('data-val'), 10);
            updateStarsDisplay(stars, val);
        });
    });

    starPicker.addEventListener('mouseleave', () => {
        const val = parseInt(ratingInput.value || '0', 10);
        updateStarsDisplay(stars, val);
    });
}

function updateStarsDisplay(stars, val) {
    stars.forEach(star => {
        const starVal = parseInt(star.getAttribute('data-val'), 10);
        if (starVal <= val) {
            star.classList.add('selected');
            star.innerText = '★';
        } else {
            star.classList.remove('selected');
            star.innerText = '☆';
        }
    });
}

/**
 * Initialize Theme Toggle (Light / Dark)
 */
function initThemeToggle() {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (!themeBtn) return;

    const savedTheme = localStorage.getItem('lumina_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(themeBtn, savedTheme);

    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('lumina_theme', newTheme);
        updateThemeIcon(themeBtn, newTheme);
    });
}

function updateThemeIcon(btn, theme) {
    btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
}

/**
 * Toggle Grid / List View on Dashboard
 */
function initViewModeToggle() {
    const gridBtn = document.getElementById('viewGridBtn');
    const listBtn = document.getElementById('viewListBtn');
    const gridView = document.getElementById('booksGridView');
    const listView = document.getElementById('booksListView');

    if (!gridBtn || !listBtn || !gridView || !listView) return;

    gridBtn.addEventListener('click', () => {
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        gridView.style.display = 'grid';
        listView.style.display = 'none';
        setQueryParam('view', 'grid');
    });

    listBtn.addEventListener('click', () => {
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        gridView.style.display = 'none';
        listView.style.display = 'block';
        setQueryParam('view', 'list');
    });
}

function setQueryParam(key, val) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, val);
    window.history.replaceState({}, '', url);
}

/**
 * Toast Notifications Auto Dismiss
 */
function initToastDismiss() {
    const toasts = document.querySelectorAll('.toast');
    toasts.forEach(toast => {
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.style.transition = 'all 0.4s ease';
            setTimeout(() => toast.remove(), 400);
        }, 4500);
    });
}

/**
 * Global Toast Trigger Helper
 */
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <span style="font-size: 1.2rem;">${type === 'success' ? '✅' : '⚠️'}</span>
        <div>${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}
