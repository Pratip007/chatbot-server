# User Deletion API Documentation

## Overview
This document describes the API endpoints for deleting users in the chatbot system. These are admin-only operations that require proper authorization.

## Security Features
- **Admin Authorization Required**: All endpoints require `adminId` in request body
- **Confirmation Code**: Delete all users requires explicit confirmation code
- **Comprehensive Logging**: All operations are logged with timestamps and admin tracking
- **Real-time Notifications**: Socket.io events notify connected clients
- **Graceful User Disconnection**: Users are notified and disconnected when deleted

## API Endpoints

### 1. Delete Specific User

**Endpoint**: `DELETE /api/users/:userId`  
**Alternative**: `DELETE /users/:userId`

**Description**: Deletes a specific user and all their messages.

**Parameters**:
- `userId` (URL parameter): The ID of the user to delete

**Request Body**:
```json
{
  "adminId": "admin123"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "User john_doe (user123) deleted successfully",
  "deletedUser": {
    "userId": "user123",
    "username": "john_doe",
    "messageCount": 45,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "deletedAt": "2024-01-20T14:25:30.000Z",
    "deletedBy": "admin123"
  }
}
```

**Error Responses**:
- `400`: Missing userId or adminId
- `404`: User not found
- `500`: Server error

### 2. Delete All Users

**Endpoint**: `DELETE /api/users/all`  
**Alternative**: `DELETE /users/all`

**Description**: Deletes ALL users and their messages. Requires explicit confirmation.

**Request Body**:
```json
{
  "adminId": "admin123",
  "confirmationCode": "DELETE_ALL_USERS_CONFIRMED"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "All 25 users deleted successfully",
  "deletedUsers": [
    {
      "userId": "user1",
      "username": "john_doe",
      "messageCount": 45,
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "userId": "user2",
      "username": "jane_smith",
      "messageCount": 32,
      "createdAt": "2024-01-16T09:15:00.000Z"
    }
  ],
  "totalUsers": 25,
  "totalMessagesDeleted": 1250,
  "deletedBy": "admin123",
  "deletedAt": "2024-01-20T14:25:30.000Z"
}
```

**Error Responses**:
- `400`: Missing adminId or invalid confirmation code
- `500`: Server error

## Socket.io Events

### User Deletion Events

**Event**: `userDeleted`  
**Emitted to**: Admin room  
**Payload**:
```json
{
  "userId": "user123",
  "username": "john_doe",
  "action": "userDeleted",
  "deletedBy": "admin123",
  "timestamp": "2024-01-20T14:25:30.000Z"
}
```

**Event**: `accountDeleted`  
**Emitted to**: Specific user room  
**Payload**:
```json
{
  "message": "Your account has been deleted by an administrator",
  "timestamp": "2024-01-20T14:25:30.000Z"
}
```

### Bulk Deletion Events

**Event**: `allUsersDeleted`  
**Emitted to**: Admin room  
**Payload**:
```json
{
  "action": "allUsersDeleted",
  "deletedBy": "admin123",
  "userCount": 25,
  "totalMessageCount": 1250,
  "timestamp": "2024-01-20T14:25:30.000Z"
}
```

## Usage Examples

### Example 1: Delete Single User (cURL)

```bash
curl -X DELETE "http://localhost:3000/api/users/user123" \
  -H "Content-Type: application/json" \
  -d '{"adminId":"admin123"}'
```

### Example 2: Delete All Users (cURL)

```bash
curl -X DELETE "http://localhost:3000/api/users/all" \
  -H "Content-Type: application/json" \
  -d '{
    "adminId":"admin123",
    "confirmationCode":"DELETE_ALL_USERS_CONFIRMED"
  }'
```

### Example 3: JavaScript/Fetch

```javascript
// Delete single user
async function deleteUser(userId, adminId) {
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ adminId })
    });
    
    const result = await response.json();
    console.log('User deleted:', result);
  } catch (error) {
    console.error('Error deleting user:', error);
  }
}

// Delete all users
async function deleteAllUsers(adminId) {
  const confirmed = confirm('Are you sure you want to delete ALL users? This cannot be undone!');
  if (!confirmed) return;
  
  try {
    const response = await fetch('/api/users/all', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        adminId,
        confirmationCode: 'DELETE_ALL_USERS_CONFIRMED'
      })
    });
    
    const result = await response.json();
    console.log('All users deleted:', result);
  } catch (error) {
    console.error('Error deleting all users:', error);
  }
}
```

### Example 4: Angular Service

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserDeletionService {
  private apiUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  deleteUser(userId: string, adminId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`, {
      body: { adminId }
    });
  }

  deleteAllUsers(adminId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/all`, {
      body: {
        adminId,
        confirmationCode: 'DELETE_ALL_USERS_CONFIRMED'
      }
    });
  }
}
```

## Security Considerations

### 1. Admin Authorization
- Always validate `adminId` before processing deletion requests
- Consider implementing role-based access control (RBAC)
- Log all admin actions for audit trails

### 2. Confirmation Requirements
- Delete all users requires explicit confirmation code
- Consider implementing additional confirmation steps for critical operations
- Add rate limiting to prevent abuse

### 3. Data Backup
- **IMPORTANT**: These operations are irreversible
- Ensure you have proper database backups before performing bulk deletions
- Consider implementing soft deletes for recovery options

### 4. User Notification
- Users are automatically notified when their accounts are deleted
- Connected users are gracefully disconnected
- Consider implementing email notifications for account deletions

## Error Handling

### Common Error Scenarios

1. **Missing Admin ID**:
   ```json
   {
     "error": "adminId is required for this operation"
   }
   ```

2. **User Not Found**:
   ```json
   {
     "error": "User not found"
   }
   ```

3. **Invalid Confirmation Code**:
   ```json
   {
     "error": "Invalid confirmation code. This operation requires explicit confirmation.",
     "requiredCode": "DELETE_ALL_USERS_CONFIRMED"
   }
   ```

4. **Server Error**:
   ```json
   {
     "error": "Error deleting user"
   }
   ```

## Best Practices

1. **Always confirm before deletion**: Implement multiple confirmation steps
2. **Backup data**: Ensure you have recent backups before bulk operations
3. **Monitor logs**: Check server logs for successful operations and errors
4. **Test in development**: Always test deletion operations in a development environment first
5. **Implement recovery**: Consider soft deletes or data archiving for recovery options

## Database Impact

### User Deletion
- Removes entire user document from MongoDB
- Deletes all associated messages (embedded in user document)
- Cannot be undone without database restore

### Performance Considerations
- Single user deletion: Fast operation
- Bulk deletion: May take time depending on user count
- Consider implementing background jobs for large-scale deletions

## Monitoring and Logging

All deletion operations are logged with:
- Timestamp
- Admin ID who performed the action
- User(s) affected
- Message counts
- Operation success/failure

Check server logs for detailed operation history:
```bash
tail -f server.log | grep "deleted successfully"
``` 