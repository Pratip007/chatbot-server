# Message Management API Documentation

This document describes the message management endpoints for the chatbot server, including message deletion, editing, and bulk operations.

## Data Storage Architecture

**Important**: All messages (user, bot, and admin) are stored in the User model's `messages` array. This ensures:
- Consistent data storage across all message types
- Easy retrieval of complete conversation history
- Simplified message management operations
- Real-time synchronization across all clients

Each message in the array includes:
- `senderType`: 'user', 'bot', or 'admin'
- `senderId`: For admin messages, identifies the specific admin
- `content`: The message text
- `timestamp`: When the message was created
- `isEdited`: Boolean indicating if the message has been edited
- `editHistory`: Array of edit records for accountability

## Endpoints

### 1. Update Message (Legacy)
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

### 2. Edit Message (Enhanced)
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

### 3. Delete Single Message
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

### 4. Delete All Messages for a User
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

### 5. Delete All Messages for All Users (Admin Only)
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

## Socket Events

### Client to Server Events

#### 1. Edit Message
```javascript
socket.emit('editMessage', {
  messageId: 'messageId',
  content: 'New content',
  adminId: 'admin123',
  reason: 'Correction needed'
});
```

#### 2. Delete All User Messages
```javascript
socket.emit('deleteAllUserMessages', {
  userId: 'user123'
});
```

#### 3. Delete All Messages (Admin Only)
```javascript
socket.emit('deleteAllMessages', {
  adminId: 'admin123'
});
```

### Server to Client Events

#### 1. Message Edited
```javascript
socket.on('messageEdited', (data) => {
  console.log('Message edited:', data);
  // data contains: _id, content, updatedAt, isEdited, editHistory, action, userId
});
```

#### 2. Message Deleted
```javascript
socket.on('messageDeleted', (data) => {
  console.log('Message deleted:', data);
  // data contains: _id, action, userId
});
```

#### 3. All Messages Deleted
```javascript
socket.on('allMessagesDeleted', (data) => {
  console.log('All messages deleted:', data);
  // data contains: userId, action, messageCount, timestamp
  // OR for all users: action, totalMessageCount, userCounts, adminId, timestamp
});
```

#### 4. Operation Results
```javascript
socket.on('editMessageResult', (result) => {
  console.log('Edit result:', result);
});

socket.on('deleteAllUserMessagesResult', (result) => {
  console.log('Delete user messages result:', result);
});

socket.on('deleteAllMessagesResult', (result) => {
  console.log('Delete all messages result:', result);
});
```

#### 5. Error Handling
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

## Message Schema

Messages now include additional fields for enhanced functionality:

```javascript
{
  "_id": "ObjectId",
  "content": "Message content",
  "timestamp": "Date",
  "senderType": "user|bot|admin",
  "senderId": "String",
  "file": {
    "filename": "String",
    "originalname": "String", 
    "mimetype": "String",
    "size": "Number",
    "data": "String (base64)"
  },
  "isDeleted": "Boolean",
  "deletedAt": "Date",
  "updatedAt": "Date",
  "isEdited": "Boolean",
  "editHistory": [
    {
      "originalContent": "String",
      "editedAt": "Date",
      "editedBy": "String",
      "reason": "String"
    }
  ]
}
```

## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

```json
{
  "error": "Error message description"
}
```

Common error codes:
- `400`: Bad Request (missing required parameters)
- `404`: Not Found (message or user not found)
- `500`: Internal Server Error

## Real-time Updates

All message operations trigger real-time socket events to keep all connected clients synchronized:

- Message edits are broadcast to the user's room and admin room
- Message deletions are broadcast to relevant rooms
- Bulk operations notify all affected users and admins

## Security Notes

- Admin operations require `adminId` parameter
- All operations are logged for audit purposes
- Edit history is preserved for accountability
- Socket events include proper error handling 