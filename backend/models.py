import uuid
from sqlalchemy import Column, Text, String, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from .db import Base
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
    bio = Column(Text)
    preferred_tts_voice = Column(String, default="alloy")  # User's preferred TTS voice
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

    created_at = Column(DateTime(timezone=True), server_default=func.now())



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
