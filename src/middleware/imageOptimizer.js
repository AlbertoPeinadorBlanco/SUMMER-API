const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Configure memory storage for multer so we can process the buffer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit (allow bigger before compression)
    fileFilter: fileFilter
});

// Middleware factory to specify dimensions and category
const optimizeImage = (category, width = 800) => {
    return async (req, res, next) => {
        if (!req.file) return next();

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const id = req.params.id || 'new';
        
        // Define the filename and output path
        // Converting all to WebP as requested
        const filename = `${category}-${id}-${uniqueSuffix}.webp`;
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', category);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, filename);

        try {
            await sharp(req.file.buffer)
                .resize({ width: width, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(filePath);

            // Mutate req.file to match what multer.diskStorage would have provided
            req.file.filename = filename;
            req.file.path = filePath;
            req.file.mimetype = 'image/webp';
            
            next();
        } catch (error) {
            console.error('Image optimization failed:', error);
            res.status(500).json({ message: 'Image optimization failed' });
        }
    };
};

module.exports = { upload, optimizeImage };
