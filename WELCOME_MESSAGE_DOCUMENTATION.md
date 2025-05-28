# Welcome Message Functionality Documentation

## Overview

The welcome message functionality automatically sends a personalized greeting to users when they access the chatbot for the first time each day. This feature enhances user experience by providing a warm welcome without requiring any user interaction.

## Features

- **Automatic Delivery**: Welcome message is sent automatically when user data is fetched via `/api/users/:userId`
- **Once Per Day**: Each user receives the welcome message only once per day
- **No User Action Required**: Message is sent even if the user hasn't sent any message
- **Real-time Updates**: Welcome messages are broadcast via Socket.io for real-time UI updates
- **Database Storage**: Welcome messages are stored in the user's message history
- **Admin Visibility**: Admins can see welcome messages in their dashboard

## Welcome Message Content

```
"Welcome to Cortex AI Customer Care! We're here to assist you. Please let us know how we can serve you better."
```

## Technical Implementation

### Database Schema

#### User Model Enhancement
```javascript
// Added to User schema
lastWelcomeDate: {
    type: String, // Store as date string (YYYY-MM-DD format)
    default: null
}
```

### API Endpoint

#### GET /api/users/:userId
- **Purpose**: Fetch user data and automatically send welcome message if needed
- **Trigger**: Called when user opens chat interface
- **Welcome Logic**: Checks if user has received welcome message today
- **Response**: Returns user data with welcome message added to messages array

### Functions

#### shouldSendWelcomeMessage(userId)
```javascript
// Location: src/controllers/chatController.js
// Purpose: Determines if user should receive welcome message
// Logic: 
//   - Returns true for new users
//   - Returns true if lastWelcomeDate is not today
//   - Updates lastWelcomeDate when welcome message is sent
//   - Returns false if already sent today
```

#### getUserById() Enhancement
```javascript
// Location: src/controllers/authController.js
// Enhancement: Added welcome message logic
// Process:
//   1. Fetch user data
//   2. Check if welcome message should be sent
//   3. Create and save welcome message
//   4. Emit socket events for real-time updates
//   5. Return user data
```

### Socket Events

#### Outgoing Events (Server to Client)
```javascript
// Welcome message to user
io.to(userId).emit('message', {
  _id: messageId,
  content: welcomeMessage,
  timestamp: timestamp,
  senderType: 'bot',
  isWelcomeMessage: true
});

// Welcome message to admins
io.to('admin').emit('message', {
  _id: messageId,
  content: welcomeMessage,
  timestamp: timestamp,
  senderType: 'bot',
  userId: userId,
  isWelcomeMessage: true
});
```

## Usage Flow

### User Journey
1. **User Opens Chat**: Frontend calls `GET /api/users/:userId`
2. **Server Checks**: `shouldSendWelcomeMessage()` determines if welcome needed
3. **Message Creation**: If needed, welcome message is created and saved
4. **Real-time Delivery**: Socket.io broadcasts message to user and admins
5. **UI Update**: Frontend receives message and displays in chat
6. **Daily Reset**: Next day, user can receive welcome message again

### Admin Experience
- Admins see welcome messages in their dashboard
- Welcome messages are marked with `isWelcomeMessage: true` flag
- Admins can distinguish between user-initiated and automatic messages

## Configuration

### Welcome Message Text
```javascript
// Location: src/controllers/chatController.js
const WELCOME_MESSAGE = 'Welcome to Cortex AI Customer Care! We\'re here to assist you. Please let us know how we can serve you better.';
```

### Date Format
```javascript
// Uses ISO date format (YYYY-MM-DD)
const today = new Date().toISOString().split('T')[0];
```

## Testing

### Test Script: test-welcome-message.js
```bash
node test-welcome-message.js
```

#### Test Cases
1. **First Access**: User receives welcome message on first access of the day
2. **Duplicate Prevention**: Same user doesn't receive multiple welcome messages same day
3. **New User**: New users receive welcome message immediately
4. **Message Storage**: Welcome messages are properly stored in database
5. **Socket Broadcasting**: Real-time events are properly emitted

### Manual Testing
```bash
# Test 1: Get user (should receive welcome message)
curl http://localhost:5000/api/users/testuser123

# Test 2: Get same user again (should NOT receive another welcome message)
curl http://localhost:5000/api/users/testuser123

# Test 3: Check user messages
curl -X POST http://localhost:5000/api/chat/history \
  -H "Content-Type: application/json" \
  -d '{"userId": "testuser123"}'
```

## Error Handling

### Database Errors
- Welcome message check failures are logged but don't block user data retrieval
- Fallback: If welcome check fails, user data is still returned

### Socket Errors
- Welcome message is saved to database even if socket emission fails
- Users will see welcome message when they refresh/reconnect

## Security Considerations

- Welcome messages are only sent to authenticated users
- No sensitive information in welcome messages
- Rate limiting prevents abuse of user endpoint

## Performance Impact

- **Minimal Database Load**: Single query to check/update lastWelcomeDate
- **Efficient Logic**: Quick date comparison prevents unnecessary processing
- **Async Processing**: Welcome message logic doesn't block user data response

## Customization Options

### Message Content
```javascript
// Modify in src/controllers/chatController.js
const WELCOME_MESSAGE = 'Your custom welcome message here';
```

### Frequency
```javascript
// Current: Once per day
// To change frequency, modify date comparison logic in shouldSendWelcomeMessage()
```

### Conditions
```javascript
// Add custom conditions in shouldSendWelcomeMessage()
// Examples: user type, time of day, user preferences
```

## Integration Points

### Frontend Integration
```javascript
// Listen for welcome messages
socket.on('message', (message) => {
  if (message.isWelcomeMessage) {
    // Handle welcome message display
    displayWelcomeMessage(message);
  } else {
    // Handle regular messages
    displayMessage(message);
  }
});
```

### Admin Dashboard
```javascript
// Filter welcome messages in admin view
const welcomeMessages = messages.filter(msg => msg.isWelcomeMessage);
const userMessages = messages.filter(msg => !msg.isWelcomeMessage);
```

## Troubleshooting

### Welcome Message Not Appearing
1. Check if user exists in database
2. Verify lastWelcomeDate field
3. Check server logs for errors
4. Ensure socket connection is active

### Duplicate Welcome Messages
1. Check date comparison logic
2. Verify database update is working
3. Check for timezone issues

### Socket Issues
1. Verify socket connection
2. Check room joining logic
3. Ensure proper event emission

## Future Enhancements

- **Personalized Messages**: Include user name in welcome message
- **Time-based Messages**: Different messages for different times of day
- **User Preferences**: Allow users to disable welcome messages
- **Analytics**: Track welcome message engagement
- **A/B Testing**: Test different welcome message variations 