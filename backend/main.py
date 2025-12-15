import uuid

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from .db import SessionLocal
from .models import Conversation, Message
from .auth_supabase import get_current_user_id


app = FastAPI()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/debug/db-test")
def db_test(db: Session = Depends(get_db)):
    return {"db_ok": db.execute(text("select 1")).scalar()}


def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


@app.post("/conversations")
def create_conversation(
    agent_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    convo = Conversation(
        user_id=_parse_uuid(user_id, "user_id"),
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

    msg = Message(conversation_id=convo_uuid, role=role, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": str(msg.id)}


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
    return [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in msgs]
