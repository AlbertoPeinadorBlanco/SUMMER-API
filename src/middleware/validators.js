const { body, validationResult } = require('express-validator');

// Helper to check validation results
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const extractedErrors = [];
        errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));
        return res.status(400).json({
            message: 'Validation failed',
            errors: extractedErrors
        });
    }
    next();
};

// User Registration Validation
const registerValidator = [
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
    body('email').trim().isEmail().withMessage('Must be a valid email address'),
    body('password').isLength({ min: 9 }).withMessage('Password must be at least 9 characters long'),
    body('first_name').trim().notEmpty().withMessage('First name is required').matches(/^[A-Za-z\s]+$/).withMessage('First name must contain only letters'),
    body('last_name').trim().notEmpty().withMessage('Last name is required').matches(/^[A-Za-z\s]+$/).withMessage('Last name must contain only letters'),
    body('phone').optional({ checkFalsy: true }).isMobilePhone().withMessage('Must be a valid phone number'),
    body('role').isIn(['user', 'instructor']).withMessage('Role must be either user or instructor'),
    validateRequest
];

// Login Validation
const loginValidator = [
    body('email').trim().notEmpty().withMessage('Email or Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest
];

// Profile Update Validation
const updateProfileValidator = [
    body('first_name').optional().trim().matches(/^[A-Za-z\s]+$/).withMessage('First name must contain only letters'),
    body('last_name').optional().trim().matches(/^[A-Za-z\s]+$/).withMessage('Last name must contain only letters'),
    body('phone').optional({ checkFalsy: true }).isMobilePhone().withMessage('Must be a valid phone number'),
    validateRequest
];

// Create/Update Class Validation
const classValidator = [
    body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters long'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
    body('duration_minutes').isInt({ min: 10 }).withMessage('Duration must be at least 10 minutes'),
    body('difficulty_level').isInt({ min: 1, max: 9 }).withMessage('Difficulty level must be between 1 and 9'),
    body('starts_at').optional({ checkFalsy: true }).isISO8601().withMessage('Must be a valid date'),
    body('ends_at').optional({ checkFalsy: true }).isISO8601().withMessage('Must be a valid date'),
    validateRequest
];

// Contact Form Validation
const contactValidator = [
    body('name').trim().notEmpty().withMessage('Name is required').matches(/^[A-Za-z\s]+$/).withMessage('Name must contain only letters'),
    body('email').trim().isEmail().withMessage('Must be a valid email address'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters long'),
    validateRequest
];

module.exports = {
    registerValidator,
    loginValidator,
    updateProfileValidator,
    classValidator,
    contactValidator
};
