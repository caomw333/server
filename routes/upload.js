/**
 * Upload Routes - Image upload for products
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const { requireMerchant } = require('../middleware/auth');

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('仅支持 jpg/png/gif/webp 格式图片'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

/**
 * POST /api/upload
 * Upload product image (merchant only)
 * Returns: { url: '/uploads/xxx.jpg' }
 */
router.post('/', requireMerchant, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: '文件过大，最大支持 5MB' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: '请选择图片' });
    }

    const url = '/uploads/' + req.file.filename;
    res.json({ url, filename: req.file.filename });
  });
});

module.exports = router;
