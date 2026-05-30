const pool = require('../config/db');
const { logAdminAction } = require('../utils/auditLogger');

exports.getCoupons = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM coupons WHERE is_active = TRUE ORDER BY RAND() LIMIT 1');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching coupons', error: error.message });
    }
};

// Admin Endpoints
exports.getAllCouponsAdmin = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM coupons ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching all coupons', error: error.message });
    }
};

exports.createCoupon = async (req, res) => {
    const { shop_name, discount_text, coupon_code, image_url, link_url, is_active } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO coupons (shop_name, discount_text, coupon_code, image_url, link_url, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [shop_name, discount_text, coupon_code, image_url, link_url, is_active ? 1 : 0]
        );
        await logAdminAction(req, 'CREATE_COUPON', 'coupons', result.insertId);
        res.status(201).json({ id: result.insertId, shop_name, discount_text, coupon_code, image_url, link_url, is_active });
    } catch (error) {
        res.status(500).json({ message: 'Error creating coupon', error: error.message });
    }
};

exports.updateCoupon = async (req, res) => {
    const { id } = req.params;
    const { shop_name, discount_text, coupon_code, image_url, link_url, is_active } = req.body;
    try {
        const [result] = await pool.query(
            'UPDATE coupons SET shop_name = ?, discount_text = ?, coupon_code = ?, image_url = ?, link_url = ?, is_active = ? WHERE id = ?',
            [shop_name, discount_text, coupon_code, image_url, link_url, is_active ? 1 : 0, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        await logAdminAction(req, 'UPDATE_COUPON', 'coupons', id);
        res.json({ message: 'Coupon updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating coupon', error: error.message });
    }
};

exports.deleteCoupon = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM coupons WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        await logAdminAction(req, 'DELETE_COUPON', 'coupons', id);
        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting coupon', error: error.message });
    }
};
