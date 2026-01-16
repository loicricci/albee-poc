import uuid
from sqlalchemy import Column, Text, String, ForeignKey, DateTime, func, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID
from backend.db import Base
from sqlalchemy import Enum
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy import Integer



# --- Social primitives ---

class Profile(Base):
    __tablename__ = "profiles"
    user_id = Column(UUID(as_uuid=True), primary_key=True)  # Supabase auth uid
    handle = Column(String, nullable=False, unique=True)
    display_name = Column(String)
    avatar_url = Column(Text)
    banner_url = Column(Text)  # Profile banner/cover image
    bio = Column(Text)
    preferred_tts_voice = Column(String, default="alloy")  # User's preferred TTS voice
    
    # Location for contextual native agents
    location = Column(String)  # City name or formatted address
    latitude = Column(String)  # Stored as string for simplicity
    longitude = Column(String)  # Stored as string for simplicity
    timezone = Column(String)  # IANA timezone (e.g., "America/New_York")
    
    # Personal Information
    birthdate = Column(String)  # Date of birth in YYYY-MM-DD format
    gender = Column(String)  # Gender
    marital_status = Column(String)  # Marital status
    nationality = Column(String)  # Nationality or citizenship
    
    # Contact Information
    phone = Column(String)  # Phone number
    email = Column(String)  # Email address
    website = Column(String)  # Personal website URL
    
    # Professional Information
    occupation = Column(String)  # Job title or occupation
    company = Column(String)  # Company or organization
    industry = Column(String)  # Industry sector
    education = Column(String)  # Highest education level
    
    # Social Media Links
    twitter_handle = Column(String)  # Twitter/X username
    linkedin_url = Column(String)  # LinkedIn profile URL
    github_username = Column(String)  # GitHub username
    instagram_handle = Column(String)  # Instagram username
    
    # Additional Information
    languages = Column(String)  # Languages spoken
    interests = Column(Text)  # Personal interests and hobbies
    
    # Terms and Conditions / GDPR Compliance
    terms_accepted_at = Column(DateTime(timezone=True))  # When user accepted T&C
    terms_version = Column(String)  # Version of T&C accepted (e.g., "2026-01-15")
    privacy_accepted_at = Column(DateTime(timezone=True))  # When user accepted Privacy Policy
    privacy_version = Column(String)  # Version of Privacy Policy accepted
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Avee(Base):
    __tablename__ = "avees"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    handle = Column(String, nullable=False, unique=True)
    display_name = Column(String)
    avatar_url = Column(Text)
    bio = Column(Text)

    # NEW (Step 2): persona prompt text stored per Avee
    persona = Column(Text)

    # NEW (Phase 3): AI-generated insights about conversation patterns
    persona_notes = Column(Text)  # AI-generated insights about conversation patterns

    # NEW (Phase 4): Voice features
    voice_sample_url = Column(Text)  # URL to original voice recording
    preferred_tts_voice = Column(String, default="alloy")  # TTS voice preference
    voice_generated_at = Column(DateTime(timezone=True))  # When profile was generated from voice

    # NEW (Phase 5): Web research features
    research_topic = Column(Text)  # Topic/person that was researched for initial data
    research_completed_at = Column(DateTime(timezone=True))  # When web research was completed
    auto_research_enabled = Column(String, default="false")  # Whether auto research was used

    # NEW (Phase 6): Unified messaging - primary agent for user
    is_primary = Column(Boolean, default=False)  # Whether this is the primary agent for the user

    # NEW (Phase 7): Twitter integration
    twitter_sharing_enabled = Column(Boolean, default=False)  # Whether this agent can share posts to Twitter
    twitter_posting_mode = Column(Text, default="manual")  # 'auto' or 'manual'

    # NEW (Phase 12): LinkedIn integration
    linkedin_sharing_enabled = Column(Boolean, default=False)  # Whether this agent can share posts to LinkedIn
    linkedin_posting_mode = Column(Text, default="manual")  # 'auto' or 'manual'
    linkedin_target_type = Column(Text, default="personal")  # 'personal' or 'organization'
    linkedin_organization_id = Column(Text)  # Organization URN if posting to company page

    # NEW (Phase 8): Autopost image engine selection
    reference_image_url = Column(Text)  # URL to reference image for OpenAI Image Edits
    reference_image_mask_url = Column(Text)  # URL to optional mask image (if null, entire image is edited)
    image_edit_instructions = Column(Text)  # Optional default instructions for image editing prompts

    # NEW (Phase 9): Branding guidelines for coherent image generation
    branding_guidelines = Column(Text)  # Colors, fonts, visual style preferences for image generation

    # NEW (Phase 10): Logo watermark for autopost images
    logo_enabled = Column(Boolean, default=False)  # Toggle to enable/disable logo on autoposts
    logo_url = Column(Text)  # URL to the uploaded PNG logo in Supabase storage
    logo_position = Column(String, default="bottom-right")  # Corner: bottom-right, bottom-left, top-right, top-left
    logo_size = Column(String, default="10")  # Size percentage: 5-100 (legacy: small, medium, large)

    # NEW (Phase 11): Auto-post topic personalization
    preferred_topics = Column(Text)  # Comma-separated topics for article selection (e.g., "music, technology, space")
    location = Column(String)  # Agent's location context for news personalization (e.g., "London, UK")

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ReferenceImage(Base):
    """Multiple reference images per agent for OpenAI Image Edits"""
    __tablename__ = "reference_images"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)
    reference_image_url = Column(Text, nullable=False)  # URL to reference image
    mask_image_url = Column(Text)  # URL to optional mask image
    edit_instructions = Column(Text)  # Optional instructions for image editing
    image_dimensions = Column(String)  # Dimensions like "1024x1024"
    is_primary = Column(Boolean, default=False)  # Whether this is the primary/default image
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AveeLayer(Base):
    __tablename__ = "avee_layers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)

    # Uses existing Postgres ENUM type created in Supabase: avee_layer
    layer = Column(
        PG_ENUM("public", "friends", "intimate", name="avee_layer", create_type=False),
        nullable=False,
    )

    system_prompt = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AgentFollower(Base):
    """Profiles follow agents (not other profiles)"""
    __tablename__ = "agent_followers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    follower_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Legacy - kept for backwards compatibility if needed
class Relationship(Base):
    __tablename__ = "relationships"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    to_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)

    # Uses existing Postgres ENUM type created in Supabase: relationship_type
    type = Column(
        PG_ENUM("follow", "friend", "block", name="relationship_type", create_type=False),
        nullable=False,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AveePermission(Base):
    __tablename__ = "avee_permissions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)
    viewer_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)

    # Uses existing Postgres ENUM type created in Supabase: avee_layer
    max_layer = Column(
        PG_ENUM("public", "friends", "intimate", name="avee_layer", create_type=False),
        nullable=False,
        default="public",
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())



# --- Existing chat tables (keep) ---

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)

    # legacy (keep for now)
    agent_id = Column(String, nullable=False)

    # NEW
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="SET NULL"), nullable=True)
    layer_used = Column(PG_ENUM("public", "friends", "intimate", name="avee_layer", create_type=False), nullable=False, default="public")

    title = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class Message(Base):
    __tablename__ = "messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    layer_used = Column(PG_ENUM("public", "friends", "intimate", name="avee_layer", create_type=False), nullable=False, default="public")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), nullable=False)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=True)

    layer = Column(
        PG_ENUM("public", "friends", "intimate", name="avee_layer", create_type=False),
        nullable=False,
        default="public",
    )

    title = Column(Text)
    content = Column(Text, nullable=False)
    source = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)

    layer = Column(
        PG_ENUM("public", "friends", "intimate", name="avee_layer", create_type=False),
        nullable=False,
        default="public",
    )

    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)

    # pgvector column exists in DB; we keep it as Text on ORM for now to avoid extra deps,
    # and we'll use raw SQL for similarity search.
    embedding = Column(Text)  # stores vector via SQL inserts (we'll write raw SQL)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# --- NEW: Advanced context management tables ---

class ConversationSummary(Base):
    """Stores conversation summaries for context optimization."""
    __tablename__ = "conversation_summaries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    summary = Column(Text, nullable=False)
    messages_included = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AveeMemory(Base):
    """Stores structured semantic memories extracted from conversations."""
    __tablename__ = "avee_memories"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)
    memory_type = Column(String, nullable=False)  # fact, preference, relationship, event
    content = Column(Text, nullable=False)
    confidence_score = Column(Integer)  # 0-100 (stored as int for simplicity)
    source_message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    embedding = Column(Text)  # pgvector for semantic search
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ConversationQuality(Base):
    """Stores conversation quality metrics for analytics."""
    __tablename__ = "conversation_quality"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    relevance_score = Column(Integer)  # 0-100
    engagement_score = Column(Integer)  # 0-100
    factual_grounding = Column(Integer)  # 0-100
    issues = Column(Text)  # JSON array as text
    suggestions = Column(Text)  # JSON array as text
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VoiceTranscription(Base):
    """Stores voice transcriptions for analytics and tracking."""
    __tablename__ = "voice_transcriptions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="SET NULL"), nullable=True)
    audio_duration = Column(Integer)  # Duration in seconds
    transcription_text = Column(Text, nullable=False)
    detected_language = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AgentUpdate(Base):
    """Stores timestamped updates from agent owners that become part of agent knowledge."""
    __tablename__ = "agent_updates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    
    # Content
    title = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    topic = Column(String)  # e.g., "work", "personal", "project", "family"
    
    # Access control
    layer = Column(PG_ENUM("public", "friends", "intimate", name="avee_layer", create_type=False), nullable=False, default="public")
    
    # Metadata
    is_pinned = Column(String, default="false")  # Store as string for consistency
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UpdateReadStatus(Base):
    """Tracks which updates have been read by which users"""
    __tablename__ = "update_read_status"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    update_id = Column(UUID(as_uuid=True), ForeignKey("agent_updates.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    read_at = Column(DateTime(timezone=True), server_default=func.now())


class AppConfig(Base):
    """Stores platform-wide configuration like logo URLs, app name, etc."""
    __tablename__ = "app_config"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_key = Column(String(100), nullable=False, unique=True)
    config_value = Column(Text)
    description = Column(Text)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TwitterConfig(Base):
    """Stores Twitter auto-fetch configuration per agent."""
    __tablename__ = "twitter_configs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Twitter API settings
    is_enabled = Column(String, default="false")  # Whether auto-fetch is enabled
    search_topics = Column(Text)  # JSON array of search topics/keywords
    twitter_accounts = Column(Text)  # JSON array of Twitter handles to monitor
    
    # Fetch settings
    max_tweets_per_fetch = Column(Integer, default=10)  # Max tweets to fetch per sync
    fetch_frequency_hours = Column(Integer, default=24)  # How often to fetch (in hours)
    last_fetch_at = Column(DateTime(timezone=True))  # Last successful fetch
    
    # Storage settings
    layer = Column(PG_ENUM("public", "friends", "intimate", name="avee_layer", create_type=False), nullable=False, default="public")
    auto_create_updates = Column(String, default="true")  # Auto-create agent updates from tweets
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TwitterFetchLog(Base):
    """Logs Twitter fetch operations for debugging and analytics."""
    __tablename__ = "twitter_fetch_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)
    
    fetch_status = Column(String, nullable=False)  # success, error, partial
    tweets_fetched = Column(Integer, default=0)
    updates_created = Column(Integer, default=0)
    error_message = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DirectConversation(Base):
    """Stores direct conversations between profiles (profile-to-profile or profile-to-agent)."""
    __tablename__ = "direct_conversations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Participants
    participant1_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    participant2_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    
    # Chat type: 'profile' (direct to profile inbox) or 'agent' (to profile's agent)
    chat_type = Column(String, nullable=False, default="profile")  # 'profile' or 'agent'
    
    # If chat_type is 'agent', this stores which agent is being chatted with
    target_avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="SET NULL"), nullable=True)
    
    # Last message info for sorting
    last_message_at = Column(DateTime(timezone=True), server_default=func.now())
    last_message_preview = Column(Text)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DirectMessage(Base):
    """Stores individual messages in direct conversations."""
    __tablename__ = "direct_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("direct_conversations.id", ondelete="CASCADE"), nullable=False)
    
    # Sender (either user or system/agent)
    sender_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=True)
    sender_type = Column(String, nullable=False)  # 'user', 'agent', 'system'
    
    # If sender is agent, store which agent
    sender_avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="SET NULL"), nullable=True)
    
    # Message content
    content = Column(Text, nullable=False)
    
    # Validation tracking
    human_validated = Column(String, default="false")  # 'true' if agent message was reviewed/approved by profile owner
    
    # Read status tracking
    read_by_participant1 = Column(String, default="false")
    read_by_participant2 = Column(String, default="false")
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# --- Orchestrator System Models ---

class OrchestratorConfig(Base):
    """Stores creator-defined rules and settings per agent."""
    __tablename__ = "orchestrator_configs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Escalation limits
    max_escalations_per_day = Column(Integer, nullable=False, default=10)
    max_escalations_per_week = Column(Integer, nullable=False, default=50)
    escalation_enabled = Column(String, nullable=False, default="true")  # Store as string for consistency
    
    # Auto-answer settings
    auto_answer_confidence_threshold = Column(Numeric(3, 2), nullable=False, default=0.75)  # Store as decimal 0.00-1.00
    clarification_enabled = Column(String, nullable=False, default="true")
    
    # Access control (JSON stored as Text)
    blocked_topics = Column(Text, default="[]")  # JSON array as string
    allowed_user_tiers = Column(Text, default='["free", "follower"]')  # JSON array as string
    
    # Availability (for future use)
    availability_windows = Column(Text, default="{}")  # JSON object as string
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class EscalationQueue(Base):
    """Tracks all escalation requests from users to creators."""
    __tablename__ = "escalation_queue"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # References
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("direct_conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)
    
    # Message content
    original_message = Column(Text, nullable=False)
    context_summary = Column(Text)  # AI-generated context
    
    # Escalation metadata
    escalation_reason = Column(String, nullable=False)  # 'novel', 'strategic', 'complex'
    status = Column(String, nullable=False, default="pending")  # 'pending', 'accepted', 'answered', 'declined', 'expired'
    
    # Timeline
    offered_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True))
    answered_at = Column(DateTime(timezone=True))
    
    # Creator response
    creator_answer = Column(Text)
    answer_layer = Column(String)  # 'public', 'friends', 'intimate'
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class OrchestratorDecision(Base):
    """Logs every routing decision for analytics and debugging."""
    __tablename__ = "orchestrator_decisions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # References
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("direct_conversations.id", ondelete="SET NULL"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)
    
    # Message and decision
    message_content = Column(Text, nullable=False)
    decision_path = Column(String, nullable=False)  # 'A', 'B', 'C', 'D', 'E', 'F'
    
    # Computed signals (stored as decimal 0.0000-1.0000)
    confidence_score = Column(Numeric(5,4))  # 0.0000-1.0000
    novelty_score = Column(Numeric(5,4))  # 0.0000-1.0000
    complexity_score = Column(Numeric(5,4))  # 0.0000-1.0000
    
    # Similar answer reference (if path C)
    similar_answer_id = Column(UUID(as_uuid=True), ForeignKey("escalation_queue.id", ondelete="SET NULL"))
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CanonicalAnswer(Base):
    """Stores creator answers that can be reused for similar questions."""
    __tablename__ = "canonical_answers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # References
    avee_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"), nullable=False)
    escalation_id = Column(UUID(as_uuid=True), ForeignKey("escalation_queue.id", ondelete="SET NULL"))
    
    # Content
    question_pattern = Column(Text, nullable=False)  # Normalized/generalized question
    answer_content = Column(Text, nullable=False)
    
    # Access control
    layer = Column(String, nullable=False)  # 'public', 'friends', 'intimate'
    
    # Usage tracking
    times_reused = Column(Integer, nullable=False, default=0)
    
    # Vector embedding for similarity search (stored as Text for raw SQL usage)
    embedding = Column(Text)  # pgvector column, we'll use raw SQL for vector ops
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# --- Social Media Posts System ---

class Post(Base):
    """Stores user posts (images, AI-generated content, etc.)"""
    __tablename__ = "posts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="SET NULL"), nullable=True)  # Which agent created this post (NULL for user posts)
    
    # Content
    title = Column(Text)
    description = Column(Text)
    image_url = Column(Text, nullable=False)
    
    # Post type: 'image' (user uploaded), 'ai_generated' (AI-created), 'text' (text-only)
    # NOTE: Do NOT use 'update' here - that's for AgentUpdate model, not Post model
    post_type = Column(String, default="image")  # 'image', 'ai_generated', 'text'
    
    # AI metadata (for AI-generated images)
    ai_metadata = Column(Text, default="{}")  # JSON as text: model, prompt, style, etc.
    
    # Privacy/visibility
    visibility = Column(String, default="public")  # 'public', 'followers', 'private'
    
    # Counters (denormalized for performance)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    share_count = Column(Integer, default=0)
    
    # Twitter integration
    posted_to_twitter = Column(Boolean, default=False)  # Whether this post has been shared to Twitter
    twitter_post_id = Column(Text)  # Twitter tweet ID
    twitter_post_url = Column(Text)  # Full Twitter URL to the tweet
    twitter_posted_at = Column(DateTime(timezone=True))  # Timestamp when posted to Twitter
    
    # LinkedIn integration
    posted_to_linkedin = Column(Boolean, default=False)  # Whether this post has been shared to LinkedIn
    linkedin_post_id = Column(Text)  # LinkedIn post/share ID
    linkedin_post_url = Column(Text)  # Full LinkedIn URL to the post
    linkedin_posted_at = Column(DateTime(timezone=True))  # Timestamp when posted to LinkedIn
    
    # Image generation engine tracking
    image_generation_engine = Column(String(50), default="dall-e-3")  # 'dall-e-3' or 'openai-edits'
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PostLike(Base):
    """Tracks likes on posts"""
    __tablename__ = "post_likes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PostComment(Base):
    """Stores comments on posts"""
    __tablename__ = "post_comments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    
    # Comment content
    content = Column(Text, nullable=False)
    
    # Reply system
    parent_comment_id = Column(UUID(as_uuid=True), ForeignKey("post_comments.id", ondelete="CASCADE"), nullable=True)
    
    # Counters
    like_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CommentLike(Base):
    """Tracks likes on comments"""
    __tablename__ = "comment_likes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("post_comments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PostShare(Base):
    """Tracks shares/reposts"""
    __tablename__ = "post_shares"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    
    # Share type
    share_type = Column(String, default="repost")  # 'repost', 'quote', 'external'
    
    # Optional comment when sharing
    comment = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# --- Twitter Integration ---

class ProfileTwitterConfig(Base):
    """Stores Twitter OAuth tokens for user profiles (one per user)"""
    __tablename__ = "profile_twitter_configs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    twitter_user_id = Column(Text, nullable=False)
    twitter_username = Column(Text, nullable=False)  # @handle
    twitter_display_name = Column(Text)
    access_token = Column(Text, nullable=False)  # Encrypted OAuth token
    access_secret = Column(Text, nullable=False)  # Encrypted OAuth secret
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TwitterOAuthState(Base):
    """Temporary OAuth state tokens for CSRF protection"""
    __tablename__ = "twitter_oauth_states"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    state = Column(Text, unique=True, nullable=False)
    oauth_token = Column(Text, nullable=False)  # Request token
    oauth_token_secret = Column(Text, nullable=False)  # Request token secret
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# --- LinkedIn Integration ---

class ProfileLinkedInConfig(Base):
    """Stores LinkedIn OAuth tokens for user profiles (one per user)"""
    __tablename__ = "profile_linkedin_configs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    linkedin_user_id = Column(Text, nullable=False)  # LinkedIn member URN (e.g., "urn:li:person:ABC123")
    linkedin_username = Column(Text, nullable=False)  # Display name
    linkedin_profile_url = Column(Text)  # Profile URL
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text)  # LinkedIn OAuth 2.0 uses refresh tokens
    token_expires_at = Column(DateTime(timezone=True))  # Access token expiration (typically 60 days)
    organizations = Column(Text)  # JSON array of company pages user can post to
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class LinkedInOAuthState(Base):
    """Temporary OAuth state tokens for CSRF protection during LinkedIn OAuth flow"""
    __tablename__ = "linkedin_oauth_states"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    state = Column(Text, unique=True, nullable=False)
    code_verifier = Column(Text, nullable=False)  # PKCE code verifier
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    """Stores notifications for user activity"""
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    
    # Notification type: agent_update, post_like, post_comment, post_repost, autopost_success, new_message
    notification_type = Column(String(50), nullable=False)
    
    # Title and message
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    
    # Link to relevant resource
    link = Column(Text)
    
    # Related entity IDs (stored as text for flexibility)
    related_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"))
    related_agent_id = Column(UUID(as_uuid=True), ForeignKey("avees.id", ondelete="CASCADE"))
    related_post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"))
    related_update_id = Column(UUID(as_uuid=True), ForeignKey("agent_updates.id", ondelete="CASCADE"))
    related_message_id = Column(UUID(as_uuid=True), ForeignKey("direct_messages.id", ondelete="CASCADE"))
    
    # Read status
    is_read = Column(String, default="false")  # Store as string for consistency
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

