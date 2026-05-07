const express = require('express');
const router  = express.Router();
const { authenticate, authenticateInternal } = require('../middlewares/auth.middleware');
const {
  getNotifications, markAsRead, markAllAsRead, deleteNotification,
  getPreferences, updatePreferences, savePushSubscription,
  streamNotifications, internalSend,
} = require('../controllers/notification.controller');


router.get('/',                authenticate, getNotifications);
router.put('/read-all',        authenticate, markAllAsRead);
router.put('/:id/read',        authenticate, markAsRead);
router.delete('/:id',          authenticate, deleteNotification);
router.get('/preferences',     authenticate, getPreferences);
router.put('/preferences',     authenticate, updatePreferences);
router.post('/subscribe',      authenticate, savePushSubscription);
router.get('/stream',          authenticate, streamNotifications);


router.post('/internal/send',  authenticateInternal, internalSend);

module.exports = router;
