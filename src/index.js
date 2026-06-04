const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

const usersRoutes = require('./routes/usersRoutes');
const classesRoutes = require('./routes/classesRoutes');
const bookingsRoutes = require('./routes/bookingsRoutes');
const adsRoutes = require('./routes/adsRoutes');
const couponsRoutes = require('./routes/couponsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const pricingsRoutes = require('./routes/pricingsRoutes');
const auditLogsRoutes = require('./routes/auditLogsRoutes');
const bannersRoutes = require('./routes/bannersRoutes');
const authRoutes = require('./routes/authRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const contactRoutes = require('./routes/contactRoutes');
const favouritesRoutes = require('./routes/favouritesRoutes');
const blogRoutes = require('./routes/blogRoutes');
const sitemapController = require('./controllers/sitemapController');
const trafficLogger = require('./middleware/trafficLogger');
const startRatingReminders = require('./cron/ratingReminders');
const pool = require('./config/db');

// Run migration on startup
pool.query('ALTER TABLE classes ADD COLUMN sport_type VARCHAR(20) NULL DEFAULT "surf"')
  .then(() => console.log('Added sport_type to classes'))
  .catch(e => console.log('sport_type migration:', e.message));

pool.query('ALTER TABLE bookings ADD COLUMN rating_email_sent BOOLEAN DEFAULT FALSE')
  .then(() => console.log('Added rating_email_sent to bookings'))
  .catch(e => console.log('rating_email_sent migration:', e.message));

pool.query('ALTER TABLE instructor_profiles ADD COLUMN extra_advert_slots INT DEFAULT 0')
  .then(() => console.log('Added extra_advert_slots to instructor_profiles'))
  .catch(e => console.log('extra_advert_slots migration:', e.message));

pool.query('ALTER TABLE classes ADD COLUMN stripe_subscription_id VARCHAR(255) NULL')
  .then(() => console.log('Added stripe_subscription_id to classes'))
  .catch(e => console.log('stripe_subscription_id migration:', e.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS favourite_classes (
    user_id INT UNSIGNED NOT NULL,
    class_id INT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, class_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  )
`).then(() => console.log('favourite_classes table ensured'))
  .catch(e => console.log('favourite_classes error:', e.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS favourite_instructors (
    user_id INT UNSIGNED NOT NULL,
    instructor_id INT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, instructor_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).then(() => console.log('favourite_instructors table ensured'))
  .catch(e => console.log('favourite_instructors error:', e.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS blog_posts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    title_es VARCHAR(255),
    slug VARCHAR(255) NOT NULL UNIQUE,
    excerpt TEXT,
    excerpt_es TEXT,
    content LONGTEXT NOT NULL,
    content_es LONGTEXT,
    cover_image_url VARCHAR(255),
    author_id INT UNSIGNED NOT NULL,
    is_published TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).then(() => console.log('blog_posts table ensured'))
  .catch(e => console.log('blog_posts error:', e.message));

pool.query('ALTER TABLE blog_posts ADD COLUMN title_es VARCHAR(255), ADD COLUMN excerpt_es TEXT, ADD COLUMN content_es LONGTEXT')
  .then(() => console.log('blog_posts localization columns ensured'))
  .catch(e => console.log('blog_posts localization columns existing or error:', e.message));

pool.query('ALTER TABLE users DROP COLUMN tier')
  .then(() => console.log('Dropped tier from users'))
  .catch(e => console.log('tier drop migration:', e.message));

pool.query('ALTER TABLE users DROP COLUMN tier_expires_at')
  .then(() => console.log('Dropped tier_expires_at from users'))
  .catch(e => console.log('tier_expires_at drop migration:', e.message));

pool.query("INSERT IGNORE INTO platform_pricings (item_key, price_eur, description) VALUES ('buy_advert_slot', 10.00, 'Purchase 1 permanent extra advert slot')")
  .then(() => console.log('Added buy_advert_slot pricing'))
  .catch(e => console.log('pricing migration:', e.message));

const createRatingsTableQuery = `
CREATE TABLE IF NOT EXISTS instructor_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT(10) UNSIGNED NOT NULL,
  student_id INT(10) UNSIGNED NOT NULL,
  booking_id INT(10) UNSIGNED NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
`;
pool.query(createRatingsTableQuery)
  .then(() => console.log('instructor_ratings table ready'))
  .catch(e => console.log('instructor_ratings migration:', e.message));

// Start cron jobs
startRatingReminders();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the Nginx reverse proxy (1 hop) so that:
// - req.ip returns the real client IP (from X-Forwarded-For)
// - req.protocol returns 'https' (from X-Forwarded-Proto)
// This is critical for httpOnly cookie `secure` flag to work correctly behind Nginx+Cloudflare
app.set('trust proxy', 1);

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
  
  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Required for serving images from /uploads
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use(limiter);

app.use(trafficLogger);
app.use(cors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:4173'].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Expires', 'Cache-Control', 'Pragma'],
    credentials: true // Required for cookies to be sent cross-origin
}));
const stripeController = require('./controllers/stripeController');

app.use(cookieParser());

// === STRIPE WEBHOOK MUST BE BEFORE express.json() ===
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeController.webhook);

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/pricings', pricingsRoutes);
app.use('/api/logs', auditLogsRoutes);
app.use('/api/banners', bannersRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/favourites', favouritesRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/ratings', require('./routes/ratingsRoutes'));

// Base route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Surf Web App API' });
});

// Sitemap data route
app.get('/api/sitemap-data', sitemapController.getSitemapData);

// Sentry test route
app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

if (process.env.SENTRY_DSN) {
  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

// Trigger nodemon restart
