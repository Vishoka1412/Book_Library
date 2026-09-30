const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const booksRouter = require('./routes/books');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Register Application Routes
app.use('/', booksRouter);
app.use('/api', apiRouter);

// 404 Handler
app.use((req, res, next) => {
    res.status(404).render('404', {
        title: '404 - Page Not Found | LuminaLib',
        message: 'The page or resource you are looking for does not exist in LuminaLib.'
    });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err.stack);
    
    // Check if error comes from API request
    if (req.originalUrl.startsWith('/api')) {
        return res.status(err.status || 500).json({
            success: false,
            error: err.message || 'Internal Server Error',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }

    res.status(err.status || 500).render('404', {
        title: '500 - Server Error | LuminaLib',
        message: `An unexpected error occurred: ${err.message}`
    });
});

// Start Server and Initialize Database
async function startServer() {
    try {
        await db.initDb();
        app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`📚 LuminaLib Book Library Application running on:`);
            console.log(`👉 http://localhost:${PORT}`);
            console.log(`Database Mode: ${db.isPostgres() ? 'PostgreSQL 🐘' : 'SQLite Local 📦'}`);
            console.log(`=======================================================`);
        });
    } catch (err) {
        console.error('Fatal: Failed to start application server:', err);
        process.exit(1);
    }
}

startServer();
