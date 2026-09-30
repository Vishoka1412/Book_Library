const { Pool } = require('pg');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let dbClient = null;
let isPg = false;
let sqliteDb = null;

// Default PostgreSQL Configuration
const pgConfig = {
    connectionString: process.env.DATABASE_URL || undefined,
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'book_library',
    password: process.env.PGPASSWORD || 'postgres',
    port: parseInt(process.env.PGPORT || '5432', 10),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
};

/**
 * Initialize Database Connection
 */
async function initDb() {
    // Force SQLite if specified in ENV, otherwise try PostgreSQL first
    if (process.env.DB_TYPE === 'sqlite') {
        initSqlite();
        return;
    }

    try {
        console.log('🔄 Attempting PostgreSQL connection...');
        const pool = new Pool(pgConfig);
        
        // Test connection
        const client = await pool.connect();
        client.release();
        
        dbClient = pool;
        isPg = true;
        console.log('✅ Connected to PostgreSQL database successfully!');
        
        // Run PostgreSQL Schema
        await runPgSchema(pool);
    } catch (err) {
        console.warn('⚠️  PostgreSQL connection failed:', err.message);
        console.log('💡 Falling back to SQLite local database (library.db)...');
        initSqlite();
    }
}

/**
 * Initialize SQLite Fallback Database
 */
function initSqlite() {
    const dbPath = path.join(__dirname, 'library.db');
    sqliteDb = new Database(dbPath);
    isPg = false;
    
    console.log(`✅ SQLite initialized at ${dbPath}`);
    
    // Create SQLite books table if not exists
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            isbn TEXT,
            genre TEXT DEFAULT 'General',
            description TEXT,
            cover_url TEXT,
            status TEXT DEFAULT 'Want to Read',
            rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
            review TEXT,
            notes TEXT,
            page_count INTEGER DEFAULT 0,
            date_read TEXT,
            is_favorite INTEGER DEFAULT 0,
            open_library_key TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Check if table is empty, seed initial data
    const countStmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM books');
    const { count } = countStmt.get();
    
    if (count === 0) {
        console.log('🌱 Seeding SQLite database with sample books...');
        seedSqlite();
    }
}

/**
 * Run PostgreSQL schema & seed if empty
 */
async function runPgSchema(pool) {
    try {
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(schemaSql);
        
        const countRes = await pool.query('SELECT COUNT(*) FROM books');
        if (parseInt(countRes.rows[0].count, 10) === 0) {
            console.log('🌱 Seeding PostgreSQL database with sample books...');
            const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
            await pool.query(seedSql);
        }
    } catch (e) {
        console.error('Error running PG schema/seed:', e.message);
    }
}

/**
 * Seed SQLite database
 */
function seedSqlite() {
    const seedBooks = [
        {
            title: 'Dune',
            author: 'Frank Herbert',
            isbn: '9780441172719',
            genre: 'Science Fiction',
            description: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the spice melange.',
            cover_url: 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg',
            status: 'Read',
            rating: 5,
            review: 'A masterpiece of world-building and political intrigue. The depth of ecology, religion, and philosophy woven into a sci-fi epic is unmatched.',
            notes: 'Pay attention to the Bene Gesserit prophecies and the Litany Against Fear.',
            page_count: 688,
            date_read: '2026-02-15',
            is_favorite: 1,
            open_library_key: '/works/OL893415W'
        },
        {
            title: 'Atomic Habits',
            author: 'James Clear',
            isbn: '9780735211292',
            genre: 'Self-Help',
            description: 'An easy and proven way to build good habits and break bad ones. James Clear reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results.',
            cover_url: 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg',
            status: 'Read',
            rating: 5,
            review: 'Extremely practical framework for habit building. The focus on identity-based habits rather than outcome-based goals was a game-changer.',
            notes: 'Key take-away: You do not rise to the level of your goals. You fall to the level of your systems.',
            page_count: 320,
            date_read: '2026-01-10',
            is_favorite: 1,
            open_library_key: '/works/OL17930368W'
        },
        {
            title: 'Project Hail Mary',
            author: 'Andy Weir',
            isbn: '9780593135204',
            genre: 'Science Fiction',
            description: 'Ryland Grace is the sole survivor on a desperate, last-chance mission—and if he fails, humanity and the earth itself will perish.',
            cover_url: 'https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg',
            status: 'Read',
            rating: 5,
            review: 'Pure scientific problem-solving joy! Rocky is one of the best alien companion characters in modern fiction.',
            notes: 'Fascinating depiction of interstellar physics and language learning.',
            page_count: 496,
            date_read: '2026-03-01',
            is_favorite: 1,
            open_library_key: '/works/OL21634731W'
        },
        {
            title: '1984',
            author: 'George Orwell',
            isbn: '9780451524935',
            genre: 'Dystopian',
            description: 'Winston Smith wrestles with oppression in Oceania, a place where the Party scrutinizes human actions with an ever-watchful eye.',
            cover_url: 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg',
            status: 'Read',
            rating: 4,
            review: 'Chillingly prophetic. The concepts of Newspeak and Doublethink are incredibly relevant.',
            notes: 'Rereading after several years highlights its psychological depth.',
            page_count: 328,
            date_read: '2025-11-20',
            is_favorite: 0,
            open_library_key: '/works/OL1168083W'
        },
        {
            title: 'The Hobbit',
            author: 'J.R.R. Tolkien',
            isbn: '9780547928227',
            genre: 'Fantasy',
            description: 'Bilbo Baggins is a hobbit who enjoys a comfortable, unambitious life, rarely traveling further than the pantry of his hobbit-hole in Bag End.',
            cover_url: 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg',
            status: 'Reading',
            rating: 4,
            review: 'Delightful fantasy adventure. Tolkien writes with such warmth and mythical charm.',
            notes: 'Currently at Chapter 9: Barrels Out of Bond.',
            page_count: 310,
            date_read: null,
            is_favorite: 1,
            open_library_key: '/works/OL262758W'
        },
        {
            title: 'Deep Work',
            author: 'Cal Newport',
            isbn: '9781455586691',
            genre: 'Productivity',
            description: 'Rules for focused success in a distracted world. Deep work is the ability to focus without distraction on a cognitively demanding task.',
            cover_url: 'https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg',
            status: 'Want to Read',
            rating: 0,
            review: null,
            notes: 'Recommended by colleagues for improving focus during long programming sessions.',
            page_count: 304,
            date_read: null,
            is_favorite: 0,
            open_library_key: '/works/OL17358797W'
        },
        {
            title: 'Clean Code',
            author: 'Robert C. Martin',
            isbn: '9780132350884',
            genre: 'Technology',
            description: 'Even bad code can function. But if code isn\'t clean, it can bring a development organization to its knees.',
            cover_url: 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg',
            status: 'Read',
            rating: 4,
            review: 'Essential reading for developers. Mind naming conventions, small single-responsibility functions, and meaningful comments.',
            notes: 'Refactored several backend services after reading.',
            page_count: 464,
            date_read: '2025-08-14',
            is_favorite: 0,
            open_library_key: '/works/OL15186000W'
        }
    ];

    const insertStmt = sqliteDb.prepare(`
        INSERT INTO books (title, author, isbn, genre, description, cover_url, status, rating, review, notes, page_count, date_read, is_favorite, open_library_key)
        VALUES (@title, @author, @isbn, @genre, @description, @cover_url, @status, @rating, @review, @notes, @page_count, @date_read, @is_favorite, @open_library_key)
    `);

    const insertMany = sqliteDb.transaction((books) => {
        for (const book of books) insertStmt.run(book);
    });

    insertMany(seedBooks);
}

/**
 * Unified Query interface supporting PostgreSQL syntax ($1, $2) and SQLite translation
 */
async function query(sql, params = []) {
    if (isPg && dbClient) {
        const res = await dbClient.query(sql, params);
        return res;
    } else if (sqliteDb) {
        // Convert $1, $2, $3 to ? for SQLite
        let sqliteSql = sql;
        let paramIndex = 1;
        while (sqliteSql.includes(`$${paramIndex}`)) {
            sqliteSql = sqliteSql.replace(new RegExp(`\\$${paramIndex}`, 'g'), '?');
            paramIndex++;
        }

        // Handle BOOLEAN casting if needed
        sqliteSql = sqliteSql.replace(/TRUE/gi, '1').replace(/FALSE/gi, '0');

        const trimmed = sqliteSql.trim().toUpperCase();

        if (trimmed.startsWith('SELECT')) {
            const stmt = sqliteDb.prepare(sqliteSql);
            const rows = stmt.all(...params);
            // Ensure boolean conversion for is_favorite
            const formattedRows = rows.map(r => ({
                ...r,
                is_favorite: Boolean(r.is_favorite)
            }));
            return { rows: formattedRows, rowCount: formattedRows.length };
        } else if (trimmed.startsWith('INSERT')) {
            const stmt = sqliteDb.prepare(sqliteSql);
            const info = stmt.run(...params);
            return { rows: [{ id: info.lastInsertRowid }], rowCount: info.changes };
        } else {
            const stmt = sqliteDb.prepare(sqliteSql);
            const info = stmt.run(...params);
            return { rows: [], rowCount: info.changes };
        }
    } else {
        throw new Error('Database not initialized');
    }
}

module.exports = {
    initDb,
    query,
    isPostgres: () => isPg
};
