# Backoffice Management System

## Overview

A comprehensive backoffice system has been created to manage all aspects of your Gabee platform, including profiles, agents, documents, and conversations.

## Features

### 1. **Dashboard & Analytics**
- Real-time system statistics
- Total counts for:
  - Profiles
  - Agents
  - Documents
  - Conversations
  - Messages
  - Followers
- Recent activity (last 7 days)

### 2. **Profile Management**
- View all user profiles with pagination
- Search profiles by handle or display name
- See agent count for each profile
- View detailed profile information
- Delete profiles (cascades to all related data)

### 3. **Agent/Avee Management**
- List all agents in the system
- Search by agent handle or display name
- View agent details including:
  - Owner information
  - Follower count
  - Document count
  - Persona and persona notes
- Delete agents and associated data

### 4. **Document Management**
- View all training documents
- Filter documents by agent
- See document metadata:
  - Layer (public/friends/intimate)
  - Content length and preview
  - Chunk count
  - Source information
- View full document content and chunks
- Delete documents

### 5. **Conversation Management**
- List all conversations
- Filter by user or agent
- View conversation statistics:
  - Message count
  - Layer used
  - Associated agent
- Delete conversations and messages

### 6. **Bulk Operations**
- Delete old conversations (configurable age threshold)
- More bulk operations can be added as needed

## API Endpoints

All admin endpoints are prefixed with `/admin` and require authentication.

### Dashboard
- `GET /admin/stats` - Get system statistics

### Profiles
- `GET /admin/profiles` - List all profiles (with pagination and search)
- `GET /admin/profiles/{user_id}` - Get profile details
- `DELETE /admin/profiles/{user_id}` - Delete profile

### Agents
- `GET /admin/agents` - List all agents (with pagination and search)
- `GET /admin/agents/{avee_id}` - Get agent details
- `DELETE /admin/agents/{avee_id}` - Delete agent

### Documents
- `GET /admin/documents` - List all documents (with pagination and filtering)
- `GET /admin/documents/{document_id}` - Get document details
- `DELETE /admin/documents/{document_id}` - Delete document

### Conversations
- `GET /admin/conversations` - List all conversations (with pagination and filtering)
- `DELETE /admin/conversations/{conversation_id}` - Delete conversation

### Bulk Operations
- `POST /admin/bulk/delete-old-conversations` - Delete old conversations

## Access

### Frontend Access
1. Log in to your account
2. Click on your profile menu (top right)
3. Select "Backoffice" from the dropdown

### Backend Implementation
- Backend admin module: `backend/admin.py`
- Integrated into main FastAPI app in `backend/main.py`
- All endpoints require authentication via `get_current_user_id`

## Security Considerations

### Current Implementation
- All endpoints require user authentication
- Basic authentication check via `require_admin` dependency

### Production Recommendations
1. **Role-Based Access Control (RBAC)**
   ```python
   def require_admin(user_id: str = Depends(get_current_user_id)):
       # Check if user has admin role in database
       profile = db.query(Profile).filter(Profile.user_id == user_id).first()
       if not profile or profile.role != "admin":
           raise HTTPException(status_code=403, detail="Admin access required")
       return user_id
   ```

2. **Add Admin Role to Profile Model**
   ```python
   class Profile(Base):
       # ... existing fields ...
       role = Column(String, default="user")  # user, admin, superadmin
   ```

3. **Audit Logging**
   - Log all admin actions (who did what, when)
   - Track deletions and modifications
   - Store in separate audit log table

4. **Rate Limiting**
   - Implement rate limiting on admin endpoints
   - Prevent abuse of bulk operations

5. **Additional Permissions**
   - Read-only admin access
   - Granular permissions (can manage users, can manage agents, etc.)

## Usage Examples

### View System Stats
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/admin/stats
```

### Search Profiles
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/admin/profiles?search=john&skip=0&limit=20"
```

### Delete Agent
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/admin/agents/AGENT_ID
```

### Bulk Delete Old Conversations
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/admin/bulk/delete-old-conversations?days_old=90"
```

## Frontend Features

### Responsive Design
- Clean, modern interface
- Pagination for large datasets
- Search functionality
- Real-time updates

### User Experience
- Confirmation dialogs for destructive actions
- Loading states
- Error handling
- Success notifications

### Navigation
- Tabbed interface for easy switching between sections
- Integrated into main app navigation
- Accessible from profile dropdown menu

## Future Enhancements

### Potential Features
1. **Advanced Analytics**
   - Usage graphs and charts
   - User engagement metrics
   - Agent performance metrics

2. **User Management**
   - Ban/suspend users
   - Reset passwords
   - Send notifications

3. **Content Moderation**
   - Flag inappropriate content
   - Review reported conversations
   - Content approval workflows

4. **System Monitoring**
   - Database health metrics
   - API performance stats
   - Error tracking

5. **Export Functions**
   - Export data to CSV
   - Generate reports
   - Data backups

6. **Batch Operations**
   - Bulk edit agents
   - Bulk delete documents
   - Mass notifications

## Technical Details

### Backend Architecture
- FastAPI router pattern
- SQLAlchemy ORM for database operations
- Pagination support built-in
- Search functionality with SQL ILIKE

### Frontend Architecture
- Next.js 13+ with App Router
- React hooks for state management
- TypeScript for type safety
- Tailwind CSS for styling

### Database Considerations
- CASCADE deletes prevent orphaned data
- Efficient queries with proper indexing
- Pagination prevents memory issues

## Maintenance

### Regular Tasks
1. Monitor system statistics
2. Review and clean old conversations
3. Check for inactive profiles/agents
4. Audit document storage usage

### Backup Strategy
- Regular database backups
- Document storage backups
- Conversation history archives

## Support

For issues or questions about the backoffice system:
1. Check this documentation
2. Review API endpoint responses
3. Check browser console for frontend errors
4. Review backend logs for server errors







