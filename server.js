// Remove dotenv config temporarily
// require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const authController = require('./src/controllers/authController');
const processMessage = require('./src/controllers/chatController').processMessage;
const connectDB = require('./src/config/db');

const app = express();
const server = http.createServer(app);

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:4200', 'http://localhost:3000', 'http://localhost:8000','http://127.0.0.1:8000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use('*',cors(corsOptions));

const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});
// Pass the io instance to the auth controller
authController.setSocketIO(io);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.get('/api/users', authController.getAllUsers);
app.get('/api/users/:userId', authController.getUserById);
app.post('/api/user', authController.getUser);
app.post('/api/chat', upload.single('file'), authController.handleChat);
app.post('/api/chat/history', authController.getChatHistory);
app.get('/api/chat/history/:userId', authController.getChatHistoryByParam);

// Message update/delete endpoints
app.put('/api/chat/message/:messageId', authController.updateMessage);
app.delete('/api/chat/message/:messageId', authController.deleteMessage);

// Message read status endpoints
app.put('/api/chat/read/:userId', authController.markMessagesAsRead);
app.put('/api/chat/read/message/:messageId', authController.markMessageAsRead);
app.get('/api/chat/unread-counts', authController.getUnreadMessageCounts);

// Basic route
app.get('/', (req, res) => {
    res.send('Chatbot API is running');
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Handle client joining specific user or admin rooms
  socket.on('join', (data) => {
    // Clean up - leave all rooms except own socket ID room
    const socketRooms = Array.from(socket.rooms);
    socketRooms.forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    // Join new room(s)
    if (data.userId) {
      socket.join(data.userId);
      console.log(`Client ${socket.id} joined user room: ${data.userId}`);
    }
    
    if (data.isAdmin) {
      socket.join('admin');
      console.log(`Client ${socket.id} joined admin room`);
    }
    
    // Notify connected
    socket.emit('joined', {
      status: 'success',
      room: data.userId || 'admin'
    });
  });

  // Handle user sending message
  socket.on('sendMessage', async (message) => {
    try {
      console.log('Received message via socket:', message);
      
      // Check if this is an admin message
      if (message.isAdmin || message.adminId) {
        console.log('Processing admin message via socket');
        
        // Find the user to message
        const user = await mongoose.model('User').findOne({ userId: message.userId });
        
        if (user) {
          // Save admin message
          const adminMessageObj = {
            content: message.text,
            timestamp: new Date(),
            senderType: 'admin',
            senderId: message.adminId || 'admin-socket'
          };
          
          user.messages.push(adminMessageObj);
          await user.save();
          
          // Get the saved message with its ID
          const savedMessage = user.messages[user.messages.length - 1];
          
          // Emit to user's room
          io.to(message.userId).emit('message', {
            _id: savedMessage._id,
            content: savedMessage.content,
            timestamp: savedMessage.timestamp,
            senderType: 'admin'
          });
          
          console.log(`Emitted admin message to user ${message.userId}`);
        }
        
        return; // Skip bot processing for admin messages
      }
      
      // Add senderType to the message for proper processing
      message.senderType = 'user';
      
      // Call your bot logic
      const botResponse = await processMessage({
        text: message.text,
        sessionId: message.sessionId,
        userId: message.userId, 
        senderType: 'user'
      });
      
      // Add senderType: 'bot' for the client UI
      botResponse.senderType = 'bot';
      
      // Save the message to database
      const user = await mongoose.model('User').findOne({ userId: message.userId });
      
      if (user) {
        // Save user message
        const userMessageObj = {
          content: message.text,
          timestamp: new Date(),
          senderType: 'user'
        };
        user.messages.push(userMessageObj);
        
        // Save bot message
        const botMessageObj = {
          content: botResponse.text,
          timestamp: new Date(),
          senderType: 'bot'
        };
        user.messages.push(botMessageObj);
        
        await user.save();
        
        // Emit the saved messages with their IDs
        const savedUserMessage = user.messages[user.messages.length - 2];
        const savedBotMessage = user.messages[user.messages.length - 1];
        
        // Emit to users room
        io.to(message.userId).emit('message', {
          _id: savedUserMessage._id,
          content: savedUserMessage.content,
          timestamp: savedUserMessage.timestamp,
          senderType: 'user'
        });
        
        io.to(message.userId).emit('message', {
          _id: savedBotMessage._id,
          content: savedBotMessage.content,
          timestamp: savedBotMessage.timestamp,
          senderType: 'bot'
        });
        
        // Also emit to admin room
        io.to('admin').emit('message', {
          _id: savedUserMessage._id,
          content: savedUserMessage.content,
          timestamp: savedUserMessage.timestamp,
          senderType: 'user',
          userId: message.userId
        });
      }
    } catch (error) {
      console.error('Error processing socket message:', error);
      socket.emit('error', {
        message: 'Error processing your message'
      });
    }
  });

  // Handle marking all messages for a user as read
  socket.on('markMessagesRead', async (data) => {
    try {
      console.log('Marking messages as read via socket:', data);
      
      if (!data.userId) {
        socket.emit('error', { message: 'userId is required' });
        return;
      }
      
      // Call the controller method to mark messages as read
      const chatController = require('./src/controllers/chatController');
      const result = await chatController.markMessagesAsRead(data.userId);
      
      if (result.success) {
        // Broadcast the update to all admins
        io.to('admin').emit('messageRead', {
          userId: data.userId,
          adminId: data.adminId || 'admin-socket',
          timestamp: new Date()
        });
        
        console.log(`Emitted message read update for user ${data.userId}`);
      }
    } catch (error) {
      console.error('Error marking messages as read via socket:', error);
      socket.emit('error', {
        message: 'Error marking messages as read'
      });
    }
  });
  
  // Handle marking a specific message as read
  socket.on('markMessageRead', async (data) => {
    try {
      console.log('Marking message as read via socket:', data);
      
      if (!data.messageId) {
        socket.emit('error', { message: 'messageId is required' });
        return;
      }
      
      // Call the controller method to mark the message as read
      const chatController = require('./src/controllers/chatController');
      const result = await chatController.markMessageAsRead(data.messageId);
      
      if (result) {
        // Broadcast the update to all admins
        io.to('admin').emit('messageRead', {
          messageId: data.messageId,
          adminId: data.adminId || 'admin-socket',
          timestamp: new Date()
        });
        
        console.log(`Emitted message read update for message ${data.messageId}`);
      }
    } catch (error) {
      console.error('Error marking message as read via socket:', error);
      socket.emit('error', {
        message: 'Error marking message as read'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Something went wrong!' });
});

// Port configuration
const PORT = 5000;

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 