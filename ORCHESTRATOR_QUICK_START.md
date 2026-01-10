# Orchestrator System - Quick Start Guide

## Overview

The **Orchestrator** is an intelligent message routing system that sits between users and agents, automatically deciding whether to:
- Auto-answer with AI (high confidence)
- Ask for clarification (vague question)
- Serve existing canonical answers
- Offer escalation to the creator
- Queue for creator response
- Politely refuse (limits reached)

## Installation & Setup

### 1. Database Migration

Run the Orchestrator migration:

```bash
# Connect to your Supabase database
psql $DATABASE_URL

# Run the migration
\i database_migrations/orchestrator_system.sql
```

This creates:
- `orchestrator_configs` - Creator settings per agent
- `escalation_queue` - Pending escalations
- `orchestrator_decisions` - Analytics log
- `canonical_answers` - Reusable creator answers

### 2. Backend Deployment

The Orchestrator is already integrated into the backend:

- **Core Engine**: `backend/orchestrator.py`
- **API Endpoints**: `backend/orchestrator_api.py`
- **Registered in**: `backend/main.py`

No additional setup required - it's ready to use!

### 3. Frontend Access

**For Creators:**
- Configure Orchestrator: `/my-agents/[handle]/orchestrator`
- View escalation queue: `/messages/escalations`

**For Users:**
- Messages automatically route through Orchestrator when chatting with agents
- Escalation offers appear as modal dialogs

## How It Works

### Decision Flow

```
User Message → Orchestrator Engine → Decision Path (A-F) → Action
```

**Path A - Auto-Answer**: High confidence, AI responds immediately  
**Path B - Clarify**: Vague question, AI asks for clarification  
**Path C - Canonical**: Similar answer exists, serve it  
**Path D - Offer Escalation**: Novel/complex, offer to escalate  
**Path E - Queue**: Escalation accepted, creator will answer  
**Path F - Refuse**: Limits reached or blocked

### Signal Computation

For each message, the Orchestrator computes:

- **Similarity Score** (0-1): Max similarity to existing content
- **Novelty Score** (0-1): How new/unique the question is
- **Complexity Score** (0-1): Heuristic-based complexity measure
- **Confidence Score** (0-1): AI's confidence it can answer

### Escalation Lifecycle

1. **Offered** - User asks complex question, Orchestrator offers escalation
2. **Accepted** - User accepts, enters queue
3. **Answered** - Creator provides answer
4. **Canonical** - Answer automatically saved for reuse

## Configuration Guide

### Creator Settings

Navigate to `/my-agents/[handle]/orchestrator` to configure:

**Escalation Limits**
- Daily limit (0-100)
- Weekly limit (0-500)
- Enable/disable escalations

**Auto-Answer Settings**
- Confidence threshold (50-95%) - Higher = fewer auto-answers
- Enable clarification questions

**User Access**
- Free users
- Followers only
- Paid users (coming soon)

**Blocked Topics**
- Add keywords/topics to prevent escalations

### Default Configuration

New agents start with:
- 10 escalations/day
- 50 escalations/week
- 75% confidence threshold
- Clarifications enabled
- Free users + followers allowed

## API Usage

### Route a Message

```bash
POST /orchestrator/message
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversation_id": "uuid",
  "message": "Your question here",
  "layer": "public"
}
```

**Response:**
```json
{
  "decision_path": "A",
  "confidence": 0.85,
  "reason": "High confidence AI can answer",
  "response": "AI-generated answer...",
  "action_data": {}
}
```

### Get Escalation Queue

```bash
GET /orchestrator/queue
Authorization: Bearer {token}
```

### Answer Escalation

```bash
POST /orchestrator/queue/{escalation_id}/answer
Authorization: Bearer {token}
Content-Type: application/json

{
  "answer": "Your answer here",
  "layer": "public"
}
```

### Get Metrics

```bash
GET /orchestrator/metrics/{avee_id}?days=7
Authorization: Bearer {token}
```

**Response:**
```json
{
  "total_messages": 150,
  "auto_answered": 120,
  "escalations_offered": 20,
  "escalations_accepted": 15,
  "escalations_answered": 12,
  "canonical_reused": 30,
  "auto_answer_rate": 0.80
}
```

## Testing Checklist

### Path A - Auto-Answer
- [x] High confidence question gets auto-answered
- [x] Response uses RAG context
- [x] Decision logged correctly

### Path B - Clarify
- [x] Short vague questions trigger clarification
- [x] Clarification questions are helpful
- [x] Follow-up re-evaluates

### Path C - Canonical Answer
- [x] Similar question serves existing answer
- [x] `times_reused` counter increments
- [x] Attribution shown to user

### Path D - Offer Escalation
- [x] Novel questions offer escalation
- [x] Complex questions offer escalation
- [x] User can accept/decline
- [x] Limits respected

### Path E - Queue for Creator
- [x] Accepted escalations enter queue
- [x] Context summary generated
- [x] Creator can view in dashboard
- [x] Answer creates canonical entry

### Path F - Polite Refusal
- [x] Daily limit blocks escalation
- [x] Weekly limit blocks escalation
- [x] Disabled escalations refuse
- [x] Tier restrictions work

### Configuration
- [x] Settings save correctly
- [x] Changes apply immediately
- [x] Blocked topics filter properly
- [x] User tier checks work

### Metrics
- [x] Decisions logged to DB
- [x] Metrics calculate correctly
- [x] Dashboard displays stats
- [x] Time-based filtering works

## Key Features

### For Creators

✅ **Reduce Overload**: 80%+ messages auto-answered  
✅ **Smart Escalation**: Only see truly novel/complex questions  
✅ **Answer Reuse**: Each answer becomes reusable knowledge  
✅ **Full Control**: Configure limits, thresholds, and access  
✅ **Rich Context**: See user profile + conversation history  
✅ **Analytics**: Track auto-answer rate, escalations, reuse  

### For Users

✅ **Fast Responses**: Instant AI answers for common questions  
✅ **Clarifications**: AI helps refine vague questions  
✅ **Smart Routing**: Complex questions reach the creator  
✅ **Transparency**: Clear escalation terms and status  
✅ **Quality**: Canonical answers are creator-verified  

## Metrics & Success

### Target Metrics

- **Auto-answer rate**: > 80%
- **Escalations per 100 users**: < 5
- **Answer reuse rate**: > 50%
- **Time to first answer**: < 5s (auto), < 24h (escalation)
- **Creator time saved**: > 80%

### Monitor These

- Decision path distribution (A-F)
- Confidence score trends
- Escalation acceptance rate
- Queue backlog size
- Canonical answer usage

## Troubleshooting

### Issue: Too many escalations

**Solution:**
- Increase confidence threshold (Settings > Auto-Answer)
- Add more canonical answers
- Enable clarification questions
- Review blocked topics

### Issue: Too few escalations

**Solution:**
- Decrease confidence threshold
- Check user tier permissions
- Verify limits aren't too low
- Review decision logs for Path F

### Issue: Poor auto-answer quality

**Solution:**
- Add more documents to agent knowledge base
- Lower confidence threshold cautiously
- Review and improve agent persona
- Check RAG chunk quality

### Issue: Escalations not appearing

**Solution:**
- Verify escalations are enabled
- Check user tier is allowed
- Confirm limits not exceeded
- Review blocked topics

## Future Enhancements

Coming soon:
- Payment integration for premium escalations
- SLA enforcement and tracking
- Multi-language support
- Voice message escalations
- Group escalations (FAQ generation)
- Auto-topic classification (ML)
- Adaptive thresholds
- Mobile push notifications
- Email digests for creators

## Support

For issues or questions:
1. Check this guide
2. Review code comments in `backend/orchestrator.py`
3. Check API endpoint docs in `backend/orchestrator_api.py`
4. Test with different question types
5. Monitor decision logs in `orchestrator_decisions` table

## Architecture Summary

```
┌─────────────┐
│    User     │
└─────┬───────┘
      │ message
      ▼
┌─────────────────────────┐
│  Orchestrator Engine    │
├─────────────────────────┤
│ 1. Compute signals      │
│ 2. Load user context    │
│ 3. Load creator rules   │
│ 4. Decide path (A-F)    │
│ 5. Execute action       │
│ 6. Log decision         │
└─────┬───────────────────┘
      │
      ├─ Path A → RAG + OpenAI → Auto-answer
      ├─ Path B → OpenAI → Clarification
      ├─ Path C → DB → Canonical answer
      ├─ Path D → DB → Escalation offer
      ├─ Path E → Queue → Creator answers
      └─ Path F → → Polite refusal
```

**The Orchestrator ensures creators are only interrupted when it creates real value — and that each interruption compounds into lasting knowledge.**

---

**Implementation Status**: ✅ Complete  
**Version**: 1.0.0  
**Last Updated**: 2025-12-27










