module.exports = (req, res, next) => {
    // Check if the authenticated user has the 'admin' role
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    next();
};
