const Message = require('../models/message');
const Conversation = require('../models/chat');
const User = require('../models/user');

const messageController = {
  sendMessage: async (req, res) => {
    try {
      const { receiverId, content } = req.body;
      const senderId = req.user._id;

      if (!receiverId || !content) {
        return res.status(400).json({ message: 'Receiver ID and content are required' });
      }

      if (content.trim().length === 0) {
        return res.status(400).json({ message: 'Message cannot be empty' });
      }

      // Check if receiver exists
      const receiver = await User.findById(receiverId);

      if (!receiver) {
        return res.status(404).json({ message: 'Receiver not found' });
      }

      // Find or create conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [senderId, receiverId] }
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [senderId, receiverId]
        });
      }

      // Create message
      const message = await Message.create({
        sender: senderId,
        receiver: receiverId,
        chat: conversation._id,
        content: content.trim()
      });

      // Update conversation's last message
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = new Date();
      await conversation.save();

      // Populate message data
      await message.populate('sender', 'username');
      await message.populate('receiver', 'username');

      // Get Socket.IO instance and emit real-time message
      const io = req.app.get('io');
      if (io) {
        // Emit to all connected clients (they'll filter on frontend)
        io.emit('messageReceived', {
          message: message,
          conversationId: conversation._id
        });
      }

      res.status(201).json({
        message: 'Message sent successfully',
        data: message
      });

    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  getMessages: async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user._id;

      // Find conversation between current user and specified user
      const conversation = await Conversation.findOne({
        participants: { $all: [currentUserId, userId] }
      });

      if (!conversation) {
        return res.json({ messages: [] });
      }

      // Get all messages in this conversation
      const messages = await Message.find({ chat: conversation._id })
        .populate('sender', 'username')
        .populate('receiver', 'username')
        .sort({ createdAt: 1 });

      // Mark messages as read
      await Message.updateMany(
        {
          chat: conversation._id,
          receiver: currentUserId,
          isRead: false
        },
        {
          isRead: true,
          readAt: new Date()
        }
      );

      res.json({ messages });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  getConversations: async (req, res) => {
    try {
      const userId = req.user._id;

      const conversations = await Conversation.find({
        participants: userId
      })
        .populate('participants', 'username isOnline lastSeen')
        .populate('lastMessage')
        .sort({ lastMessageAt: -1 });

      // Format conversations to show the other participant
      const formattedConversations = conversations.map(conv => {
        const otherParticipant = conv.participants.find(
          p => p._id.toString() !== userId.toString()
        );

        return {
          id: conv._id,
          participant: otherParticipant,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          updatedAt: conv.updatedAt
        };
      });

      res.json({ conversations: formattedConversations });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user._id;

      const unreadCount = await Message.countDocuments({
        receiver: userId,
        isRead: false
      });

      res.json({ unreadCount });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = messageController;