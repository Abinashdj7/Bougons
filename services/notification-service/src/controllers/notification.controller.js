const Notification = require('../models/notification.model');
const Preference   = require('../models/preference.model');
const { enqueue }  = require('../queues/notification.queue');
const { addClient, removeClient } = require('../channels/inapp.channel');


const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const query = { recipient: req.user.id };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ ...query, read: false });

    res.status(200).json({ success: true, data: { notifications, unreadCount } });
  } catch (err) {
    next(err);
  }
};


const markAsRead = async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { read: true, readAt: new Date() }
    );
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};


const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { read: true, readAt: new Date() }
    );
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};


const deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};


const getPreferences = async (req, res, next) => {
  try {
    let prefs = await Preference.findOne({ userId: req.user.id });
    if (!prefs) prefs = await Preference.create({ userId: req.user.id });
    res.status(200).json({ success: true, data: { preferences: prefs } });
  } catch (err) {
    next(err);
  }
};


const updatePreferences = async (req, res, next) => {
  try {
    const prefs = await Preference.findOneAndUpdate(
      { userId: req.user.id },
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, data: { preferences: prefs } });
  } catch (err) {
    next(err);
  }
};


const savePushSubscription = async (req, res, next) => {
  try {
    await Preference.findOneAndUpdate(
      { userId: req.user.id },
      { pushSubscription: req.body.subscription },
      { upsert: true }
    );
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};


const streamNotifications = (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();


  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  addClient(req.user.id, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(req.user.id);
  });
};


const internalSend = async (req, res, next) => {
  try {
    const { recipientId, type, data, channels, emailAddress } = req.body;
    if (!recipientId || !type) {
      return res.status(400).json({ success: false, message: 'recipientId and type required' });
    }
    const job = await enqueue({ recipientId, type, data, channels, emailAddress });
    res.status(202).json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
  savePushSubscription,
  streamNotifications,
  internalSend,
};
