/**
 * Open Library Live Search & One-Click Import Integration
 */

document.addEventListener('DOMContentLoaded', () => {
    initOpenLibraryModal();
});

function initOpenLibraryModal() {
    const modal = document.getElementById('openLibraryModal');
    const openBtn = document.getElementById('openSearchModalBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const searchInput = document.getElementById('modalSearchInput');
    const resultsContainer = document.getElementById('modalSearchResults');
    const spinner = document.getElementById('searchSpinner');

    if (!modal || !openBtn) return;

    // Open Modal
    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.add('active');
        if (searchInput) {
            searchInput.focus();
        }
    });

    // Close Modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Debounced Search Input
    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();

            if (query.length < 2) {
                resultsContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding: 2rem;">Type at least 2 characters to search Open Library...</p>';
                return;
            }

            if (spinner) spinner.style.display = 'inline-block';

            debounceTimer = setTimeout(() => {
                performOpenLibrarySearch(query, resultsContainer, spinner);
            }, 400);
        });
    }
}

async function performOpenLibrarySearch(query, container, spinner) {
    try {
        const response = await fetch(`/api/open-library/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (spinner) spinner.style.display = 'none';

        if (!data.success || !data.results || data.results.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2.5rem 1rem;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
                    <p style="color: var(--text-secondary);">No matching books found on Open Library for "${escapeHtml(query)}".</p>
                </div>
            `;
            return;
        }

        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">';

        data.results.forEach(book => {
            const coverUrl = book.cover_url || 'https://via.placeholder.com/150x220?text=No+Cover';
            const bookJson = JSON.stringify({
                title: book.title,
                author: book.author,
                isbn: book.isbn,
                genre: book.genre,
                cover_url: book.cover_url,
                page_count: book.page_count,
                key: book.key
            }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

            html += `
                <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; display: flex; gap: 1rem; align-items: flex-start;">
                    <img src="${coverUrl}" alt="${escapeHtml(book.title)}" style="width: 60px; height: 85px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-color);" onError="this.onerror=null;this.src='https://via.placeholder.com/60x85?text=No+Cover';">
                    <div style="flex: 1; min-width: 0;">
                        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(book.title)}</h4>
                        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.4rem;">${escapeHtml(book.author)}</p>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                            <span>${book.publish_year !== 'N/A' ? '📅 ' + book.publish_year : ''}</span>
                            <span style="margin-left: 0.5rem;">${book.page_count ? '📖 ' + book.page_count + ' pages' : ''}</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="quickAddBook(this, '${bookJson}')" class="btn btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;">
                                + Quick Add
                            </button>
                            <a href="/books/add?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&isbn=${encodeURIComponent(book.isbn || '')}&cover_url=${encodeURIComponent(book.cover_url || '')}&page_count=${book.page_count || 0}" class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;">
                                Custom Add
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Search error:', err);
        if (spinner) spinner.style.display = 'none';
        container.innerHTML = `<p style="color: var(--accent-rose); text-align: center; padding: 1.5rem;">Failed to fetch from Open Library API: ${err.message}</p>`;
    }
}

async function quickAddBook(btn, bookDataRaw) {
    try {
        const bookData = JSON.parse(bookDataRaw.replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
        btn.disabled = true;
        btn.innerHTML = '⏳ Adding...';

        const response = await fetch('/api/books/quick-add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookData)
        });

        const data = await response.json();

        if (data.success) {
            btn.innerHTML = '✓ Added!';
            btn.style.background = 'var(--accent-emerald)';
            btn.style.color = '#fff';
            showToast(data.message, 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1200);
        } else {
            btn.disabled = false;
            btn.innerHTML = '+ Quick Add';
            showToast(data.message || 'Could not add book', 'warning');
        }
    } catch (err) {
        console.error('Quick Add failed:', err);
        btn.disabled = false;
        btn.innerHTML = '+ Quick Add';
        showToast('Failed to add book: ' + err.message, 'warning');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
