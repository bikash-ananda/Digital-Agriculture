const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/siteContentController');

const router = express.Router();
router.get('/', c.getAll); // public: the landing page reads this
router.put('/:key', authenticate, authorize('site_content.update'), c.save);
router.delete('/:key', authenticate, authorize('site_content.update'), c.reset);
module.exports = router;
