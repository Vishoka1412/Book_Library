const express = require('express');
const router = express.Router();
const openLibrary = require('../services/openLibrary');
const db = require('../db');

/**
 * GET /api/open-library/search - Dynamic Live Search via Open Library API (Axios)
 */
router.get('/open-library/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.trim().length < 2) {
            return res.json({ success: true, results: [] });
        }

        const limit = parseInt(req.query.limit || '12', 10);
        const results = await openLibrary.searchBooks(query, limit);

        res.json({
            success: true,
            query: query,
            total: results.length,
            results: results
        });
    } catch (err) {
        console.error('API Search Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/open-library/isbn/:isbn - Fetch book details by ISBN
 */
router.get('/open-library/isbn/:isbn', async (req, res) => {
    try {
        const book = await openLibrary.getBookByIsbn(req.params.isbn);
        if (!book) {
            return res.status(404).json({ success: false, message: 'Book not found on Open Library' });
        }
        res.json({ success: true, book: book });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/books/quick-add - One-click Quick Add from Open Library search result
 */
router.post('/books/quick-add', async (req, res) => {
    try {
        const { title, author, isbn, genre, description, cover_url, page_count, key } = req.body;

        if (!title || !author) {
            return res.status(400).json({ success: false, message: 'Title and Author are required.' });
        }

        // Check if book already exists by ISBN or Title+Author
        let existingCheck = false;
        if (isbn) {
            const checkRes = await db.query('SELECT id FROM books WHERE isbn = $1', [isbn]);
            if (checkRes.rows.length > 0) existingCheck = true;
        }

        if (!existingCheck) {
            const titleCheck = await db.query('SELECT id FROM books WHERE LOWER(title) = $1 AND LOWER(author) = $2', [title.trim().toLowerCase(), author.trim().toLowerCase()]);
            if (titleCheck.rows.length > 0) existingCheck = true;
        }

        if (existingCheck) {
            return res.status(409).json({ success: false, message: 'Book is already in your library collection!' });
        }

        const sql = `
            INSERT INTO books (title, author, isbn, genre, description, cover_url, status, rating, page_count, open_library_key)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `;

        const params = [
            title.trim(),
            author.trim(),
            isbn || null,
            genre || 'General',
            description || `Imported from Open Library.`,
            cover_url || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null),
            'Want to Read',
            0,
            parseInt(page_count || '0', 10),
            key || null
        ];

        const result = await db.query(sql, params);
        const newBookId = result.rows[0]?.id;

        res.json({
            success: true,
            message: `"${title}" has been added to your library!`,
            bookId: newBookId
        });
    } catch (err) {
        console.error('Quick Add Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/stats - Library Analytics & Breakdown
 */
router.get('/stats', async (req, res) => {
    try {
        const totalRes = await db.query('SELECT COUNT(*) as count FROM books');
        const statusRes = await db.query('SELECT status, COUNT(*) as count FROM books GROUP BY status');
        const genreRes = await db.query('SELECT genre, COUNT(*) as count FROM books GROUP BY genre ORDER BY count DESC LIMIT 8');
        const ratingRes = await db.query('SELECT rating, COUNT(*) as count FROM books WHERE rating > 0 GROUP BY rating ORDER BY rating ASC');

        res.json({
            success: true,
            total: parseInt(totalRes.rows[0]?.count || '0', 10),
            byStatus: statusRes.rows,
            byGenre: genreRes.rows,
            byRating: ratingRes.rows
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/export - Export collection as JSON or CSV
 */
router.get('/export', async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const result = await db.query('SELECT * FROM books ORDER BY title ASC');
        const books = result.rows;

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="luminalib_books_export.csv"');

            const headers = ['ID', 'Title', 'Author', 'ISBN', 'Genre', 'Status', 'Rating', 'Page Count', 'Date Read', 'Is Favorite', 'Review', 'Notes'];
            let csvContent = headers.join(',') + '\n';

            books.forEach(b => {
                const row = [
                    b.id,
                    `"${(b.title || '').replace(/"/g, '""')}"`,
                    `"${(b.author || '').replace(/"/g, '""')}"`,
                    `"${b.isbn || ''}"`,
                    `"${b.genre || ''}"`,
                    `"${b.status || ''}"`,
                    b.rating || 0,
                    b.page_count || 0,
                    `"${b.date_read || ''}"`,
                    b.is_favorite ? 'Yes' : 'No',
                    `"${(b.review || '').replace(/"/g, '""')}"`,
                    `"${(b.notes || '').replace(/"/g, '""')}"`
                ];
                csvContent += row.join(',') + '\n';
            });

            return res.send(csvContent);
        }

        // Default JSON export
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="luminalib_books_export.json"');
        res.json(books);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
