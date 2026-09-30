const axios = require('axios');

// Create Axios Instance with default headers and timeout
const api = axios.create({
    baseURL: 'https://openlibrary.org',
    timeout: 8000,
    headers: {
        'User-Agent': 'LuminaLib-Book-Library-App/1.0 (contact: admin@luminalib.app)',
        'Accept': 'application/json'
    }
});

/**
 * Search books dynamically using Open Library Search API
 * @param {string} query - Search term (title, author, or ISBN)
 * @param {number} limit - Max results
 */
async function searchBooks(query, limit = 12) {
    try {
        if (!query || query.trim().length === 0) return [];

        const response = await api.get('/search.json', {
            params: {
                q: query.trim(),
                limit: limit,
                fields: 'key,title,author_name,isbn,cover_i,first_publish_year,subject,number_of_pages_median'
            }
        });

        if (!response.data || !response.data.docs) {
            return [];
        }

        return response.data.docs.map(doc => {
            const isbn = doc.isbn && doc.isbn.length > 0 ? doc.isbn[0] : null;
            const coverId = doc.cover_i || null;
            let coverUrl = null;

            if (coverId) {
                coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
            } else if (isbn) {
                coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
            }

            return {
                key: doc.key, // e.g. /works/OL12345W
                title: doc.title || 'Untitled',
                author: doc.author_name ? doc.author_name.join(', ') : 'Unknown Author',
                isbn: isbn,
                publish_year: doc.first_publish_year || 'N/A',
                page_count: doc.number_of_pages_median || 0,
                subjects: doc.subject ? doc.subject.slice(0, 5) : [],
                genre: doc.subject && doc.subject.length > 0 ? doc.subject[0] : 'General',
                cover_url: coverUrl,
                cover_id: coverId
            };
        });
    } catch (error) {
        console.error('Error fetching from Open Library Search API:', error.message);
        throw new Error(`Open Library API search failed: ${error.message}`);
    }
}

/**
 * Fetch detailed book information by ISBN using Open Library Books API
 * @param {string} isbn 
 */
async function getBookByIsbn(isbn) {
    try {
        const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
        const response = await api.get('/api/books', {
            params: {
                bibkeys: `ISBN:${cleanIsbn}`,
                format: 'json',
                jscmd: 'data'
            }
        });

        const key = `ISBN:${cleanIsbn}`;
        if (!response.data || !response.data[key]) {
            return null;
        }

        const data = response.data[key];
        let coverUrl = data.cover ? (data.cover.large || data.cover.medium || data.cover.small) : null;
        if (!coverUrl) {
            coverUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
        }

        const authors = data.authors ? data.authors.map(a => a.name).join(', ') : 'Unknown Author';
        const subjects = data.subjects ? data.subjects.map(s => s.name) : [];
        const description = typeof data.notes === 'string' ? data.notes : 
                            (data.excerpt ? data.excerpt[0]?.text : 'No description available.');

        return {
            title: data.title || 'Untitled',
            author: authors,
            isbn: cleanIsbn,
            publish_date: data.publish_date || '',
            page_count: data.number_of_pages || 0,
            genre: subjects.length > 0 ? subjects[0] : 'General',
            description: description,
            cover_url: coverUrl,
            open_library_url: data.url
        };
    } catch (error) {
        console.error('Error fetching book by ISBN from Open Library:', error.message);
        throw new Error(`Failed to fetch ISBN metadata: ${error.message}`);
    }
}

/**
 * Fetch work details by Open Library Work Key (e.g., /works/OL893415W)
 * @param {string} workKey 
 */
async function getWorkDetails(workKey) {
    try {
        const formattedKey = workKey.startsWith('/') ? workKey : `/${workKey}`;
        const response = await api.get(`${formattedKey}.json`);
        
        const data = response.data;
        let description = 'No description available.';
        
        if (typeof data.description === 'string') {
            description = data.description;
        } else if (data.description && typeof data.description.value === 'string') {
            description = data.description.value;
        }

        return {
            key: data.key,
            title: data.title,
            description: description,
            subjects: data.subjects || [],
            covers: data.covers || []
        };
    } catch (error) {
        console.error('Error fetching work details from Open Library:', error.message);
        return null;
    }
}

module.exports = {
    searchBooks,
    getBookByIsbn,
    getWorkDetails
};
