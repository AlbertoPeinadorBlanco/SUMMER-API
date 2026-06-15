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
const accommodationsRoutes = require('./routes/accommodationsRoutes');
const beachesRoutes = require('./routes/beachesRoutes');
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

pool.query('ALTER TABLE users ADD COLUMN avatar_color VARCHAR(7) DEFAULT "random"')
  .then(() => console.log('Added avatar_color to users'))
  .catch(e => console.log('avatar_color migration:', e.message));

pool.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE NULL')
  .then(() => console.log('Added google_id to users'))
  .catch(e => console.log('google_id migration:', e.message));

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
//test
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

pool.query("ALTER TABLE instructor_profiles ADD COLUMN IF NOT EXISTS bumped_at DATETIME DEFAULT NULL")
  .then(() => console.log('Added bumped_at to instructor_profiles'))
  .catch(e => console.log('instructor_profiles bump migration:', e.message));

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

pool.query("INSERT IGNORE INTO platform_pricings (item_key, price, currency, description) VALUES ('buy_advert_slot', 10.00, 'EUR', 'Purchase 1 permanent extra advert slot')")
  .then(() => console.log('Added buy_advert_slot pricing'))
  .catch(e => console.log('pricing migration:', e.message));

pool.query("INSERT IGNORE INTO platform_pricings (item_key, price, currency, description) VALUES ('bump_instructor', 2.00, 'EUR', 'Boost Instructor Profile for 24h')")
  .then(() => console.log('Added bump_instructor pricing'))
  .catch(e => console.log('pricing migration:', e.message));

pool.query("INSERT IGNORE INTO platform_pricings (item_key, price, currency, description) VALUES ('bump_advert', 2.00, 'EUR', 'Boost Advert for 24h')")
  .then(() => console.log('Added bump_advert pricing'))
  .catch(e => console.log('pricing migration:', e.message));

pool.query("INSERT IGNORE INTO platform_pricings (item_key, price, currency, description) VALUES ('featured_instructor', 20.00, 'EUR', 'Featured Instructor for 7 days')")
  .then(() => console.log('Added featured_instructor pricing'))
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

const createAccommodationsTableQuery = `
CREATE TABLE IF NOT EXISTS accommodations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  location VARCHAR(255) NOT NULL,
  image_url VARCHAR(255),
  description_en TEXT,
  description_es TEXT,
  link VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
`;
pool.query(createAccommodationsTableQuery)
  .then(async () => {
      console.log('accommodations table ready');
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM accommodations');
      if (rows[0].count === 0) {
          // seed 6 accommodations
          await pool.query(`INSERT INTO accommodations (name, type, location, image_url, description_en, description_es, link) VALUES 
          ('Surf House Salinas', 'type_surfhouse', 'Salinas, Asturias', 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80', 'The ultimate surf house located right in front of the famous Salinas break.', 'La mejor surf house ubicada justo en frente de la famosa ola de Salinas.', 'https://example.com'),
          ('Camping Los Cantiles', 'type_camping', 'Luarca, Asturias', 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&q=80', 'A beautiful clifftop camping with spectacular views over the ocean.', 'Un hermoso camping en la cima de un acantilado con vistas espectaculares sobre el océano.', 'https://example.com'),
          ('Gijón Surf Hostel', 'type_hostel', 'Gijón, Asturias', 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&q=80', 'Modern and affordable hostel just 5 minutes walk from San Lorenzo beach.', 'Hostal moderno y asequible a solo 5 minutos a pie de la playa de San Lorenzo.', 'https://example.com'),
          ('Rodiles Surf Camp', 'type_camping', 'Villaviciosa, Asturias', 'https://images.unsplash.com/photo-1537565266751-34afc0f16fb5?w=800&q=80', 'Camping nestled in the pine forest next to Rodiles beach.', 'Camping enclavado en el pinar junto a la playa de Rodiles.', 'https://example.com'),
          ('Llanes Surf House', 'type_surfhouse', 'Llanes, Asturias', 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800&q=80', 'A cozy surf house near some of the most beautiful coves in Eastern Asturias.', 'Una acogedora surf house cerca de algunas de las calas más hermosas del oriente de Asturias.', 'https://example.com'),
          ('Ribadesella Hostel', 'type_hostel', 'Ribadesella, Asturias', 'https://images.unsplash.com/photo-1566782522770-4ccb191a0c4f?w=800&q=80', 'Comfortable hostel close to Santa Marina beach, perfect for surf trips.', 'Cómodo hostal cerca de la playa de Santa Marina, perfecto para viajes de surf.', 'https://example.com')
          `);
      }
  })
  .catch(e => console.log('accommodations migration:', e.message));

const createBeachesTableQuery = `
CREATE TABLE IF NOT EXISTS beaches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  map_link VARCHAR(255),
  image_url VARCHAR(255),
  level VARCHAR(50),
  description_en TEXT,
  description_es TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
`;
pool.query(createBeachesTableQuery)
  .then(async () => {
      console.log('beaches table ready');
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM beaches');
      if (rows[0].count === 0) {
          // seed 6 beaches
          await pool.query(`INSERT INTO beaches (name, location, map_link, image_url, level, description_en, description_es) VALUES 
          ('Playa de Salinas', 'Castrillón, Asturias', 'https://maps.google.com/?q=Playa+de+Salinas+Asturias', 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80', 'All Levels', 'One of the most famous and consistent surf spots in Asturias.', 'Uno de los spots de surf más famosos y consistentes de Asturias.'),
          ('Rodiles', 'Villaviciosa, Asturias', 'https://maps.google.com/?q=Rodiles+Asturias', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', 'Advanced', 'Famous for its fast, hollow left-hander at the river mouth.', 'Famosa por su rápida y hueca izquierda en la desembocadura de la ría.'),
          ('San Lorenzo', 'Gijón, Asturias', 'https://maps.google.com/?q=Playa+de+San+Lorenzo+Gijon', 'https://images.unsplash.com/photo-1520116468816-95b69f847357?w=800&q=80', 'Beginner / Intermediate', 'An urban beach located right in the heart of Gijón.', 'Una playa urbana situada en el corazón de Gijón.'),
          ('Xagó', 'Gozón, Asturias', 'https://maps.google.com/?q=Playa+de+Xago', 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=800&q=80', 'Intermediate / Advanced', 'A very exposed beach with consistent waves, often windy.', 'Una playa muy expuesta con olas consistentes, a menudo ventosa.'),
          ('Santa Marina', 'Ribadesella, Asturias', 'https://maps.google.com/?q=Playa+de+Santa+Marina', 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=800&q=80', 'All Levels', 'A long sandy beach at the mouth of the Sella river.', 'Una larga playa de arena en la desembocadura del río Sella.'),
          ('San Martín', 'Llanes, Asturias', 'https://maps.google.com/?q=Playa+de+San+Martin', 'https://images.unsplash.com/photo-1516483638261-f408892caea0?w=800&q=80', 'Intermediate', 'A beautiful, somewhat isolated beach with good peaks.', 'Una hermosa playa algo aislada con buenos picos.')
          `);
      }
  })
  .catch(e => console.log('beaches migration:', e.message));

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
app.use('/api/accommodations', accommodationsRoutes);
app.use('/api/beaches', beachesRoutes);
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
