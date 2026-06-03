const express = require('express');
const router = express.Router();
const { authenticateInternal } = require('../middlewares/auth.middleware');
const { setOnlineStatusById, updateLocationById } = require('../controllers/location.controller');

router.put('/drivers/:id/status',   authenticateInternal, setOnlineStatusById);
router.put('/drivers/:id/location', authenticateInternal, updateLocationById);

module.exports = router;
