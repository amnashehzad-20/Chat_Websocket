const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routers/auth.routes');
const userRoutes = require('./routers/user.routes');
const messageRoutes = require('./routers/message.routes');
const auth = require('./middleware/auth');
const User = require('./models/user');

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"],
    credentials: true
  }
});

connectDB();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Make io accessible in routes
app.set('io', io);

app.use('/', authRoutes);
app.use('/chat/users', userRoutes);
app.use('/chat/messages', messageRoutes);

const connectedUsers = {}; // userId -> socketId using plain object

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // user joining
  socket.on('join', async (userData) => {
    try {
      const { userId } = userData;
      
      // Convert userId to string to ensure consistency
      const userIdString = userId.toString();
      
      // Store user's socket connection
      connectedUsers[userIdString] = socket.id;
      socket.userId = userIdString;
      
      // Update user's online status in database
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date()
      });

      // Send current online users to the newly connected user
      const onlineUserIds = Object.keys(connectedUsers);
      socket.emit('initialOnlineUsers', onlineUserIds);

      // Notify all users that this user is online 
      socket.broadcast.emit('userStatusChange', {
        userId: userIdString,
        isOnline: true
      });

      console.log(`User ${userIdString} joined with socket ${socket.id}`);
      console.log('Current online users:', onlineUserIds);
    } catch (error) {
      console.error('Error in join:', error);
    }
  });

  // Handle sending messages
  socket.on('sendMessage', async (messageData) => {
    try {
      const { receiverId, content, senderId } = messageData;
      
      // Convert IDs to strings for consistency
      const receiverIdString = receiverId.toString();
      const senderIdString = senderId.toString();
      
      // Get receiver's socket ID
      const receiverSocketId = connectedUsers[receiverIdString];
      
      // Send message to receiver if they're online
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', {
          senderId: senderIdString,
          receiverId: receiverIdString,
          content,
          timestamp: new Date()
        });
      }
      
      // Send confirmation back to sender
      socket.emit('messageDelivered', {
        receiverId: receiverIdString,
        delivered: !!receiverSocketId
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('messageError', { error: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    try {
      const { receiverId, isTyping } = data;
      
      console.log('=== TYPING EVENT RECEIVED ON BACKEND ===');
      console.log('From socket userId:', socket.userId);
      console.log('To receiverId:', receiverId);
      console.log('isTyping:', isTyping);
      
      // Convert receiverId to string for consistency
      const receiverIdString = receiverId.toString();
      const receiverSocketId = connectedUsers[receiverIdString];
      
      console.log('Receiver socket ID:', receiverSocketId);
      console.log('Connected users:', Object.keys(connectedUsers));
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userTyping', {
          userId: socket.userId,
          isTyping
        });
        console.log(`Sent typing indicator to ${receiverIdString}`);
      } else {
        console.log(` Receiver ${receiverIdString} not online`);
      }
    } catch (error) {
      console.error('Error handling typing:', error);
    }
  });

  // Handle user disconnection
  socket.on('disconnect', async () => {
    try {
      if (socket.userId) {
        // Remove from connected users
        delete connectedUsers[socket.userId];
        
        // Update user's offline status in database
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });

        // Notify all users about offline status
        socket.broadcast.emit('userStatusChange', {
          userId: socket.userId,
          isOnline: false
        });

        console.log(`User ${socket.userId} disconnected`);
        console.log('Remaining online users:', Object.keys(connectedUsers));
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});