# Agent Updates Feature - UX/UI Proposal

## Overview

The **Agent Updates** feature allows agent owners to post regular updates that automatically become part of their agent's knowledge base. Updates are timestamped posts that can include news, reflections, current activities, or any contextual information the agent should know.

## Concept

Updates function like a timeline or journal for an agent:
- **Real-time knowledge**: Keep agents informed about recent events
- **Timestamped context**: Updates are dated, helping agents understand "current" information
- **Categorized**: Updates can be tagged by topic (Work, Personal, Projects, etc.)
- **Layer-controlled**: Updates respect the agent's privacy layers
- **Auto-indexed**: Automatically embedded and made searchable via RAG

## Database Schema

### New Table: `agent_updates`

```sql
CREATE TABLE agent_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    
    -- Content
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    topic TEXT,  -- e.g., "work", "personal", "project", "family"
    
    -- Access control
    layer avee_layer NOT NULL DEFAULT 'public',
    
    -- Metadata
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexing
    CONSTRAINT check_content_length CHECK (length(content) > 0 AND length(content) <= 10000)
);

CREATE INDEX idx_agent_updates_avee_id ON agent_updates(avee_id);
CREATE INDEX idx_agent_updates_created_at ON agent_updates(created_at DESC);
CREATE INDEX idx_agent_updates_topic ON agent_updates(topic);
```

### Integration with Existing System

Updates will be automatically:
1. Stored in `agent_updates` table
2. Created as `Document` entries (for RAG integration)
3. Chunked and embedded in `document_chunks` (for semantic search)
4. Tagged with metadata indicating they are "updates"

## Backend API Endpoints

### Create Update
```
POST /agents/{agent_id}/updates
```

**Request Body:**
```json
{
  "title": "Project progress update",
  "content": "Completed the Qatar proposal. Working on ESG initiatives for desalination...",
  "topic": "work",
  "layer": "public"
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Project progress update",
  "content": "...",
  "topic": "work",
  "layer": "public",
  "created_at": "2025-12-22T...",
  "chunks_created": 2
}
```

### List Updates
```
GET /agents/{agent_id}/updates?layer=public&limit=20&offset=0&topic=work
```

**Response:**
```json
{
  "total": 45,
  "items": [
    {
      "id": "uuid",
      "title": "Project progress update",
      "content": "...",
      "topic": "work",
      "layer": "public",
      "is_pinned": false,
      "created_at": "2025-12-22T...",
      "updated_at": null
    }
  ]
}
```

### Update an Update
```
PUT /agents/{agent_id}/updates/{update_id}
```

### Delete an Update
```
DELETE /agents/{agent_id}/updates/{update_id}
```

### Pin/Unpin Update
```
POST /agents/{agent_id}/updates/{update_id}/pin
```

## Frontend UI/UX Design

### 1. New "Updates" Card on Agent Editor Page

**Location:** Between "Training Data" and "Permissions" cards

**Design:**

```
┌─────────────────────────────────────────────────────────────┐
│ 📰 Agent Updates                                       [+]   │
│ Share what's new - updates become part of agent knowledge   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 📌 Pinned: Preparing for Abu Dhabi Breakpoint         │ │
│ │ Work · Public · 2 days ago                             │ │
│ │ Finalizing plans for the Breakpoint event...          │ │
│ │                                        [Edit] [Unpin]  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Qatar Mining Proposal Complete                         │ │
│ │ Work · Public · 5 days ago                             │ │
│ │ Completed proposal for Qatar mining site in            │ │
│ │ partnership with local partners. Also reviewing...     │ │
│ │                                   [Edit] [Pin] [Delete]│ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Family Update                                          │ │
│ │ Personal · Friends · 1 week ago                        │ │
│ │ My daughter is 19 months today! She's riding her      │ │
│ │ scooter and learning multiple languages...            │ │
│ │                                   [Edit] [Pin] [Delete]│ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│                            [Load More]                       │
└─────────────────────────────────────────────────────────────┘
```

### 2. Create/Edit Update Modal

**Triggered by:** Clicking `[+]` button

**Design:**

```
┌───────────────────────────────────────────────────────────────┐
│  ✨ Create Update                                        [×]  │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  Title *                                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Project progress update                                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Content * (Markdown supported)                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Completed the Qatar proposal. Working on ESG initiatives │ │
│  │ for desalination and container solutions. Also preparing │ │
│  │ for Breakpoint event in Abu Dhabi next month.            │ │
│  │                                                            │ │
│  │ Key achievements:                                          │ │
│  │ - Finalized mining site location                          │ │
│  │ - Secured local partnerships                              │ │
│  │ - ESG framework approved                                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│  1,234 / 10,000 characters                                     │
│                                                                │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐ │
│  │ Topic        │ Layer        │ □ Pin Update │             │ │
│  │ ┌──────────┐ │ ┌──────────┐ │              │             │ │
│  │ │ Work  ▼ │ │ │ Public ▼│ │              │             │ │
│  │ └──────────┘ │ └──────────┘ │              │             │ │
│  └──────────────┴──────────────┴──────────────┴─────────────┘ │
│                                                                │
│  💡 Tip: This update will be automatically embedded and made   │
│     searchable, allowing your agent to reference it in chats.  │
│                                                                │
│                                  [Cancel] [Create Update]      │
└───────────────────────────────────────────────────────────────┘
```

### 3. Updates Timeline View (Optional Enhancement)

**Accessible from:** Agent detail page via a "View Timeline" button

Shows updates in a clean timeline format with filtering options:

```
┌─────────────────────────────────────────────────────────────┐
│ @loic-ricci's Timeline                              [Filter]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Filters: [All Topics ▼] [All Layers ▼] [Last 30 days ▼]   │
│                                                              │
│  📅 December 2025                                            │
│  ├─ Dec 22 ─────────────────────────────────────────       │
│  │  📌 Preparing for Abu Dhabi Breakpoint                   │
│  │     Work · Public                                         │
│  │                                                           │
│  ├─ Dec 17 ─────────────────────────────────────────       │
│  │  ✅ Qatar Mining Proposal Complete                       │
│  │     Work · Public                                         │
│  │                                                           │
│  │  👨‍👩‍👧 Family Update                                         │
│  │     Personal · Friends                                    │
│  │                                                           │
│  ├─ Dec 11 ─────────────────────────────────────────       │
│  │  🎯 Today's Achievements                                 │
│  │     Work · Public                                         │
│  │                                                           │
│  📅 November 2025                                            │
│  ├─ Nov 28 ─────────────────────────────────────────       │
│  │  ...                                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. Topic Categories (Predefined + Custom)

**Predefined Topics:**
- 🏢 Work
- 👨‍👩‍👧 Family
- 💼 Projects
- 🎯 Goals
- 📚 Learning
- 🌍 Travel
- 💭 Thoughts
- 📰 News
- ➕ Custom...

**Custom Topics:**
- Users can create their own topic categories
- Topics appear as tags/badges with emoji support

### 5. Mobile-Responsive Design

- Cards stack vertically on mobile
- Swipe gestures for quick actions (pin, delete)
- Bottom sheet modal for creating updates
- Compact timeline view

## User Experience Flows

### Flow 1: Creating a Quick Update

1. Agent owner navigates to their agent's editor page
2. Scrolls to "Updates" card
3. Clicks `[+ New Update]` button
4. Modal opens with simple form
5. Types title and content (markdown supported)
6. Selects topic from dropdown or creates custom
7. Chooses layer (defaults to public)
8. Clicks "Create Update"
9. Update appears immediately in the list
10. System automatically:
    - Saves to database
    - Creates Document entry
    - Embeds and indexes content
    - Makes available to agent in real-time

**Time to create:** ~30 seconds

### Flow 2: Agent Referencing an Update

**Scenario:** User chats with agent about recent work

**User:** "What projects are you working on this month?"

**Agent:** "Based on my recent updates, I'm currently focused on several key projects:

1. **Qatar Mining Proposal** - I completed the proposal for a unique mining site in partnership with local partners. This is a major milestone!

2. **ESG Initiatives** - I'm working on ESG frameworks for desalination and container solutions. This ties into our sustainability goals.

3. **Breakpoint Event Preparation** - I'm preparing for the Breakpoint event in Abu Dhabi next month. Lots of planning and coordination involved.

On the personal side, my daughter just turned 19 months old and is doing amazingly well with her language development and scooter riding!

Would you like more details on any of these projects?"

**How it works:** The agent's RAG system retrieved relevant update chunks and incorporated them into the response with temporal awareness.

### Flow 3: Managing Old Updates

1. Owner reviews updates older than 6 months
2. Can edit to add more context
3. Can delete outdated information
4. Can change layer (e.g., make personal info more private)
5. Deleted updates are removed from RAG index

## Visual Design Elements

### Color Scheme for Updates Card
- **Header:** Gradient from `#e6f3ff` (light blue) to `#f0e6ff` (light purple)
- **Border:** `#cbd5e1` (gray-300)
- **Pinned updates:** Yellow/gold accent (`#fef3c7` background)
- **Topic badges:** Contextual colors based on category

### Iconography
- 📰 Updates card header icon
- 📌 Pinned updates
- 🏢 Work topic
- 👨‍👩‍👧 Family topic
- 💼 Projects topic
- ⏰ Timestamp icon
- 🔒 Layer indicator

### Animations
- Slide-up animation when creating new update
- Fade-in for newly created updates
- Smooth expand/collapse for update details
- Pin animation (yellow glow effect)

## Implementation Priority

### Phase 1: Core Functionality (Week 1)
✅ Database schema and migrations
✅ Backend API endpoints (CRUD)
✅ Basic Updates card on agent editor
✅ Simple create/edit modal
✅ Integration with Document/RAG system

### Phase 2: Enhanced UX (Week 2)
✅ Pin/unpin functionality
✅ Topic categories with emojis
✅ Update filtering and search
✅ Timeline view
✅ Markdown rendering in updates

### Phase 3: Advanced Features (Week 3)
✅ Bulk operations (delete multiple)
✅ Export updates to markdown
✅ Update templates (quick-start templates)
✅ Update statistics and analytics
✅ Scheduled updates (post later)

### Phase 4: Polish (Week 4)
✅ Mobile optimizations
✅ Keyboard shortcuts
✅ Rich text editor (optional)
✅ Update notifications for followers
✅ Update feed for users (see updates from agents they follow)

## Key Benefits

1. **Always Current**: Agents stay up-to-date with their owner's latest activities
2. **Contextual Awareness**: Temporal information helps agents understand "now" vs "then"
3. **Easy Maintenance**: Quick updates are easier than editing large documents
4. **Natural Timeline**: Creates a narrative history of the agent
5. **Privacy Control**: Layer system ensures sensitive updates stay private
6. **Automatic Indexing**: No manual work to make updates searchable
7. **Better Conversations**: Agents can reference recent events naturally

## Example Use Cases

### Use Case 1: Professional Agent
An entrepreneur's agent receives daily business updates:
- "Closed Series A funding - $5M"
- "Hired new CTO - Jane Smith"
- "Launched new product feature - AI analytics"

When users chat, the agent references current business status accurately.

### Use Case 2: Personal Agent
A personal agent gets life updates:
- "Moved to New York City"
- "Started learning Spanish"
- "Training for marathon in April"

The agent understands current location, interests, and goals.

### Use Case 3: Creator Agent
A content creator's agent receives:
- "Published new article: 'The Future of AI'"
- "YouTube video hit 100K views"
- "Speaking at TechConf next week"

The agent can discuss recent work and upcoming events.

## Technical Considerations

### Performance
- Updates list paginated (20 per page)
- Lazy loading for timeline view
- Debounced search/filter
- Cached topic list

### Storage
- Max 10,000 characters per update
- Chunked if > 1000 characters
- Embedded using existing OpenAI pipeline

### Security
- Owner-only creation/editing
- Layer-based visibility
- Cascade deletion with agent

### Migration from Contributions
Existing `data/contributions/*.md` files could be imported as updates:
- Parse frontmatter (title, topic, date)
- Create update entries
- Maintain source attribution

## Conclusion

The **Agent Updates** feature transforms agents from static personalities into living, evolving entities that stay synchronized with their owners' lives. The UX is designed to be:

- **Fast**: Create an update in 30 seconds
- **Intuitive**: Familiar timeline/feed interface
- **Powerful**: Automatic RAG integration
- **Flexible**: Works for any type of agent (professional, personal, creator)

This feature bridges the gap between long-form training documents and real-time context, making agents truly dynamic.







