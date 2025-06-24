const express = require('express');
const messageController = require('../controllers/message.controller');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, messageController.sendMessage);
router.get('/conversations', auth, messageController.getConversations);
router.get('/unread-count', auth, messageController.getUnreadCount);
router.get('/:userId', auth, messageController.getMessages);

module.exports = router;