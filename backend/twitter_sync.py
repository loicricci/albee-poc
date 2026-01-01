"""
Twitter Sync Service
Fetches tweets and creates agent updates automatically.
"""

import json
import logging
from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import text

from models import (
    TwitterConfig,
    TwitterFetchLog,
    Avee,
    AgentUpdate,
    Document,
    DocumentChunk
)
from twitter_service import get_twitter_service
from rag_utils import chunk_text
from openai_embed import embed_texts
import uuid

logger = logging.getLogger(__name__)


class TwitterSyncService:
    """Service for syncing tweets to agent updates."""
    
    def __init__(self, db: Session):
        self.db = db
        self.twitter_service = get_twitter_service()
    
    def fetch_tweets_for_agent(
        self,
        agent_id: str,
        force: bool = False
    ) -> Dict:
        """
        Fetch tweets for an agent based on their Twitter configuration.
        
        Args:
            agent_id: Agent UUID
            force: Force fetch even if not due yet
        
        Returns:
            Dictionary with fetch results
        """
        try:
            # Get agent
            agent = self.db.query(Avee).filter(Avee.id == agent_id).first()
            if not agent:
                raise ValueError(f"Agent not found: {agent_id}")
            
            # Get Twitter config
            config = (
                self.db.query(TwitterConfig)
                .filter(TwitterConfig.avee_id == agent_id)
                .first()
            )
            
            if not config:
                raise ValueError(f"Twitter config not found for agent: {agent_id}")
            
            if config.is_enabled != "true":
                return {
                    "status": "skipped",
                    "message": "Twitter auto-fetch is disabled for this agent"
                }
            
            # Check if fetch is due (unless forced)
            if not force and config.last_fetch_at:
                from datetime import timedelta
                next_fetch_time = config.last_fetch_at + timedelta(hours=config.fetch_frequency_hours)
                if datetime.utcnow() < next_fetch_time:
                    return {
                        "status": "skipped",
                        "message": "Not yet time for next fetch",
                        "next_fetch_at": next_fetch_time.isoformat()
                    }
            
            # Fetch tweets
            all_tweets = []
            
            # 1. Search by topics
            if config.search_topics:
                try:
                    topics = json.loads(config.search_topics)
                    for topic in topics:
                        if not topic.strip():
                            continue
                        logger.info(f"[Twitter Sync] Searching for topic: {topic}")
                        tweets = self.twitter_service.search_recent_tweets(
                            query=topic,
                            max_results=min(config.max_tweets_per_fetch, 10)  # Minimal for free tier
                        )
                        all_tweets.extend(tweets)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in search_topics: {config.search_topics}")
                except Exception as e:
                    logger.error(f"Failed to search tweets by topic: {e}")
            
            # 2. Fetch from specific accounts
            if config.twitter_accounts:
                try:
                    accounts = json.loads(config.twitter_accounts)
                    for account in accounts:
                        username = account.strip().lstrip('@')
                        if not username:
                            continue
                        logger.info(f"[Twitter Sync] Fetching tweets from @{username}")
                        tweets = self.twitter_service.get_user_tweets(
                            username=username,
                            max_results=min(config.max_tweets_per_fetch, 10)  # Minimal for free tier
                        )
                        all_tweets.extend(tweets)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in twitter_accounts: {config.twitter_accounts}")
                except Exception as e:
                    logger.error(f"Failed to fetch tweets from accounts: {e}")
            
            if not all_tweets:
                logger.info(f"[Twitter Sync] No tweets found for agent {agent_id}")
                self._log_fetch(agent_id, "success", 0, 0, "No tweets found")
                config.last_fetch_at = datetime.utcnow()
                self.db.commit()
                return {
                    "status": "success",
                    "tweets_fetched": 0,
                    "updates_created": 0,
                    "message": "No tweets found"
                }
            
            # Remove duplicates by tweet ID
            unique_tweets = {tweet['id']: tweet for tweet in all_tweets}
            all_tweets = list(unique_tweets.values())
            
            # Limit to max_tweets_per_fetch
            all_tweets = all_tweets[:config.max_tweets_per_fetch]
            
            logger.info(f"[Twitter Sync] Found {len(all_tweets)} unique tweets for agent {agent_id}")
            
            # Create agent updates from tweets
            updates_created = 0
            if config.auto_create_updates == "true":
                for tweet in all_tweets:
                    try:
                        self._create_update_from_tweet(
                            agent=agent,
                            tweet=tweet,
                            layer=config.layer
                        )
                        updates_created += 1
                    except Exception as e:
                        logger.error(f"Failed to create update from tweet {tweet['id']}: {e}")
            
            # Update last fetch time
            config.last_fetch_at = datetime.utcnow()
            self.db.commit()
            
            # Log success
            self._log_fetch(agent_id, "success", len(all_tweets), updates_created)
            
            return {
                "status": "success",
                "tweets_fetched": len(all_tweets),
                "updates_created": updates_created,
                "tweets": all_tweets
            }
            
        except Exception as e:
            logger.error(f"[Twitter Sync] Error fetching tweets for agent {agent_id}: {e}")
            self._log_fetch(agent_id, "error", 0, 0, str(e))
            raise
    
    def _create_update_from_tweet(
        self,
        agent: Avee,
        tweet: Dict,
        layer: str
    ):
        """
        Create an AgentUpdate and associated Document from a tweet.
        
        Args:
            agent: Avee instance
            tweet: Tweet dictionary
            layer: Access layer for the update
        """
        # Format tweet for agent update
        formatted = self.twitter_service.format_tweet_for_agent_update(tweet)
        
        # Check if update already exists for this tweet (avoid duplicates)
        existing = (
            self.db.query(AgentUpdate)
            .filter(AgentUpdate.avee_id == agent.id)
            .filter(AgentUpdate.title == formatted['title'])
            .first()
        )
        
        if existing:
            logger.info(f"Update already exists for tweet {tweet['id']}, skipping")
            return
        
        # Create agent update
        update = AgentUpdate(
            id=uuid.uuid4(),
            avee_id=agent.id,
            owner_user_id=agent.owner_user_id,
            title=formatted['title'],
            content=formatted['content'],
            topic=formatted['topic'],
            layer=layer,
            is_pinned="false",
        )
        self.db.add(update)
        self.db.flush()
        
        # Create document for RAG
        doc = Document(
            id=uuid.uuid4(),
            owner_user_id=agent.owner_user_id,
            avee_id=agent.id,
            layer=layer,
            title=f"Update: {formatted['title']}",
            content=f"# {formatted['title']}\n\n{formatted['content']}\n\n---\nTopic: {formatted['topic']}\nDate: {update.created_at.strftime('%Y-%m-%d')}",
            source=f"agent_update:{update.id}",
        )
        self.db.add(doc)
        self.db.flush()
        
        # Chunk and embed
        chunks = chunk_text(doc.content, max_chars=1000, overlap=100)
        embeddings = embed_texts(chunks)
        
        for idx, (chunk_content, embedding) in enumerate(zip(chunks, embeddings)):
            vec_str = "[" + ",".join(str(x) for x in embedding) + "]"
            
            self.db.execute(
                text("""
                    INSERT INTO document_chunks
                      (id, document_id, avee_id, layer, chunk_index, content, embedding)
                    VALUES
                      (:id, :document_id, :avee_id, :layer, :chunk_index, :content, (:embedding)::vector)
                """),
                {
                    "id": str(uuid.uuid4()),
                    "document_id": str(doc.id),
                    "avee_id": str(agent.id),
                    "layer": layer,
                    "chunk_index": idx,
                    "content": chunk_content,
                    "embedding": vec_str,
                }
            )
        
        self.db.commit()
        logger.info(f"Created update and document from tweet {tweet['id']}")
    
    def _log_fetch(
        self,
        agent_id: str,
        status: str,
        tweets_fetched: int,
        updates_created: int,
        error_message: str = None
    ):
        """Log a fetch operation."""
        log = TwitterFetchLog(
            id=uuid.uuid4(),
            avee_id=agent_id,
            fetch_status=status,
            tweets_fetched=tweets_fetched,
            updates_created=updates_created,
            error_message=error_message,
        )
        self.db.add(log)
        try:
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to log fetch: {e}")
            self.db.rollback()


def sync_all_agents(db: Session) -> Dict:
    """
    Sync tweets for all agents with Twitter auto-fetch enabled.
    This can be called by a scheduled job.
    
    Returns:
        Summary of sync results
    """
    sync_service = TwitterSyncService(db)
    
    # Get all enabled configs
    configs = (
        db.query(TwitterConfig)
        .filter(TwitterConfig.is_enabled == "true")
        .all()
    )
    
    results = {
        "total_agents": len(configs),
        "successful": 0,
        "failed": 0,
        "skipped": 0,
        "total_tweets": 0,
        "total_updates": 0,
    }
    
    for config in configs:
        try:
            result = sync_service.fetch_tweets_for_agent(str(config.avee_id))
            
            if result["status"] == "success":
                results["successful"] += 1
                results["total_tweets"] += result.get("tweets_fetched", 0)
                results["total_updates"] += result.get("updates_created", 0)
            elif result["status"] == "skipped":
                results["skipped"] += 1
            else:
                results["failed"] += 1
                
        except Exception as e:
            logger.error(f"Failed to sync agent {config.avee_id}: {e}")
            results["failed"] += 1
    
    logger.info(f"[Twitter Sync] Batch sync complete: {results}")
    return results

