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
      
      //  user's socket connection
      connectedUsers[userId] = socket.id;
      socket.userId = userId;
      
      // Update user's online status in database
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date()
      });

      // Send current online users to the newly connected user
      const onlineUserIds = Object.keys(connectedUsers);
      socket.emit('initialOnlineUsers', onlineUserIds);

      // Notify all user online 
      socket.broadcast.emit('userStatusChange', {
        userId,
        isOnline: true
      });

      console.log(`User ${userId} joined with socket ${socket.id}`);
      console.log('Current online users:', onlineUserIds);
    } catch (error) {
      console.error('Error in join:', error);
    }
  });

  // Handle sending messages
  socket.on('sendMessage', async (messageData) => {
    try {
      const { receiverId, content, senderId } = messageData;
      
      // Get receiver's socket ID
      const receiverSocketId = connectedUsers[receiverId];
      
      // Send message to receiver if they're online
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', {
          senderId,
          receiverId,
          content,
          timestamp: new Date()
        });
      }
      
      // Send confirmation back to sender
      socket.emit('messageDelivered', {
        receiverId,
        delivered: !!receiverSocketId
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('messageError', { error: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { receiverId, isTyping } = data;
    const receiverSocketId = connectedUsers[receiverId];
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userTyping', {
        userId: socket.userId,
        isTyping
      });
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