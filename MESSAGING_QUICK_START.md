# Messaging System - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Run Database Migration

Execute the migration SQL to create the necessary tables:

```bash
# Using psql
psql -h your-database-host -U your-username -d your-database -f database_migrations/messaging_system.sql

# Or in Supabase SQL Editor
# Copy the contents of database_migrations/messaging_system.sql and execute
```

### Step 2: Verify Backend

The messaging endpoints are automatically available at:

```
GET    /messaging/conversations
POST   /messaging/conversations
GET    /messaging/conversations/{id}/messages
POST   /messaging/conversations/{id}/messages
GET    /messaging/agent-conversations
GET    /profiles/{handle}
```

Test with:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/messaging/conversations
```

### Step 3: Access the Messages Page

Navigate to `/messages` in your browser. You should see:
- Empty conversation list (if no messages yet)
- "+" button to start new conversations
- Two tabs: "My Chats" and "Agent Chats"

## 📱 Usage Examples

### Send a Direct Message to a Profile

1. Click Messages icon in navigation
2. Click "+" to start new conversation
3. Enter handle: `@johndoe`
4. Select "Profile" chat type
5. Click "Start Chat"
6. Type message and send

### Chat with Someone's Agent

1. Click Messages icon in navigation
2. Click "+" to start new conversation
3. Enter handle: `@johndoe`
4. Select "Agent" chat type
5. Click "Start Chat"
6. Type message to chat with their AI agent

### View Agent Conversations (as Owner)

1. Go to Messages page
2. Click "Agent Chats" tab
3. See all conversations users have with your agents
4. Click any to view full history

## 🔍 Testing

### Create Test Conversation

```python
import requests

API_BASE = "http://localhost:8000"
TOKEN = "your_jwt_token"

# Start a conversation
response = requests.post(
    f"{API_BASE}/messaging/conversations",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={
        "target_user_id": "target-user-uuid",
        "chat_type": "profile"
    }
)
conversation = response.json()
print(f"Created conversation: {conversation['id']}")

# Send a message
response = requests.post(
    f"{API_BASE}/messaging/conversations/{conversation['id']}/messages",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={
        "content": "Hello! This is a test message."
    }
)
message = response.json()
print(f"Sent message: {message['id']}")

# Get messages
response = requests.get(
    f"{API_BASE}/messaging/conversations/{conversation['id']}/messages",
    headers={"Authorization": f"Bearer {TOKEN}"}
)
messages = response.json()
print(f"Conversation has {len(messages['messages'])} messages")
```

## 🎨 UI Features

### Conversation List
- **Avatar**: User profile picture
- **Badge**: Purple computer icon for agent chats
- **Preview**: Last message snippet
- **Time**: Relative time (e.g., "2h ago")
- **Unread**: Blue badge with count

### Message View
- **Outgoing**: Blue/purple gradient bubbles on right
- **Incoming**: White bubbles on left with sender info
- **Typing**: Input field with send button
- **Status**: Message timestamps

### New Chat Modal
- **Search**: Enter username or handle
- **Toggle**: Switch between Profile/Agent chat
- **Visual**: Clear distinction with icons

## 🛠️ Troubleshooting

### Messages Not Loading

1. **Check database**: Ensure migration ran successfully
   ```sql
   SELECT * FROM direct_conversations LIMIT 1;
   SELECT * FROM direct_messages LIMIT 1;
   ```

2. **Check backend**: Verify messaging router is registered
   ```python
   # In backend/main.py
   from messaging import router as messaging_router
   app.include_router(messaging_router, tags=["messaging"])
   ```

3. **Check auth**: Ensure valid JWT token
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:8000/messaging/conversations
   ```

### Profile Not Found Error

Make sure the profile exists:
```sql
SELECT handle, display_name FROM profiles WHERE handle = 'johndoe';
```

If missing, user needs to complete profile setup at `/account`.

### Agent Chat Not Working

1. Verify agent exists for the profile:
   ```sql
   SELECT a.handle, a.display_name, p.handle as owner_handle
   FROM avees a
   JOIN profiles p ON a.owner_user_id = p.user_id
   WHERE a.handle = 'johndoe';
   ```

2. Check target_avee_id in conversation:
   ```sql
   SELECT id, chat_type, target_avee_id 
   FROM direct_conversations 
   WHERE chat_type = 'agent';
   ```

## 📊 Database Queries

### Get User's Conversations
```sql
SELECT 
    dc.id,
    dc.chat_type,
    dc.last_message_at,
    dc.last_message_preview,
    p.handle as other_user_handle,
    p.display_name as other_user_name,
    COUNT(dm.id) FILTER (WHERE dm.read_by_participant1 = 'false') as unread_count
FROM direct_conversations dc
JOIN profiles p ON (
    CASE 
        WHEN dc.participant1_user_id = 'YOUR_USER_ID'::UUID 
        THEN dc.participant2_user_id = p.user_id
        ELSE dc.participant1_user_id = p.user_id
    END
)
LEFT JOIN direct_messages dm ON dm.conversation_id = dc.id
WHERE dc.participant1_user_id = 'YOUR_USER_ID'::UUID 
   OR dc.participant2_user_id = 'YOUR_USER_ID'::UUID
GROUP BY dc.id, p.handle, p.display_name
ORDER BY dc.last_message_at DESC;
```

### Get Conversation Messages
```sql
SELECT 
    dm.id,
    dm.content,
    dm.sender_type,
    dm.created_at,
    p.handle as sender_handle,
    p.display_name as sender_name,
    p.avatar_url as sender_avatar
FROM direct_messages dm
LEFT JOIN profiles p ON dm.sender_user_id = p.user_id
WHERE dm.conversation_id = 'CONVERSATION_ID'::UUID
ORDER BY dm.created_at ASC;
```

### Agent Conversation Stats
```sql
SELECT 
    a.handle as agent_handle,
    a.display_name as agent_name,
    COUNT(DISTINCT dc.id) as total_conversations,
    COUNT(dm.id) as total_messages,
    MAX(dc.last_message_at) as last_activity
FROM avees a
LEFT JOIN direct_conversations dc ON dc.target_avee_id = a.id
LEFT JOIN direct_messages dm ON dm.conversation_id = dc.id
WHERE a.owner_user_id = 'YOUR_USER_ID'::UUID
GROUP BY a.id, a.handle, a.display_name
ORDER BY last_activity DESC;
```

## 🔐 Security Notes

### Authentication
- All endpoints require valid JWT token
- Token must be in `Authorization: Bearer {token}` header

### Authorization
- Users can only view/send in their own conversations
- Agent owners can view conversations with their agents
- RLS policies enforce access control at database level

### Data Privacy
- Messages are encrypted in transit (HTTPS)
- Only conversation participants can view messages
- Agent conversations respect agent privacy settings

## 🎯 Common Use Cases

### Customer Support
- Users message agent for instant support
- Owner monitors agent conversations
- Can jump in manually if needed

### Social Networking
- Users message each other directly
- Build relationships through conversations
- Share information privately

### AI Interactions
- Users chat with specialized agents
- Agents provide personalized responses
- Owners track agent performance

## 📈 Performance Tips

### Pagination (TODO)
For large message lists, implement pagination:
```python
@router.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    messages = (
        db.query(DirectMessage)
        .filter(DirectMessage.conversation_id == conv_uuid)
        .order_by(DirectMessage.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return {"messages": messages}
```

### Caching
Consider caching conversation lists:
```typescript
// Frontend
const conversationCache = useMemo(() => {
  return conversations;
}, [conversations]);
```

### Real-time Updates
For instant messaging, consider WebSockets:
```python
# TODO: WebSocket endpoint
@app.websocket("/ws/messaging/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: str):
    await websocket.accept()
    # Handle real-time message delivery
```

## 🎉 Success Metrics

Track these metrics to measure adoption:
- Total conversations created
- Messages sent per day
- Active conversations
- Agent chat usage vs profile chat
- Average response time
- User engagement

## 📚 Additional Resources

- Full documentation: `MESSAGING_SYSTEM_GUIDE.md`
- Database schema: `database_migrations/messaging_system.sql`
- Backend API: `backend/messaging.py`
- Frontend UI: `frontend/src/app/(app)/messages/page.tsx`

## 🆘 Support

If you encounter issues:
1. Check this quick start guide
2. Review the full documentation
3. Test API endpoints directly
4. Check database tables and indexes
5. Verify RLS policies

## ✨ What's Next?

After basic setup, consider:
- [ ] Enable real-time updates with WebSockets
- [ ] Add message notifications
- [ ] Implement media sharing
- [ ] Add typing indicators
- [ ] Create message search
- [ ] Add emoji reactions
- [ ] Build mobile app

Happy messaging! 🚀








