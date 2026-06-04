const pool = require('../config/db');

// Helper to generate a slug from a title
const generateSlug = (title) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

exports.getAllPosts = async (req, res) => {
    // If called from the admin dashboard (e.g., via query param ?all=true), return all posts.
    // Otherwise, return only published posts.
    const showAll = req.query.all === 'true';
    
    try {
        let query = `
            SELECT b.*, u.first_name as author_first_name, u.last_name as author_last_name, u.profile_picture_url as author_avatar
            FROM blog_posts b
            JOIN users u ON b.author_id = u.id
        `;
        
        if (!showAll) {
            query += ' WHERE b.is_published = 1';
        }
        
        query += ' ORDER BY b.created_at DESC';
        
        const [posts] = await pool.query(query);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching blog posts', error: error.message });
    }
};

exports.getPostBySlug = async (req, res) => {
    const { slug } = req.params;
    
    try {
        const query = `
            SELECT b.*, u.first_name as author_first_name, u.last_name as author_last_name, u.profile_picture_url as author_avatar
            FROM blog_posts b
            JOIN users u ON b.author_id = u.id
            WHERE b.slug = ?
        `;
        const [posts] = await pool.query(query, [slug]);
        
        if (posts.length === 0) {
            return res.status(404).json({ message: 'Blog post not found' });
        }
        
        res.json(posts[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching blog post', error: error.message });
    }
};

exports.createPost = async (req, res) => {
    const { title, title_es, excerpt, excerpt_es, content, content_es, cover_image_url, is_published } = req.body;
    const author_id = req.user.userId;
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrators can create blog posts' });
    }

    if (!title || !content) {
        return res.status(400).json({ message: 'Title and content are required' });
    }

    let slug = generateSlug(title);

    try {
        // Ensure slug is unique
        let [existing] = await pool.query('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
        let counter = 1;
        let originalSlug = slug;
        while (existing.length > 0) {
            slug = `${originalSlug}-${counter}`;
            [existing] = await pool.query('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
            counter++;
        }

        const [result] = await pool.query(
            'INSERT INTO blog_posts (title, title_es, slug, excerpt, excerpt_es, content, content_es, cover_image_url, author_id, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, title_es || null, slug, excerpt, excerpt_es || null, content, content_es || null, cover_image_url, author_id, is_published ? 1 : 0]
        );

        res.status(201).json({ message: 'Blog post created successfully', id: result.insertId, slug });
    } catch (error) {
        res.status(500).json({ message: 'Error creating blog post', error: error.message });
    }
};

exports.updatePost = async (req, res) => {
    const { id } = req.params;
    const { title, title_es, excerpt, excerpt_es, content, content_es, cover_image_url, is_published } = req.body;
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrators can update blog posts' });
    }

    try {
        let slug = generateSlug(title);
        
        // Ensure new slug is unique to other posts
        let [existing] = await pool.query('SELECT id FROM blog_posts WHERE slug = ? AND id != ?', [slug, id]);
        let counter = 1;
        let originalSlug = slug;
        while (existing.length > 0) {
            slug = `${originalSlug}-${counter}`;
            [existing] = await pool.query('SELECT id FROM blog_posts WHERE slug = ? AND id != ?', [slug, id]);
            counter++;
        }

        await pool.query(
            'UPDATE blog_posts SET title = ?, title_es = ?, slug = ?, excerpt = ?, excerpt_es = ?, content = ?, content_es = ?, cover_image_url = ?, is_published = ? WHERE id = ?',
            [title, title_es || null, slug, excerpt, excerpt_es || null, content, content_es || null, cover_image_url, is_published ? 1 : 0, id]
        );

        res.json({ message: 'Blog post updated successfully', slug });
    } catch (error) {
        res.status(500).json({ message: 'Error updating blog post', error: error.message });
    }
};

exports.deletePost = async (req, res) => {
    const { id } = req.params;
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrators can delete blog posts' });
    }

    try {
        await pool.query('DELETE FROM blog_posts WHERE id = ?', [id]);
        res.json({ message: 'Blog post deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting blog post', error: error.message });
    }
};
