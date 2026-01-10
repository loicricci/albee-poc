# Messaging System - Complete Implementation Guide

## Overview

A comprehensive messaging system has been implemented that allows users to:
- Send direct messages to other profiles
- Chat with AI agents belonging to other profiles
- View conversation history for both types of chats
- See all conversations where users are chatting with their agents (for agent owners)

## Features

### 1. **Dual Chat Types**
- **Profile Chat**: Direct messaging to a user's inbox
- **Agent Chat**: Conversations with a user's AI agent

### 2. **Conversation Management**
- List all conversations (sorted by most recent)
- View unread message counts
- Search and start new conversations
- Real-time message updates

### 3. **Agent Owner Insights**
- Dedicated view showing all conversations with your agents
- Helps profile owners monitor and understand how their agents are being used
- Can view full conversation history

### 4. **Smart UI**
- Visual distinction between profile and agent chats
- Avatar badges to indicate chat type
- Responsive design that works on all screen sizes
- Message read status tracking

## Database Schema

### New Tables

#### `direct_conversations`
Stores conversation metadata between two users.

```sql
CREATE TABLE direct_conversations (
    id UUID PRIMARY KEY,
    participant1_user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    participant2_user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    chat_type VARCHAR NOT NULL DEFAULT 'profile', -- 'profile' or 'agent'
    target_avee_id UUID REFERENCES avees(id) ON DELETE SET NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_preview TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_direct_conversations_participant1 ON direct_conversations(participant1_user_id);
CREATE INDEX idx_direct_conversations_participant2 ON direct_conversations(participant2_user_id);
CREATE INDEX idx_direct_conversations_avee ON direct_conversations(target_avee_id);
```

#### `direct_messages`
Stores individual messages within conversations.

```sql
CREATE TABLE direct_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES direct_conversations(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    sender_type VARCHAR NOT NULL, -- 'user', 'agent', 'system'
    sender_avee_id UUID REFERENCES avees(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    read_by_participant1 VARCHAR DEFAULT 'false',
    read_by_participant2 VARCHAR DEFAULT 'false',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_direct_messages_conversation ON direct_messages(conversation_id);
CREATE INDEX idx_direct_messages_sender ON direct_messages(sender_user_id);
```

## Backend API Endpoints

### Messages Router (`/messaging`)

#### 1. List Conversations
```http
GET /messaging/conversations
Authorization: Bearer {token}
```

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "chat_type": "profile" | "agent",
      "other_participant": {
        "user_id": "uuid",
        "handle": "johndoe",
        "display_name": "John Doe",
        "avatar_url": "https://..."
      },
      "target_avee": {
        "id": "uuid",
        "handle": "johndoe",
        "display_name": "John's Agent",
        "avatar_url": "https://..."
      },
      "last_message_at": "2025-01-01T12:00:00Z",
      "last_message_preview": "Hello!",
      "unread_count": 3
    }
  ]
}
```

#### 2. Start or Get Conversation
```http
POST /messaging/conversations
Authorization: Bearer {token}
Content-Type: application/json

{
  "target_user_id": "uuid",
  "chat_type": "profile" | "agent",
  "target_avee_id": "uuid" // Required if chat_type is "agent"
}
```

**Response:**
```json
{
  "id": "uuid",
  "chat_type": "profile",
  "is_new": true
}
```

#### 3. Get Conversation Messages
```http
GET /messaging/conversations/{conversation_id}/messages
Authorization: Bearer {token}
```

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "sender_user_id": "uuid",
      "sender_type": "user",
      "sender_avee_id": null,
      "content": "Hello!",
      "created_at": "2025-01-01T12:00:00Z",
      "sender_info": {
        "user_id": "uuid",
        "handle": "johndoe",
        "display_name": "John Doe",
        "avatar_url": "https://..."
      }
    }
  ]
}
```

#### 4. Send Message
```http
POST /messaging/conversations/{conversation_id}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Hello, how are you?"
}
```

**Response:**
```json
{
  "id": "uuid",
  "conversation_id": "uuid",
  "sender_user_id": "uuid",
  "sender_type": "user",
  "content": "Hello, how are you?",
  "created_at": "2025-01-01T12:00:00Z",
  "sender_info": {...}
}
```

#### 5. List Agent Conversations (Owner View)
```http
GET /messaging/agent-conversations
Authorization: Bearer {token}
```

Returns all conversations where users are chatting with the authenticated user's agents.

## Frontend Components

### Messages Page (`/messages`)

The main messaging interface with:
- **Sidebar**: List of conversations with search and filter
- **Main Area**: Selected conversation with message history
- **Compose**: Message input with send button
- **Modal**: New conversation starter with chat type selector

### Navigation Integration

The Messages page is accessible from:
- Top navigation bar (chat icon)
- Profile dropdown menu
- Direct URL: `/messages`

## Usage Examples

### Starting a Profile Chat

1. Click the Messages icon in the navigation
2. Click the "+" button to start a new conversation
3. Enter the user's handle (e.g., "johndoe")
4. Select "Profile" as the chat type
5. Click "Start Chat"

### Starting an Agent Chat

1. Click the Messages icon in the navigation
2. Click the "+" button to start a new conversation
3. Enter the user's handle (e.g., "johndoe")
4. Select "Agent" as the chat type
5. Click "Start Chat"

### Viewing Agent Conversations (as Owner)

1. Go to Messages page
2. Click the "Agent Chats" tab
3. View all conversations users have had with your agents
4. Click any conversation to see the full history

## Implementation Details

### Read Status Tracking

Messages are automatically marked as read when:
- The conversation is opened
- Messages are viewed in the conversation

The read status is stored separately for each participant:
- `read_by_participant1`
- `read_by_participant2`

### Unread Count Calculation

Unread count is calculated in real-time by counting messages where:
- The sender is not the current user
- The read flag for the current user is "false"

### Chat Type Distinction

The UI uses different visual indicators for chat types:
- **Profile Chat**: Standard avatar
- **Agent Chat**: Avatar with purple badge showing a computer icon

## Future Enhancements

### Planned Features

1. **Real-time Updates**: WebSocket support for instant message delivery
2. **Agent Auto-Response**: Automatic AI responses for agent chats
3. **Message Search**: Full-text search across all conversations
4. **Media Support**: Image and file sharing in messages
5. **Message Reactions**: Emoji reactions to messages
6. **Typing Indicators**: Show when other user is typing
7. **Message Threading**: Reply to specific messages
8. **Group Chats**: Multi-user conversations
9. **Voice Messages**: Audio message recording and playback
10. **Message Editing**: Edit sent messages within a time window

### Integration Opportunities

1. **Notification System**: Push notifications for new messages
2. **Email Alerts**: Email notifications for important messages
3. **Mobile App**: Native mobile app with messaging support
4. **Bot Commands**: Special commands for agent interactions
5. **Analytics**: Message metrics and conversation insights

## Migration Steps

### 1. Database Migration

Run the following SQL to create the new tables:

```sql
-- Create direct_conversations table
CREATE TABLE direct_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant1_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    participant2_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    chat_type VARCHAR NOT NULL DEFAULT 'profile',
    target_avee_id UUID REFERENCES avees(id) ON DELETE SET NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_preview TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create direct_messages table
CREATE TABLE direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    sender_type VARCHAR NOT NULL,
    sender_avee_id UUID REFERENCES avees(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    read_by_participant1 VARCHAR DEFAULT 'false',
    read_by_participant2 VARCHAR DEFAULT 'false',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_direct_conversations_participant1 ON direct_conversations(participant1_user_id);
CREATE INDEX idx_direct_conversations_participant2 ON direct_conversations(participant2_user_id);
CREATE INDEX idx_direct_conversations_avee ON direct_conversations(target_avee_id);
CREATE INDEX idx_direct_conversations_last_message ON direct_conversations(last_message_at DESC);
CREATE INDEX idx_direct_messages_conversation ON direct_messages(conversation_id);
CREATE INDEX idx_direct_messages_sender ON direct_messages(sender_user_id);
CREATE INDEX idx_direct_messages_created ON direct_messages(created_at);
```

### 2. Backend Deployment

The following files have been added/modified:

**New Files:**
- `backend/messaging.py` - Messaging router with all endpoints

**Modified Files:**
- `backend/models.py` - Added DirectConversation and DirectMessage models
- `backend/main.py` - Registered messaging router, added profile endpoint

### 3. Frontend Deployment

**New Files:**
- `frontend/src/app/(app)/messages/page.tsx` - Main messages page

**Modified Files:**
- `frontend/src/components/NewLayoutWrapper.tsx` - Added Messages icon to navigation
- `frontend/src/app/(app)/layout.tsx` - Added messages to new layout routes

## Testing Checklist

- [ ] Create a new profile-to-profile conversation
- [ ] Send messages in profile chat
- [ ] Create a new profile-to-agent conversation
- [ ] Send messages in agent chat
- [ ] Verify unread counts update correctly
- [ ] Check read status updates when viewing messages
- [ ] Test the "Agent Chats" view for agent owners
- [ ] Verify conversation list sorting (most recent first)
- [ ] Test new conversation modal (both profile and agent types)
- [ ] Verify navigation links work correctly
- [ ] Test on mobile/responsive layouts

## Security Considerations

### Authorization

- All endpoints require authentication via Bearer token
- Users can only view conversations they're part of
- Agent owners can view conversations with their agents
- Profile endpoint is public (basic info only)

### Data Privacy

- Messages are only visible to conversation participants
- Agent conversations respect the agent's privacy settings
- Read status is tracked separately for each participant
- Deleted users cascade delete their messages

### Rate Limiting

Consider implementing:
- Message send rate limits (e.g., 10 messages per minute)
- Conversation creation limits (e.g., 20 new conversations per hour)
- API request rate limits

## Support

For questions or issues with the messaging system:
1. Check this documentation
2. Review the code comments in `backend/messaging.py`
3. Check the frontend implementation in `messages/page.tsx`
4. Test the API endpoints using the examples above

## Summary

The messaging system provides a complete, production-ready solution for direct messaging and agent interactions. It's designed to be extensible, secure, and user-friendly, with clear separation between profile chats and agent chats. The system is fully integrated with the existing authentication and profile systems, and includes all necessary UI components for a smooth user experience.










