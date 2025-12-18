import uuid

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from .models import Document, DocumentChunk
from .rag_utils import chunk_text
from .openai_embed import embed_texts   

from openai import OpenAI
client = OpenAI()

from .db import SessionLocal
from .auth_supabase import get_current_user_id
from .models import (
    Conversation,
    Message,
    Profile,
    Avee,
    AveeLayer,
    Relationship,
    AveePermission,
)

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# DB session dependency
# -----------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# Health & debug
# -----------------------------
@app.get("/health")
def health():
    return {"ok": True}


@app.get("/debug/db-test")
def db_test(db: Session = Depends(get_db)):
    return {"db_ok": db.execute(text("select 1")).scalar()}


# -----------------------------
# Helpers
# -----------------------------
def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


def _layer_rank(layer: str) -> int:
    return {"public": 0, "friends": 1, "intimate": 2}.get(layer, 0)


def _resolve_allowed_layer(db: Session, avee_id: uuid.UUID, viewer_user_id: uuid.UUID) -> str:
    perm = (
        db.query(AveePermission)
        .filter(
            AveePermission.avee_id == avee_id,
            AveePermission.viewer_user_id == viewer_user_id,
        )
        .first()
    )
    return perm.max_layer if perm else "public"


# -----------------------------
# Legacy conversations (kept)
# -----------------------------
@app.post("/conversations")
def create_conversation(
    agent_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    user_uuid = _parse_uuid(user_id, "user_id")

    if not agent_id or not agent_id.strip():
        raise HTTPException(status_code=400, detail="Empty agent_id")

    convo = Conversation(
        user_id=user_uuid,
        agent_id=agent_id,
        title=None,
    )
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return {"id": str(convo.id)}


@app.post("/conversations/{conversation_id}/messages")
def add_message(
    conversation_id: str,
    role: str,
    content: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    convo_uuid = _parse_uuid(conversation_id, "conversation_id")
    user_uuid = _parse_uuid(user_id, "user_id")

    convo = db.query(Conversation).filter(Conversation.id == convo_uuid).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if convo.user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Forbidden")

    if role not in ("user", "assistant", "system"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if not content or not content.strip():
        raise HTTPException(status_code=400, detail="Empty content")

    # Resolve layer dynamically at message time (option B)
    resolved_layer = "public"
    if getattr(convo, "avee_id", None):
        resolved_layer = _resolve_allowed_layer(db, convo.avee_id, user_uuid)

    msg = Message(
        conversation_id=convo_uuid,
        role=role,
        content=content.strip(),
        layer_used=resolved_layer,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": str(msg.id), "layer_used": resolved_layer}



@app.get("/conversations/{conversation_id}/messages")
def list_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    convo_uuid = _parse_uuid(conversation_id, "conversation_id")
    user_uuid = _parse_uuid(user_id, "user_id")

    convo = db.query(Conversation).filter(Conversation.id == convo_uuid).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if convo.user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Forbidden")

    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == convo_uuid)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [{
    "role": m.role,
    "content": m.content,
    "layer_used": getattr(m, "layer_used", None),
    "created_at": m.created_at
} for m in msgs]



@app.get("/me/conversations")
def list_my_conversations(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    user_uuid = _parse_uuid(user_id, "user_id")

    rows = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_uuid)
        .order_by(Conversation.created_at.desc())
        .limit(50)
        .all()
    )

    return [{
        "id": str(c.id),
        "avee_id": str(c.avee_id) if getattr(c, "avee_id", None) else None,
        "layer_used": getattr(c, "layer_used", None),
        "agent_id": c.agent_id,
        "title": c.title,
        "created_at": c.created_at,
    } for c in rows]


# -----------------------------
# Profile
# -----------------------------
@app.get("/me/profile")
def get_my_profile(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    user_uuid = _parse_uuid(user_id, "user_id")

    p = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")

    return {
        "user_id": str(p.user_id),
        "handle": p.handle,
        "display_name": p.display_name,
        "bio": p.bio,
        "avatar_url": p.avatar_url,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }

@app.post("/me/profile")
def upsert_my_profile(
    handle: str,
    display_name: str | None = None,
    bio: str | None = None,
    avatar_url: str | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    user_uuid = _parse_uuid(user_id, "user_id")

    if not handle or not handle.strip():
        raise HTTPException(status_code=400, detail="Empty handle")

    handle = handle.strip().lower()

    existing = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if existing:
        existing.handle = handle
        existing.display_name = display_name
        existing.bio = bio
        existing.avatar_url = avatar_url
        db.commit()
        return {"ok": True, "user_id": str(user_uuid), "handle": handle}

    p = Profile(
        user_id=user_uuid,
        handle=handle,
        display_name=display_name,
        bio=bio,
        avatar_url=avatar_url,
    )
    db.add(p)
    db.commit()
    return {"ok": True, "user_id": str(user_uuid), "handle": handle}


# -----------------------------
# Avees
# -----------------------------
@app.post("/avees")
def create_avee(
    handle: str,
    display_name: str | None = None,
    bio: str | None = None,
    avatar_url: str | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    user_uuid = _parse_uuid(user_id, "user_id")

    if not handle or not handle.strip():
        raise HTTPException(status_code=400, detail="Empty handle")

    handle = handle.strip().lower()

    prof = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not prof:
        raise HTTPException(status_code=400, detail="Create profile first: POST /me/profile")

    try:
        a = Avee(
            owner_user_id=user_uuid,
            handle=handle,
            display_name=display_name,
            bio=bio,
            avatar_url=avatar_url,
        )
        db.add(a)
        db.flush()  # get a.id without committing yet

        for layer in ("public", "friends", "intimate"):
            db.add(AveeLayer(avee_id=a.id, layer=layer, system_prompt=None))

        db.add(AveePermission(avee_id=a.id, viewer_user_id=user_uuid, max_layer="intimate"))

        db.commit()
        db.refresh(a)
        return {"id": str(a.id), "handle": a.handle}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/avees/{handle}")
def get_avee_by_handle(
    handle: str,
    db: Session = Depends(get_db),
):
    handle = handle.strip().lower()
    a = db.query(Avee).filter(Avee.handle == handle).first()
    if not a:
        raise HTTPException(status_code=404, detail="Avee not found")

    return {
        "id": str(a.id),
        "handle": a.handle,
        "display_name": a.display_name,
        "avatar_url": a.avatar_url,
        "bio": a.bio,
        "owner_user_id": str(a.owner_user_id),
    }


@app.get("/me/avees")
def list_my_avees(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    user_uuid = _parse_uuid(user_id, "user_id")

    rows = (
        db.query(Avee)
        .filter(Avee.owner_user_id == user_uuid)
        .order_by(Avee.created_at.desc())
        .all()
    )

    return [{
        "id": str(a.id),
        "handle": a.handle,
        "display_name": a.display_name,
        "avatar_url": a.avatar_url,
        "bio": a.bio,
        "created_at": a.created_at,
    } for a in rows]


# -----------------------------
# Relationships (network)
# -----------------------------
@app.post("/relationships/follow")
def follow_user(
    to_user_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from_uuid = _parse_uuid(user_id, "user_id")
    to_uuid = _parse_uuid(to_user_id, "to_user_id")

    if from_uuid == to_uuid:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    existing = db.query(Relationship).filter(
        Relationship.from_user_id == from_uuid,
        Relationship.to_user_id == to_uuid,
        Relationship.type == "follow",
    ).first()
    if existing:
        return {"ok": True}

    r = Relationship(from_user_id=from_uuid, to_user_id=to_uuid, type="follow")
    db.add(r)
    db.commit()
    return {"ok": True}


# -----------------------------
# Conversations with Avee (new)
# -----------------------------
@app.post("/conversations/with-avee")
def create_conversation_with_avee(
    avee_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    user_uuid = _parse_uuid(user_id, "user_id")
    avee_uuid = _parse_uuid(avee_id, "avee_id")

    a = db.query(Avee).filter(Avee.id == avee_uuid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Avee not found")

    layer = _resolve_allowed_layer(db, avee_uuid, user_uuid)

    # Reuse latest existing convo with same avee (MVP ergonomics)
    existing = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_uuid, Conversation.avee_id == avee_uuid)
        .order_by(Conversation.created_at.desc())
        .first()
    )
    if existing:
        return {"id": str(existing.id), "avee_id": str(avee_uuid), "layer_used": str(existing.layer_used)}

    convo = Conversation(
        user_id=user_uuid,
        agent_id="legacy",  # keep required field for now
        avee_id=avee_uuid,
        layer_used=layer,
        title=None,
    )
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return {"id": str(convo.id), "avee_id": str(avee_uuid), "layer_used": str(convo.layer_used)}


@app.post("/avees/{avee_id}/permissions")
def set_avee_permission(
    avee_id: str,
    viewer_user_id: str,
    max_layer: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    owner_uuid = _parse_uuid(user_id, "user_id")
    avee_uuid = _parse_uuid(avee_id, "avee_id")
    viewer_uuid = _parse_uuid(viewer_user_id, "viewer_user_id")

    if max_layer not in ("public", "friends", "intimate"):
        raise HTTPException(status_code=400, detail="Invalid max_layer")

    a = db.query(Avee).filter(Avee.id == avee_uuid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Avee not found")
    if a.owner_user_id != owner_uuid:
        raise HTTPException(status_code=403, detail="Only owner can change permissions")

    perm = db.query(AveePermission).filter(
        AveePermission.avee_id == avee_uuid,
        AveePermission.viewer_user_id == viewer_uuid,
    ).first()

    if perm:
        perm.max_layer = max_layer
    else:
        db.add(AveePermission(avee_id=avee_uuid, viewer_user_id=viewer_uuid, max_layer=max_layer))

    db.commit()
    return {"ok": True, "avee_id": str(avee_uuid), "viewer_user_id": str(viewer_uuid), "max_layer": max_layer}

@app.post("/avees/{avee_id}/documents")
def add_training_document(
    avee_id: str,
    layer: str,
    title: str | None = None,
    content: str | None = None,
    source: str | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    owner_uuid = _parse_uuid(user_id, "user_id")
    avee_uuid = _parse_uuid(avee_id, "avee_id")

    if layer not in ("public", "friends", "intimate"):
        raise HTTPException(status_code=400, detail="Invalid layer")
    if not content or not content.strip():
        raise HTTPException(status_code=400, detail="Empty content")

    a = db.query(Avee).filter(Avee.id == avee_uuid).first()
    if not a:
        raise HTTPException(status_code=404, detail="Avee not found")
    if a.owner_user_id != owner_uuid:
        raise HTTPException(status_code=403, detail="Only owner can train this Avee")

    doc = Document(
        owner_user_id=owner_uuid,
        avee_id=avee_uuid,
        layer=layer,
        title=title,
        content=content.strip(),
        source=source,
    )
    db.add(doc)
    db.flush()  # gives doc.id without commit

    chunks = chunk_text(doc.content)
    vectors = embed_texts(chunks)

    for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
        vec_str = "[" + ",".join(str(x) for x in vec) + "]"

        db.execute(
            text("""
                insert into document_chunks
                  (document_id, avee_id, layer, chunk_index, content, embedding)
                values
                  (:document_id, :avee_id, :layer, :chunk_index, :content, (:embedding)::vector)
            """),
            {
                "document_id": str(doc.id),
                "avee_id": str(avee_uuid),
                "layer": layer,
                "chunk_index": i,
                "content": chunk,
                "embedding": vec_str,
            }
        )

    db.commit()

    return {
        "ok": True,
        "document_id": str(doc.id),
        "chunks": len(chunks),
        "layer": layer,
    }


@app.post("/rag/search")
def rag_search(
    conversation_id: str,
    query: str,
    k: int = 5,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    convo_uuid = _parse_uuid(conversation_id, "conversation_id")
    viewer_uuid = _parse_uuid(user_id, "user_id")

    convo = db.query(Conversation).filter(Conversation.id == convo_uuid).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if convo.user_id != viewer_uuid:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not convo.avee_id:
        raise HTTPException(status_code=400, detail="Conversation has no avee_id")

    # embed the query
    q_vec = embed_texts([query.strip()])[0]
    q_vec_str = "[" + ",".join(str(x) for x in q_vec) + "]"

    # enforce layer filtering: only chunks <= convo.layer_used
    allowed = convo.layer_used  # public/friends/intimate

    rows = db.execute(
        text("""
            select
              dc.content,
              dc.layer,
              dc.avee_id,
              dc.document_id,
              1 - (dc.embedding <=> (:qvec)::vector) as score
            from document_chunks dc
            where dc.avee_id = :avee_id
              and (
                (:allowed = 'intimate')
                or (:allowed = 'friends' and dc.layer in ('public','friends'))
                or (:allowed = 'public' and dc.layer = 'public')
              )
            order by dc.embedding <=> (:qvec)::vector asc
            limit :k
        """),
        {
            "qvec": q_vec_str,
            "avee_id": str(convo.avee_id),
            "allowed": allowed,
            "k": k,
        }
    ).mappings().all()

    return {
        "conversation_id": str(convo.id),
        "avee_id": str(convo.avee_id),
        "allowed_layer": allowed,
        "results": [
            {
                "score": float(r["score"]) if r["score"] is not None else None,
                "layer": r["layer"],
                "content": r["content"],
                "document_id": str(r["document_id"]),
            }
            for r in rows
        ],
    }

@app.post("/chat/ask")
def chat_ask(
    conversation_id: str,
    question: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    convo_uuid = _parse_uuid(conversation_id, "conversation_id")
    viewer_uuid = _parse_uuid(user_id, "user_id")

    convo = db.query(Conversation).filter(Conversation.id == convo_uuid).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if convo.user_id != viewer_uuid:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not convo.avee_id:
        raise HTTPException(status_code=400, detail="Conversation has no avee")

    # --- RAG search ---
    q_vec = embed_texts([question.strip()])[0]
    q_vec_str = "[" + ",".join(str(x) for x in q_vec) + "]"
    allowed = convo.layer_used

    rows = db.execute(
        text("""
            select dc.content
            from document_chunks dc
            where dc.avee_id = :avee_id
              and (
                (:allowed = 'intimate')
                or (:allowed = 'friends' and dc.layer in ('public','friends'))
                or (:allowed = 'public' and dc.layer = 'public')
              )
            order by dc.embedding <=> (:qvec)::vector asc
            limit 5
        """),
        {
            "qvec": q_vec_str,
            "avee_id": str(convo.avee_id),
            "allowed": allowed,
        }
    ).fetchall()

    context = "\n".join(r[0] for r in rows) if rows else ""

    # --- System prompt per layer ---
    layer_prompt = {
        "public": "You are the public version of this person. Be factual and safe.",
        "friends": "You are speaking as a trusted friend. Be warmer but respectful.",
        "intimate": "You are a close, intimate digital presence. Be personal and deep.",
    }[allowed]

    messages = [
        {"role": "system", "content": layer_prompt},
        {"role": "system", "content": f"Context:\n{context}"},
        {"role": "user", "content": question},
    ]

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )

    answer = completion.choices[0].message.content.strip()

    # store assistant message
    db.add(Message(
        conversation_id=convo.id,
        role="assistant",
        content=answer,
        layer_used=allowed,
    ))
    db.commit()

    return {
        "conversation_id": str(convo.id),
        "layer_used": allowed,
        "answer": answer,
        "used_chunks": len(rows),
    }

@app.post("/relationships/follow-by-handle")
def follow_by_handle(
    handle: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from_uuid = _parse_uuid(user_id, "user_id")
    h = handle.strip().lower()

    p = db.query(Profile).filter(Profile.handle == h).first()
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")

    to_uuid = p.user_id
    if from_uuid == to_uuid:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    existing = db.query(Relationship).filter(
        Relationship.from_user_id == from_uuid,
        Relationship.to_user_id == to_uuid,
        Relationship.type == "follow",
    ).first()
    if existing:
        return {"ok": True}

    db.add(Relationship(from_user_id=from_uuid, to_user_id=to_uuid, type="follow"))
    db.commit()
    return {"ok": True}

@app.get("/network/following-avees")
def list_following_avees(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    me = _parse_uuid(user_id, "user_id")

    rows = (
        db.query(Avee, Profile)
        .join(Relationship, Relationship.to_user_id == Avee.owner_user_id)
        .join(Profile, Profile.user_id == Avee.owner_user_id)
        .filter(Relationship.from_user_id == me, Relationship.type == "follow")
        .order_by(Avee.created_at.desc())
        .all()
    )

    return [
        {
            "avee_id": str(a.id),
            "avee_handle": a.handle,
            "avee_display_name": a.display_name,
            "avee_avatar_url": a.avatar_url,
            "owner_handle": p.handle,
            "owner_display_name": p.display_name,
        }
        for (a, p) in rows
    ]
