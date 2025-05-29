# Chatbot API Complete Documentation

## Overview

This is the complete API documentation for the Urban Wealth Capitals Chatbot Server. The API provides endpoints for user management, chat functionality, message management, and real-time communication via WebSockets.

**Base URL:** `https://api.urbanwealthcapitals.com`  
**Development URL:** `http://localhost:5000`

## Table of Contents

1. [Authentication & CORS](#authentication--cors)
2. [Data Models](#data-models)
3. [User Management](#user-management)
4. [Chat & Messaging](#chat--messaging)
5. [Message Management](#message-management)
6. [WebSocket Events](#websocket-events)
7. [File Upload](#file-upload)
8. [Health & Status](#health--status)
9. [Error Handling](#error-handling)

---

## Authentication & CORS

### CORS Configuration
The API accepts requests from the following origins:
- `http://localhost:4200` (Angular dev)
- `http://localhost:5173` (Vite dev)
- `https://support.urbanwealthcapitals.com`
- `https://aitrades.urbanwealthcapitals.com`
- `https://admin.urbanwealthcapitals.com`
- `https://chat.urbanwealthcapitals.com`

### Headers
- `Content-Type: application/json`
- `Authorization: Bearer <token>` (when required)

---

## Data Models

### User Model
```json
{
  "_id": "ObjectId",
  "userId": "string",
  "name": "string",
  "email": "string",
  "phone": "string",
  "messages": [
    {
      "_id": "ObjectId",
      "content": "string",
      "timestamp": "Date",
      "senderType": "user|bot|admin",
      "senderId": "string",
      "file": {
        "filename": "string",
        "originalname": "string",
        "mimetype": "string",
        "size": "number",
        "data": "string (base64)"
      },
      "isDeleted": "boolean",
      "deletedAt": "Date",
      "updatedAt": "Date",
      "isEdited": "boolean",
      "editHistory": [
        {
          "originalContent": "string",
          "editedAt": "Date",
          "editedBy": "string",
          "reason": "string"
        }
      ],
      "isRead": "boolean",
      "readAt": "Date"
    }
  ],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Message Types
- **user**: Messages sent by end users
- **bot**: Automated responses from the chatbot
- **admin**: Messages sent by admin users

---

## User Management

### Get All Users
**GET** `/api/users`

Returns a list of all users with their basic information and message counts.

**Response:**
```json
[
  {
    "_id": "ObjectId",
    "userId": "user123",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "messageCount": 15,
    "unreadCount": 3,
    "lastMessage": {
      "content": "Hello",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "senderType": "user"
    },
    "createdAt": "2024-01-01T10:00:00.000Z"
  }
]
```

### Get User by ID
**GET** `/api/users/:userId`

Returns detailed information about a specific user.

**Parameters:**
- `userId` (URL parameter): The user ID

**Response:**
```json
{
  "_id": "ObjectId",
  "userId": "user123",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "messages": [...],
  "createdAt": "2024-01-01T10:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

### Create/Get User
**POST** `/api/user`

Creates a new user or returns existing user information.

**Request Body:**
```json
{
  "userId": "user123",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "user": {
    "_id": "ObjectId",
    "userId": "user123",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "messages": [],
    "createdAt": "2024-01-01T10:00:00.000Z"
  },
  "isNew": true
}
```

---

## Chat & Messaging

### Send Message
**POST** `/api/chat`

Sends a message to the chatbot and receives a response.

**Content-Type:** `multipart/form-data` (for file uploads) or `application/json`

**Request Body:**
```json
{
  "text": "Hello, I need help",
  "userId": "user123",
  "sessionId": "session456",
  "isAdmin": false,
  "adminId": "admin789" // Only for admin messages
}
```

**With File Upload:**
- `file`: File attachment (max 5MB)
- `text`: Message text
- `userId`: User ID
- `sessionId`: Session ID

**Response:**
```json
{
  "response": "Hello! How can I help you today?",
  "userId": "user123",
  "sessionId": "session456",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "messageId": "ObjectId",
  "fileData": "base64string" // If file was uploaded
}
```

### Get Chat History
**POST** `/api/chat/history`

Retrieves chat history for a user.

**Request Body:**
```json
{
  "userId": "user123"
}
```

**Response:**
```json
{
  "messages": [
    {
      "_id": "ObjectId",
      "content": "Hello",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "senderType": "user"
    },
    {
      "_id": "ObjectId",
      "content": "Hello! How can I help you?",
      "timestamp": "2024-01-01T12:00:30.000Z",
      "senderType": "bot"
    }
  ],
  "userId": "user123"
}
```

### Get Chat History (Alternative)
**GET** `/api/chat/history/:userId`

Alternative endpoint to get chat history via URL parameter.

**Parameters:**
- `userId` (URL parameter): The user ID

**Response:** Same as POST version above.

---

## Message Management

### Update Message (Legacy)
**PUT** `/api/chat/message/:messageId`

Updates the content of a specific message.

**Parameters:**
- `messageId` (URL parameter): The ID of the message to update

**Request Body:**
```json
{
  "content": "Updated message content",
  "adminId": "admin123"
}
```

**Response:**
```json
{
  "message": "Message updated successfully",
  "updatedMessage": {
    "_id": "messageId",
    "content": "Updated message content",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### Edit Message (Enhanced)
**PUT** `/api/chat/message/:messageId/edit`

Enhanced message editing with edit history tracking.

**Parameters:**
- `messageId` (URL parameter): The ID of the message to edit

**Request Body:**
```json
{
  "content": "New message content",
  "adminId": "admin123",
  "reason": "Correcting typo"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message edited successfully",
  "updatedMessage": {
    "_id": "messageId",
    "content": "New message content",
    "isEdited": true,
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "editHistory": [
      {
        "originalContent": "Original message content",
        "editedAt": "2024-01-01T12:00:00.000Z",
        "editedBy": "admin123",
        "reason": "Correcting typo"
      }
    ]
  }
}
```

### Delete Single Message
**DELETE** `/api/chat/message/:messageId`

Deletes a specific message.

**Parameters:**
- `messageId` (URL parameter): The ID of the message to delete

**Response:**
```json
{
  "success": true,
  "message": "Message deleted successfully",
  "messageId": "messageId"
}
```

### Delete All Messages for a User
**DELETE** `/api/chat/messages/user/:userId`

Deletes all messages for a specific user.

**Parameters:**
- `userId` (URL parameter): The ID of the user whose messages to delete

**Response:**
```json
{
  "success": true,
  "message": "All 15 messages deleted successfully for user user123",
  "userId": "user123",
  "deletedCount": 15
}
```

### Delete All Messages for All Users
**DELETE** `/api/chat/messages/all`

Deletes all messages for all users. Requires admin privileges.

**Request Body:**
```json
{
  "adminId": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "All messages deleted successfully for all users",
  "totalUsers": 10,
  "totalMessagesDeleted": 150,
  "userCounts": [
    {
      "userId": "user1",
      "messageCount": 15
    },
    {
      "userId": "user2",
      "messageCount": 8
    }
  ],
  "adminId": "admin123"
}
```

### Mark Messages as Read
**PUT** `/api/chat/read/:userId`

Marks all messages for a user as read.

**Parameters:**
- `userId` (URL parameter): The user ID

**Request Body:**
```json
{
  "adminId": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "All messages marked as read for user user123",
  "userId": "user123",
  "markedCount": 5
}
```

### Mark Single Message as Read
**PUT** `/api/chat/read/message/:messageId`

Marks a specific message as read.

**Parameters:**
- `messageId` (URL parameter): The message ID

**Request Body:**
```json
{
  "adminId": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message marked as read",
  "messageId": "messageId"
}
```

### Get Unread Message Counts
**GET** `/api/chat/unread-counts`

Returns unread message counts for all users.

**Response:**
```json
{
  "unreadCounts": [
    {
      "userId": "user123",
      "unreadCount": 3
    },
    {
      "userId": "user456",
      "unreadCount": 1
    }
  ],
  "totalUnread": 4
}
```

---

## WebSocket Events

### Connection
Connect to WebSocket at: `wss://api.urbanwealthcapitals.com` or `ws://localhost:5000`

### Client to Server Events

#### Join Room
```javascript
socket.emit('join', {
  userId: 'user123',    // For user-specific room
  isAdmin: true         // For admin room
});
```

#### Send Message
```javascript
socket.emit('sendMessage', {
  text: 'Hello',
  userId: 'user123',
  sessionId: 'session456',
  isAdmin: false,       // true for admin messages
  adminId: 'admin789'   // required for admin messages
});
```

#### Mark Messages as Read
```javascript
socket.emit('markMessagesRead', {
  userId: 'user123',
  adminId: 'admin789'
});
```

#### Mark Single Message as Read
```javascript
socket.emit('markMessageRead', {
  messageId: 'messageId',
  adminId: 'admin789'
});
```

#### Edit Message
```javascript
socket.emit('editMessage', {
  messageId: 'messageId',
  content: 'New content',
  adminId: 'admin789',
  reason: 'Correction needed'
});
```

#### Delete All User Messages
```javascript
socket.emit('deleteAllUserMessages', {
  userId: 'user123'
});
```

#### Delete All Messages (Admin Only)
```javascript
socket.emit('deleteAllMessages', {
  adminId: 'admin789'
});
```

### Server to Client Events

#### Joined Room
```javascript
socket.on('joined', (data) => {
  // data: { status: 'success', room: 'user123' }
});
```

#### New Message
```javascript
socket.on('message', (data) => {
  // data: { _id, content, timestamp, senderType, senderId, userId }
});
```

#### Message Read
```javascript
socket.on('messageRead', (data) => {
  // data: { userId, messageId, adminId, timestamp }
});
```

#### Message Edited
```javascript
socket.on('messageEdited', (data) => {
  // data: { _id, content, updatedAt, isEdited, editHistory, action, userId }
});
```

#### Message Deleted
```javascript
socket.on('messageDeleted', (data) => {
  // data: { _id, action, userId }
});
```

#### All Messages Deleted
```javascript
socket.on('allMessagesDeleted', (data) => {
  // data: { userId, action, messageCount, timestamp }
});
```

#### Error
```javascript
socket.on('error', (data) => {
  // data: { message: 'Error description' }
});
```

---

## File Upload

### Supported File Types
- Images: JPEG, PNG, GIF, WebP, HEIC
- Documents: PDF, DOC, DOCX, TXT
- Maximum file size: 5MB

### File Storage
Files are stored as base64 encoded strings in the database with metadata:
```json
{
  "filename": "generated_filename.jpg",
  "originalname": "user_uploaded_file.jpg",
  "mimetype": "image/jpeg",
  "size": 1024000,
  "data": "base64_encoded_file_data"
}
```

---

## Health & Status

### Health Check
**GET** `/health`

Returns server health status.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "message": "Chatbot API is healthy"
}
```

### CORS Test
**GET** `/cors-test`

Tests CORS configuration.

**Response:**
```json
{
  "message": "CORS is working",
  "origin": "https://admin.urbanwealthcapitals.com",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Basic Status
**GET** `/`

Returns basic API status.

**Response:**
```
Chatbot API is running
```

---

## Error Handling

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (validation errors, file too large)
- `404`: Not Found (user, message not found)
- `500`: Internal Server Error

### Error Response Format
```json
{
  "error": "Error message description",
  "details": "Additional error details (optional)"
}
```

### Common Errors

#### File Upload Errors
```json
{
  "error": "File size too large. Maximum size is 5MB."
}
```

#### Validation Errors
```json
{
  "error": "userId is required"
}
```

#### Not Found Errors
```json
{
  "error": "User not found"
}
```

---

## Usage Examples

### JavaScript/Node.js Example
```javascript
// Send a message
const response = await fetch('https://api.urbanwealthcapitals.com/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Hello, I need help',
    userId: 'user123',
    sessionId: 'session456'
  })
});

const data = await response.json();
console.log('Bot response:', data.response);
```

### WebSocket Example
```javascript
const socket = io('https://api.urbanwealthcapitals.com');

// Join user room
socket.emit('join', { userId: 'user123' });

// Listen for messages
socket.on('message', (message) => {
  console.log('New message:', message);
});

// Send message
socket.emit('sendMessage', {
  text: 'Hello',
  userId: 'user123',
  sessionId: 'session456'
});
```

### File Upload Example
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('text', 'Please analyze this image');
formData.append('userId', 'user123');
formData.append('sessionId', 'session456');

const response = await fetch('https://api.urbanwealthcapitals.com/api/chat', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log('Response with file:', data);
```

---

## Rate Limiting & Best Practices

### Best Practices
1. **Use WebSockets for real-time communication** instead of polling
2. **Implement proper error handling** for all API calls
3. **Validate file sizes** before uploading (max 5MB)
4. **Use appropriate content types** for requests
5. **Handle connection drops** gracefully in WebSocket implementations
6. **Store session IDs** for conversation continuity
7. **Implement retry logic** for failed requests

### Performance Considerations
- Messages are stored in user documents for fast retrieval
- File uploads are base64 encoded and stored in database
- WebSocket rooms are used for efficient real-time updates
- CORS is configured for specific origins only

---

## Support

For technical support or questions about this API, please contact the development team or refer to the implementation examples in the codebase.

**API Version:** 1.0  
**Last Updated:** 2024-01-01  
**Server Port:** 5000 (development), 443/80 (production) 