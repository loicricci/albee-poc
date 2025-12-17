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
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Avee(Base):
    __tablename__ = "avees"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False)
    handle = Column(String, nullable=False, unique=True)
    display_name = Column(String)
    avatar_url = Column(Text)
    bio = Column(Text)
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
    # and we’ll use raw SQL for similarity search.
    embedding = Column(Text)  # stores vector via SQL inserts (we'll write raw SQL)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
