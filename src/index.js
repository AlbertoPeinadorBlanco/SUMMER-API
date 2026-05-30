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
const sitemapController = require('./controllers/sitemapController');
const trafficLogger = require('./middleware/trafficLogger');
const startSubscriptionReminders = require('./cron/subscriptionReminders');

// Start cron jobs
startSubscriptionReminders();

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
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
