const express = require('express');
const cors = require('cors');
require('dotenv').config();

const usersRoutes = require('./routes/usersRoutes');
const classesRoutes = require('./routes/classesRoutes');
const bookingsRoutes = require('./routes/bookingsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/users', usersRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/bookings', bookingsRoutes);

// Base route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Surf Web App API' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
