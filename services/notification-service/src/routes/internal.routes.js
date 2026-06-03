const express = require('express');
const router = express.Router();
const { authenticateInternal } = require('../middlewares/auth.middleware');
const { internalSend } = require('../controllers/notification.controller');

router.post('/send', authenticateInternal, internalSend);

module.exports = router;
