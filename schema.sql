-- PostgreSQL Database Schema for LuminaLib Book Library Application

-- Drop table if exists
DROP TABLE IF EXISTS books CASCADE;

-- Create Books Table
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(20),
    genre VARCHAR(100) DEFAULT 'General',
    description TEXT,
    cover_url TEXT,
    status VARCHAR(50) DEFAULT 'Want to Read', -- Options: 'Read', 'Reading', 'Want to Read', 'DNF'
    rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    review TEXT,
    notes TEXT,
    page_count INTEGER DEFAULT 0,
    date_read DATE,
    is_favorite BOOLEAN DEFAULT FALSE,
    open_library_key VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_genre ON books(genre);
CREATE INDEX IF NOT EXISTS idx_books_rating ON books(rating);
CREATE INDEX IF NOT EXISTS idx_books_is_favorite ON books(is_favorite);
CREATE INDEX IF NOT EXISTS idx_books_title_author ON books(title, author);

-- Function and Trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_books_modtime ON books;
CREATE TRIGGER update_books_modtime
    BEFORE UPDATE ON books
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
