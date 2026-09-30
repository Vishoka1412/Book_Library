const express = require('express');
const router = express.Router();
const db = require('../db');
const openLibrary = require('../services/openLibrary');
const { body, validationResult } = require('express-validator');

/**
 * GET / - Main Library Dashboard
 */
router.get('/', async (req, res, next) => {
    try {
        const { status, genre, search, sort = 'created_at', order = 'DESC', view = 'grid' } = req.query;

        let querySql = 'SELECT * FROM books WHERE 1=1';
        const params = [];
        let paramCount = 1;

        // Status Filter
        if (status && status !== 'All') {
            querySql += ` AND status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        // Genre Filter
        if (genre && genre !== 'All') {
            querySql += ` AND genre = $${paramCount}`;
            params.push(genre);
            paramCount++;
        }

        // Search Filter (Title, Author, ISBN)
        if (search && search.trim() !== '') {
            querySql += ` AND (LOWER(title) LIKE $${paramCount} OR LOWER(author) LIKE $${paramCount} OR isbn LIKE $${paramCount})`;
            params.push(`%${search.trim().toLowerCase()}%`);
            paramCount++;
        }

        // Sorting
        const allowedSortFields = ['title', 'author', 'rating', 'created_at', 'page_count', 'date_read'];
        const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        querySql += ` ORDER BY ${sortField} ${sortOrder}`;

        const result = await db.query(querySql, params);
        const books = result.rows;

        // Fetch genres for filter dropdown
        const genresRes = await db.query('SELECT DISTINCT genre FROM books WHERE genre IS NOT NULL AND genre != \'\' ORDER BY genre ASC');
        const genres = genresRes.rows.map(r => r.genre);

        // Fetch Metrics & Statistics
        const statsRes = await db.query(`
            SELECT 
                COUNT(*) as total_books,
                COUNT(CASE WHEN status = 'Read' THEN 1 END) as read_count,
                COUNT(CASE WHEN status = 'Reading' THEN 1 END) as reading_count,
                COUNT(CASE WHEN status = 'Want to Read' THEN 1 END) as want_count,
                COUNT(CASE WHEN is_favorite = TRUE OR is_favorite = 1 THEN 1 END) as favorite_count,
                COALESCE(SUM(CASE WHEN status = 'Read' THEN page_count ELSE 0 END), 0) as total_pages_read,
                COALESCE(ROUND(AVG(CASE WHEN rating > 0 THEN rating END), 1), 0) as avg_rating
            FROM books
        `);
        const stats = statsRes.rows[0];

        res.render('index', {
            title: 'LuminaLib | Personal Book Library',
            books,
            genres,
            stats,
            currentStatus: status || 'All',
            currentGenre: genre || 'All',
            search: search || '',
            sort: sortField,
            order: sortOrder,
            viewMode: view,
            isPostgres: db.isPostgres(),
            messages: req.query.msg ? [req.query.msg] : []
        });
    } catch (err) {
        console.error('Error fetching dashboard books:', err);
        next(err);
    }
});

/**
 * GET /books/add - Render Add Book Form
 */
router.get('/books/add', async (req, res) => {
    res.render('book-form', {
        title: 'Add New Book | LuminaLib',
        book: {
            title: req.query.title || '',
            author: req.query.author || '',
            isbn: req.query.isbn || '',
            genre: req.query.genre || 'General',
            description: req.query.description || '',
            cover_url: req.query.cover_url || '',
            status: 'Want to Read',
            rating: 0,
            review: '',
            notes: '',
            page_count: req.query.page_count || 0,
            date_read: '',
            is_favorite: false,
            open_library_key: req.query.key || ''
        },
        isEdit: false,
        errors: []
    });
});

/**
 * POST /books - Add New Book with Validation
 */
router.post('/books', [
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('author').trim().notEmpty().withMessage('Author name is required.'),
    body('rating').optional().isInt({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5.')
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('book-form', {
            title: 'Add New Book | LuminaLib',
            book: req.body,
            isEdit: false,
            errors: errors.array().map(e => e.msg)
        });
    }

    try {
        const {
            title, author, isbn, genre, description, cover_url,
            status, rating, review, notes, page_count, date_read, is_favorite, open_library_key
        } = req.body;

        // Auto Cover image resolution if missing
        let finalCoverUrl = cover_url ? cover_url.trim() : '';
        if (!finalCoverUrl && isbn) {
            finalCoverUrl = `https://covers.openlibrary.org/b/isbn/${isbn.trim()}-L.jpg`;
        }

        const sql = `
            INSERT INTO books (
                title, author, isbn, genre, description, cover_url,
                status, rating, review, notes, page_count, date_read, is_favorite, open_library_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id
        `;

        const params = [
            title.trim(),
            author.trim(),
            isbn ? isbn.trim() : null,
            genre ? genre.trim() : 'General',
            description ? description.trim() : null,
            finalCoverUrl || null,
            status || 'Want to Read',
            parseInt(rating || '0', 10),
            review ? review.trim() : null,
            notes ? notes.trim() : null,
            parseInt(page_count || '0', 10),
            date_read ? date_read : null,
            is_favorite === 'on' || is_favorite === 'true' || is_favorite === true ? 1 : 0,
            open_library_key ? open_library_key.trim() : null
        ];

        const result = await db.query(sql, params);
        const newId = result.rows[0]?.id;

        res.redirect(`/?msg=Book "${encodeURIComponent(title)}" successfully added to your library!`);
    } catch (err) {
        console.error('Error adding book:', err);
        res.render('book-form', {
            title: 'Add New Book | LuminaLib',
            book: req.body,
            isEdit: false,
            errors: [`Database Error: ${err.message}`]
        });
    }
});

/**
 * GET /books/open-library - Open Library Explorer page
 */
router.get('/books/open-library', (req, res) => {
    res.render('open-library', {
        title: 'Explore Open Library | LuminaLib',
        query: req.query.q || ''
    });
});

/**
 * GET /books/:id - View Book Detail Page
 */
router.get('/books/:id', async (req, res, next) => {
    try {
        const bookId = req.params.id;
        const result = await db.query('SELECT * FROM books WHERE id = $1', [bookId]);

        if (result.rows.length === 0) {
            return res.status(404).render('404', { title: 'Book Not Found | LuminaLib', message: 'The requested book could not be found in your library.' });
        }

        const book = result.rows[0];

        // Format dates
        if (book.date_read) {
            book.formatted_date_read = new Date(book.date_read).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        if (book.created_at) {
            book.formatted_created_at = new Date(book.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }

        res.render('book-detail', {
            title: `${book.title} by ${book.author} | LuminaLib`,
            book
        });
    } catch (err) {
        console.error('Error fetching book details:', err);
        next(err);
    }
});

/**
 * GET /books/:id/edit - Render Edit Book Form
 */
router.get('/books/:id/edit', async (req, res, next) => {
    try {
        const bookId = req.params.id;
        const result = await db.query('SELECT * FROM books WHERE id = $1', [bookId]);

        if (result.rows.length === 0) {
            return res.status(404).render('404', { title: 'Book Not Found', message: 'Book not found' });
        }

        const book = result.rows[0];
        // Format date_read for HTML date input YYYY-MM-DD
        if (book.date_read) {
            book.date_read = new Date(book.date_read).toISOString().split('T')[0];
        }

        res.render('book-form', {
            title: `Edit ${book.title} | LuminaLib`,
            book,
            isEdit: true,
            errors: []
        });
    } catch (err) {
        console.error('Error rendering edit book form:', err);
        next(err);
    }
});

/**
 * PUT /books/:id - Update Book Record
 */
router.put('/books/:id', [
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('author').trim().notEmpty().withMessage('Author name is required.'),
    body('rating').optional().isInt({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5.')
], async (req, res) => {
    const bookId = req.params.id;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('book-form', {
            title: `Edit Book | LuminaLib`,
            book: { ...req.body, id: bookId },
            isEdit: true,
            errors: errors.array().map(e => e.msg)
        });
    }

    try {
        const {
            title, author, isbn, genre, description, cover_url,
            status, rating, review, notes, page_count, date_read, is_favorite, open_library_key
        } = req.body;

        const sql = `
            UPDATE books SET 
                title = $1, author = $2, isbn = $3, genre = $4, description = $5,
                cover_url = $6, status = $7, rating = $8, review = $9, notes = $10,
                page_count = $11, date_read = $12, is_favorite = $13, open_library_key = $14,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $15
        `;

        const params = [
            title.trim(),
            author.trim(),
            isbn ? isbn.trim() : null,
            genre ? genre.trim() : 'General',
            description ? description.trim() : null,
            cover_url ? cover_url.trim() : null,
            status || 'Want to Read',
            parseInt(rating || '0', 10),
            review ? review.trim() : null,
            notes ? notes.trim() : null,
            parseInt(page_count || '0', 10),
            date_read ? date_read : null,
            is_favorite === 'on' || is_favorite === 'true' || is_favorite === true ? 1 : 0,
            open_library_key ? open_library_key.trim() : null,
            bookId
        ];

        await db.query(sql, params);

        res.redirect(`/books/${bookId}?msg=Book updated successfully!`);
    } catch (err) {
        console.error('Error updating book:', err);
        res.render('book-form', {
            title: `Edit Book | LuminaLib`,
            book: { ...req.body, id: bookId },
            isEdit: true,
            errors: [`Database Error: ${err.message}`]
        });
    }
});

/**
 * DELETE /books/:id - Delete Book Record
 */
router.delete('/books/:id', async (req, res, next) => {
    try {
        const bookId = req.params.id;
        await db.query('DELETE FROM books WHERE id = $1', [bookId]);
        res.redirect('/?msg=Book deleted from your collection.');
    } catch (err) {
        console.error('Error deleting book:', err);
        next(err);
    }
});

/**
 * POST /books/:id/favorite - Toggle Favorite Status
 */
router.post('/books/:id/favorite', async (req, res) => {
    try {
        const bookId = req.params.id;
        const current = await db.query('SELECT is_favorite FROM books WHERE id = $1', [bookId]);
        if (current.rows.length > 0) {
            const newFav = current.rows[0].is_favorite ? 0 : 1;
            await db.query('UPDATE books SET is_favorite = $1 WHERE id = $2', [newFav, bookId]);
        }
        res.redirect('back');
    } catch (err) {
        console.error('Error toggling favorite:', err);
        res.redirect('back');
    }
});

/**
 * POST /books/:id/enrich - Fetch and Enrich book metadata from Open Library API
 */
router.post('/books/:id/enrich', async (req, res) => {
    try {
        const bookId = req.params.id;
        const result = await db.query('SELECT * FROM books WHERE id = $1', [bookId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }

        const book = result.rows[0];
        let fetchedData = null;

        if (book.isbn) {
            fetchedData = await openLibrary.getBookByIsbn(book.isbn);
        }

        if (!fetchedData && (book.title || book.author)) {
            const searchResults = await openLibrary.searchBooks(`${book.title} ${book.author}`, 1);
            if (searchResults.length > 0) {
                const doc = searchResults[0];
                fetchedData = {
                    title: doc.title,
                    author: doc.author,
                    isbn: doc.isbn || book.isbn,
                    genre: doc.genre,
                    cover_url: doc.cover_url || book.cover_url,
                    page_count: doc.page_count || book.page_count
                };
            }
        }

        if (fetchedData) {
            const updateSql = `
                UPDATE books SET 
                    cover_url = COALESCE($1, cover_url),
                    genre = COALESCE($2, genre),
                    description = COALESCE($3, description),
                    page_count = CASE WHEN page_count = 0 THEN $4 ELSE page_count END,
                    isbn = COALESCE($5, isbn)
                WHERE id = $6
            `;
            await db.query(updateSql, [
                fetchedData.cover_url,
                fetchedData.genre,
                fetchedData.description,
                fetchedData.page_count,
                fetchedData.isbn,
                bookId
            ]);
            res.redirect(`/books/${bookId}?msg=Metadata successfully enriched from Open Library API!`);
        } else {
            res.redirect(`/books/${bookId}?msg=No extra metadata found on Open Library.`);
        }
    } catch (err) {
        console.error('Enrich error:', err);
        res.redirect(`/books/${req.params.id}?msg=Error enriching metadata: ${err.message}`);
    }
});

module.exports = router;
