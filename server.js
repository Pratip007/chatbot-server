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
  origin: [
    'http://localhost:4200',
    'http://localhost:5173',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'https://support.urbanwealthcapitals.com',
    'https://aitrades.urbanwealthcapitals.com',
    'https://aitrading.cortexneuralink.com',
    'https://support.cortexneuralink.com',
    'https://admin.cortexneuralink.com',
    'https://adminchat.urbanwealthcapitals.com',
    'https://api.urbanwealthcapitals.com',
    'https://chat.urbanwealthcapitals.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
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

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
  next();
});

// Connect to MongoDB
connectDB();

// Routes
app.get('/api/users', authController.getAllUsers);
app.get('/api/users/:userId', authController.getUserById);
app.post('/api/user', authController.getUser);
app.post('/api/chat', upload.single('file'), authController.handleChat);
app.post('/api/chat/history', authController.getChatHistory);
app.get('/api/chat/history/:userId', authController.getChatHistoryByParam);

// Alternative routes without /api prefix for frontend compatibility
app.post('/chat', upload.single('file'), authController.handleChat);
app.post('/user', authController.getUser);
app.post('/chat/history', authController.getChatHistory);
app.get('/chat/history/:userId', authController.getChatHistoryByParam);
app.get('/users/:userId', authController.getUserById);
app.get('/users', authController.getAllUsers);

// Message update/delete endpoints
app.put('/api/chat/message/:messageId', authController.updateMessage);
app.delete('/api/chat/message/:messageId', authController.deleteMessage);

// New message management endpoints
app.delete('/api/chat/messages/user/:userId', authController.deleteAllUserMessages);
app.delete('/api/chat/messages/all', authController.deleteAllMessages);
app.put('/api/chat/message/:messageId/edit', authController.editMessage);

// Message read status endpoints
app.put('/api/chat/read/:userId', authController.markMessagesAsRead);
app.put('/api/chat/read/message/:messageId', authController.markMessageAsRead);
app.get('/api/chat/unread-counts', authController.getUnreadMessageCounts);

// User deletion endpoints (Admin only)
app.delete('/api/users/:userId', authController.deleteUser);
app.delete('/api/users/all', authController.deleteAllUsers);

// Alternative routes without /api prefix for compatibility
app.delete('/users/:userId', authController.deleteUser);
app.delete('/users/all', authController.deleteAllUsers);

// Basic route
app.get('/', (req, res) => {
    res.send('Chatbot API is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Chatbot API is healthy'
    });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
    res.json({ 
        message: 'CORS is working',
        origin: req.get('Origin'),
        timestamp: new Date().toISOString()
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Handle client joining specific user or admin rooms
  socket.on('join', async (data) => {
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
            senderType: 'admin',
            senderId: savedMessage.senderId
          });
          
          // Also emit to admin room for confirmation
          io.to('admin').emit('message', {
            _id: savedMessage._id,
            content: savedMessage.content,
            timestamp: savedMessage.timestamp,
            senderType: 'admin',
            senderId: savedMessage.senderId,
            userId: message.userId
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
        
        // Only save and emit bot message if bot responded (not silenced)
        if (botResponse) {
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
          
          // Emit user message to users room
          io.to(message.userId).emit('message', {
            _id: savedUserMessage._id,
            content: savedUserMessage.content,
            timestamp: savedUserMessage.timestamp,
            senderType: 'user'
          });
          
          // Emit bot message to users room
          io.to(message.userId).emit('message', {
            _id: savedBotMessage._id,
            content: savedBotMessage.content,
            timestamp: savedBotMessage.timestamp,
            senderType: 'bot'
          });
          
          // Also emit user message to admin room
          io.to('admin').emit('message', {
            _id: savedUserMessage._id,
            content: savedUserMessage.content,
            timestamp: savedUserMessage.timestamp,
            senderType: 'user',
            userId: message.userId
          });
          
          // Also emit bot message to admin room
          io.to('admin').emit('message', {
            _id: savedBotMessage._id,
            content: savedBotMessage.content,
            timestamp: savedBotMessage.timestamp,
            senderType: 'bot',
            userId: message.userId
          });
        } else {
          // Bot is silenced, only save and emit user message
          await user.save();
          
          const savedUserMessage = user.messages[user.messages.length - 1];
          
          // Emit user message to users room
          io.to(message.userId).emit('message', {
            _id: savedUserMessage._id,
            content: savedUserMessage.content,
            timestamp: savedUserMessage.timestamp,
            senderType: 'user'
          });
          
          // Also emit user message to admin room
          io.to('admin').emit('message', {
            _id: savedUserMessage._id,
            content: savedUserMessage.content,
            timestamp: savedUserMessage.timestamp,
            senderType: 'user',
            userId: message.userId
          });
        }
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

  // Handle deleting all messages for a specific user
  socket.on('deleteAllUserMessages', async (data) => {
    try {
      console.log('Deleting all messages for user via socket:', data);
      
      if (!data.userId) {
        socket.emit('error', { message: 'userId is required' });
        return;
      }
      
      const authController = require('./src/controllers/authController');
      
      // Create a mock request/response for the controller
      const mockReq = { params: { userId: data.userId } };
      const mockRes = {
        json: (result) => {
          if (result.success) {
            // Emit to user's room
            io.to(data.userId).emit('allMessagesDeleted', {
              userId: data.userId,
              action: 'allDeleted',
              messageCount: result.deletedCount,
              timestamp: new Date()
            });
            
            // Also notify admins
            io.to('admin').emit('allMessagesDeleted', {
              userId: data.userId,
              action: 'allDeleted',
              messageCount: result.deletedCount,
              timestamp: new Date()
            });
            
            socket.emit('deleteAllUserMessagesResult', result);
          } else {
            socket.emit('error', { message: 'Failed to delete messages' });
          }
        },
        status: (code) => ({ json: (error) => socket.emit('error', error) })
      };
      
      await authController.deleteAllUserMessages(mockReq, mockRes);
    } catch (error) {
      console.error('Error deleting all user messages via socket:', error);
      socket.emit('error', {
        message: 'Error deleting all user messages'
      });
    }
  });

  // Handle deleting all messages for all users (admin only)
  socket.on('deleteAllMessages', async (data) => {
    try {
      console.log('Deleting all messages for all users via socket:', data);
      
      if (!data.adminId) {
        socket.emit('error', { message: 'adminId is required for this operation' });
        return;
      }
      
      const authController = require('./src/controllers/authController');
      
      // Create a mock request/response for the controller
      const mockReq = { body: { adminId: data.adminId } };
      const mockRes = {
        json: (result) => {
          if (result.success) {
            // Notify all users and admins
            io.emit('allMessagesDeleted', {
              action: 'allMessagesAllUsers',
              totalMessageCount: result.totalMessagesDeleted,
              userCounts: result.userCounts,
              adminId: data.adminId,
              timestamp: new Date()
            });
            
            socket.emit('deleteAllMessagesResult', result);
          } else {
            socket.emit('error', { message: 'Failed to delete all messages' });
          }
        },
        status: (code) => ({ json: (error) => socket.emit('error', error) })
      };
      
      await authController.deleteAllMessages(mockReq, mockRes);
    } catch (error) {
      console.error('Error deleting all messages via socket:', error);
      socket.emit('error', {
        message: 'Error deleting all messages'
      });
    }
  });

  // Handle editing a message
  socket.on('editMessage', async (data) => {
    try {
      console.log('Editing message via socket:', data);
      
      if (!data.messageId || !data.content) {
        socket.emit('error', { message: 'messageId and content are required' });
        return;
      }
      
      const authController = require('./src/controllers/authController');
      
      // Create a mock request/response for the controller
      const mockReq = { 
        params: { messageId: data.messageId },
        body: { 
          content: data.content, 
          adminId: data.adminId,
          reason: data.reason 
        }
      };
      const mockRes = {
        json: (result) => {
          if (result.success) {
            socket.emit('editMessageResult', result);
          } else {
            socket.emit('error', { message: 'Failed to edit message' });
          }
        },
        status: (code) => ({ json: (error) => socket.emit('error', error) })
      };
      
      await authController.editMessage(mockReq, mockRes);
    } catch (error) {
      console.error('Error editing message via socket:', error);
      socket.emit('error', {
        message: 'Error editing message'
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