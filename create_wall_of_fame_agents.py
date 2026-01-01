#!/usr/bin/env python3
"""
Wall of Fame: Create 50 Public Domain Character Agents
Each agent gets:
- 3-4 specialized MD documents (Biography + Category-specific + Personality)
- Web research using DuckDuckGo
- GPT-4o generated persona
- Full RAG knowledge base with embeddings
"""

import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, 'backend')

from backend.models import Avee, AveeLayer, AveePermission, Document, DocumentChunk
from backend.web_research import WebResearcher
from backend.rag_utils import chunk_text
from backend.openai_embed import embed_texts
from openai import OpenAI

# Load environment
load_dotenv("backend/.env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not DATABASE_URL or not OPENAI_API_KEY:
    print("❌ DATABASE_URL or OPENAI_API_KEY not found in environment")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# ============================================================================
# CHARACTER DATA - All 50 characters from spreadsheet
# ============================================================================

CHARACTERS = [
    # Mythology (1-11)
    {
        "name": "Hercules",
        "description": "Demigod hero famous for his twelve labors, symbol of raw strength, endurance, and redemption.",
        "category": "Mythology",
        "metadata": "Greek mythology; hero; strength; trials; moral growth; archetype: warrior"
    },
    {
        "name": "Odysseus",
        "description": "Strategic and eloquent hero known for intelligence, leadership, and long journeys home.",
        "category": "Mythology",
        "metadata": "Greek mythology; strategy; leadership; travel; resilience; archetype: explorer"
    },
    {
        "name": "Achilles",
        "description": "Invincible warrior defined by pride, rage, and a tragic fatal flaw.",
        "category": "Mythology",
        "metadata": "Greek epic; warrior; honor; mortality; archetype: tragic hero"
    },
    {
        "name": "Thor",
        "description": "God of thunder embodying power, protection, and balance between chaos and order.",
        "category": "Mythology",
        "metadata": "Norse mythology; strength; protection; storm; archetype: guardian"
    },
    {
        "name": "Loki",
        "description": "Trickster figure driven by wit, chaos, and transformation.",
        "category": "Mythology",
        "metadata": "Norse mythology; trickster; chaos; change; archetype: disruptor"
    },
    {
        "name": "King Arthur",
        "description": "Legendary king representing justice, unity, and rightful leadership.",
        "category": "Mythology",
        "metadata": "Arthurian legend; leadership; justice; kingship; archetype: ruler"
    },
    {
        "name": "Merlin",
        "description": "Mystical advisor blending wisdom, prophecy, and moral ambiguity.",
        "category": "Mythology",
        "metadata": "Arthurian legend; wisdom; magic; foresight; archetype: mentor"
    },
    {
        "name": "Beowulf",
        "description": "Heroic warrior confronting monsters and fate through courage and sacrifice.",
        "category": "Mythology",
        "metadata": "Epic poetry; courage; legacy; mortality; archetype: champion"
    },
    {
        "name": "Anubis",
        "description": "Guide of souls and guardian of the afterlife.",
        "category": "Mythology",
        "metadata": "Egyptian mythology; death; judgment; protection; archetype: gatekeeper"
    },
    {
        "name": "Gilgamesh",
        "description": "King seeking immortality who learns the limits of power and life.",
        "category": "Mythology",
        "metadata": "Mesopotamian epic; leadership; mortality; wisdom; archetype: seeker"
    },
    
    # Classic Literature (12-23)
    {
        "name": "Sherlock Holmes",
        "description": "Master detective defined by logic, observation, and intellectual dominance.",
        "category": "Classic Literature",
        "metadata": "detective; logic; deduction; intelligence; archetype: analyst"
    },
    {
        "name": "Don Quixote",
        "description": "Idealistic dreamer who blurs reality and imagination.",
        "category": "Classic Literature",
        "metadata": "satire; idealism; delusion; imagination; archetype: visionary"
    },
    {
        "name": "Alice",
        "description": "Curious child navigating absurd logic and identity shifts.",
        "category": "Classic Literature",
        "metadata": "fantasy; curiosity; transformation; logic; archetype: explorer"
    },
    {
        "name": "Robinson Crusoe",
        "description": "Resourceful survivor rebuilding civilization in isolation.",
        "category": "Classic Literature",
        "metadata": "survival; resilience; self-reliance; archetype: pioneer"
    },
    {
        "name": "Dorian Gray",
        "description": "Man obsessed with youth and beauty at moral cost.",
        "category": "Classic Literature",
        "metadata": "vanity; corruption; duality; archetype: fallen ideal"
    },
    {
        "name": "Dracula",
        "description": "Immortal aristocrat symbolizing fear, desire, and domination.",
        "category": "Classic Literature",
        "metadata": "vampire; immortality; power; fear; archetype: dark ruler"
    },
    {
        "name": "Frankenstein's Monster",
        "description": "Created being searching for identity and acceptance.",
        "category": "Classic Literature",
        "metadata": "creation; alienation; ethics; archetype: outcast"
    },
    {
        "name": "Dr Jekyll",
        "description": "Scientist embodying inner moral duality.",
        "category": "Classic Literature",
        "metadata": "duality; science; ethics; archetype: divided self"
    },
    {
        "name": "Captain Nemo",
        "description": "Brilliant yet tormented explorer rejecting society.",
        "category": "Classic Literature",
        "metadata": "science; isolation; rebellion; archetype: renegade"
    },
    {
        "name": "Phantom of the Opera",
        "description": "Musical genius hiding behind fear and obsession.",
        "category": "Classic Literature",
        "metadata": "art; obsession; isolation; archetype: tragic artist"
    },
    
    # Adventure (24-31)
    {
        "name": "Tarzan",
        "description": "Human raised by nature balancing instinct and civilization.",
        "category": "Adventure",
        "metadata": "nature; identity; strength; archetype: wild hero"
    },
    {
        "name": "Zorro",
        "description": "Masked vigilante fighting injustice through skill and wit.",
        "category": "Adventure",
        "metadata": "justice; rebellion; identity; archetype: masked hero"
    },
    {
        "name": "D'Artagnan",
        "description": "Ambitious swordsman rising through loyalty and courage.",
        "category": "Adventure",
        "metadata": "honor; ambition; loyalty; archetype: rising hero"
    },
    {
        "name": "Athos",
        "description": "Noble warrior haunted by past mistakes.",
        "category": "Adventure",
        "metadata": "honor; regret; nobility; archetype: fallen noble"
    },
    {
        "name": "Scarlet Pimpernel",
        "description": "Secret rescuer using disguise and intelligence.",
        "category": "Adventure",
        "metadata": "strategy; disguise; justice; archetype: covert hero"
    },
    {
        "name": "Ivanhoe",
        "description": "Knight symbolizing chivalry and national unity.",
        "category": "Adventure",
        "metadata": "chivalry; loyalty; archetype: knight"
    },
    {
        "name": "John Carter",
        "description": "Earthman navigating alien worlds and leadership.",
        "category": "Adventure",
        "metadata": "exploration; adaptation; archetype: frontier hero"
    },
    {
        "name": "Sinbad",
        "description": "Adventurer driven by curiosity and risk.",
        "category": "Adventure",
        "metadata": "travel; danger; fortune; archetype: adventurer"
    },
    {
        "name": "Aladdin",
        "description": "Clever survivor empowered by opportunity.",
        "category": "Adventure",
        "metadata": "luck; transformation; archetype: underdog"
    },
    {
        "name": "Robin Hood",
        "description": "Outlaw champion of fairness and redistribution.",
        "category": "Adventure",
        "metadata": "justice; rebellion; community; archetype: folk hero"
    },
    
    # Horror (32-37)
    {
        "name": "Carmilla",
        "description": "Seductive vampire exploring power and desire.",
        "category": "Horror",
        "metadata": "vampire; desire; dominance; archetype: dark temptress"
    },
    {
        "name": "Invisible Man",
        "description": "Scientist corrupted by unchecked power.",
        "category": "Horror",
        "metadata": "science; corruption; isolation; archetype: mad genius"
    },
    {
        "name": "Headless Horseman",
        "description": "Embodiment of fear and folklore.",
        "category": "Horror",
        "metadata": "fear; legend; archetype: nightmare"
    },
    {
        "name": "Dr Moreau",
        "description": "Scientist violating ethical boundaries.",
        "category": "Horror",
        "metadata": "science; ethics; hubris; archetype: transgressor"
    },
    {
        "name": "Faust",
        "description": "Scholar trading morality for knowledge.",
        "category": "Horror",
        "metadata": "knowledge; ambition; archetype: bargain-maker"
    },
    {
        "name": "Nosferatu",
        "description": "Primitive embodiment of fear and decay.",
        "category": "Horror",
        "metadata": "vampire; plague; archetype: pure menace"
    },
    
    # Sci-Fi (38-41)
    {
        "name": "Time Traveller",
        "description": "Observer of progress and decay.",
        "category": "Sci-Fi",
        "metadata": "time; futurism; archetype: observer"
    },
    {
        "name": "Martians",
        "description": "Symbol of invasion and collapse of superiority.",
        "category": "Sci-Fi",
        "metadata": "alien; invasion; archetype: existential threat"
    },
    {
        "name": "Maria",
        "description": "Artificial double questioning humanity.",
        "category": "Sci-Fi",
        "metadata": "AI; identity; archetype: synthetic being"
    },
    {
        "name": "Sandman",
        "description": "Dark force blurring dreams and madness.",
        "category": "Horror",
        "metadata": "dreams; fear; archetype: psychological shadow"
    },
    
    # Children (42-51)
    {
        "name": "Peter Pan",
        "description": "Eternal child rejecting adulthood.",
        "category": "Children",
        "metadata": "youth; freedom; archetype: eternal child"
    },
    {
        "name": "Winnie-the-Pooh",
        "description": "Gentle philosopher of simple joy.",
        "category": "Children",
        "metadata": "friendship; wisdom; archetype: gentle sage"
    },
    {
        "name": "Pinocchio",
        "description": "Boy learning morality through mistakes.",
        "category": "Children",
        "metadata": "growth; honesty; archetype: learning self"
    },
    {
        "name": "Snow White",
        "description": "Innocence confronting envy.",
        "category": "Children",
        "metadata": "purity; danger; archetype: innocent"
    },
    {
        "name": "Cinderella",
        "description": "Resilience rewarded through kindness.",
        "category": "Children",
        "metadata": "transformation; hope; archetype: rising heroine"
    },
    {
        "name": "Little Red Riding Hood",
        "description": "Naivety meeting danger.",
        "category": "Children",
        "metadata": "caution; growth; archetype: threshold child"
    },
    {
        "name": "Bambi",
        "description": "Coming-of-age through loss.",
        "category": "Children",
        "metadata": "nature; maturity; archetype: growing self"
    },
    {
        "name": "Velveteen Rabbit",
        "description": "Love giving meaning.",
        "category": "Children",
        "metadata": "attachment; reality; archetype: emotional core"
    },
    
    # Early Pop Culture (49-51)
    {
        "name": "Felix the Cat",
        "description": "Surreal trickster mascot.",
        "category": "Early Pop Culture",
        "metadata": "animation; humor; archetype: cartoon trickster"
    },
    {
        "name": "Popeye",
        "description": "Strength through character and persistence.",
        "category": "Early Pop Culture",
        "metadata": "willpower; humor; archetype: resilient fighter"
    },
]

# ============================================================================
# DOCUMENT TEMPLATES BY CATEGORY
# ============================================================================

CATEGORY_DOCUMENTS = {
    "Mythology": [
        {"suffix": "myths_legends", "title": "Myths and Legends", "queries": ["{name} myths", "{name} legends", "{name} stories"]},
        {"suffix": "powers_feats", "title": "Powers and Feats", "queries": ["{name} powers", "{name} abilities", "{name} feats"]}
    ],
    "Classic Literature": [
        {"suffix": "stories", "title": "Stories and Plot", "queries": ["{name} story", "{name} plot", "{name} book"]},
        {"suffix": "quotes_analysis", "title": "Quotes and Analysis", "queries": ["{name} quotes", "{name} analysis", "{name} character"]}
    ],
    "Adventure": [
        {"suffix": "adventures", "title": "Adventures and Quests", "queries": ["{name} adventures", "{name} quests", "{name} exploits"]},
        {"suffix": "skills_methods", "title": "Skills and Methods", "queries": ["{name} skills", "{name} tactics", "{name} abilities"]}
    ],
    "Horror": [
        {"suffix": "lore", "title": "Horror Lore", "queries": ["{name} lore", "{name} origin", "{name} mythology"]},
        {"suffix": "manifestations", "title": "Manifestations", "queries": ["{name} powers", "{name} abilities", "{name} appearances"]}
    ],
    "Sci-Fi": [
        {"suffix": "concepts", "title": "Sci-Fi Concepts", "queries": ["{name} technology", "{name} concepts", "{name} science"]},
        {"suffix": "narratives", "title": "Narratives", "queries": ["{name} story", "{name} plot", "{name} narrative"]}
    ],
    "Children": [
        {"suffix": "tales", "title": "Tales and Stories", "queries": ["{name} story", "{name} tale", "{name} adventures"]},
        {"suffix": "lessons", "title": "Lessons and Morals", "queries": ["{name} moral", "{name} lesson", "{name} theme"]}
    ],
    "Early Pop Culture": [
        {"suffix": "cultural_impact", "title": "Cultural Impact", "queries": ["{name} history", "{name} impact", "{name} cultural"]},
        {"suffix": "media", "title": "Media Appearances", "queries": ["{name} appearances", "{name} media", "{name} evolution"]}
    ]
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_handle(name: str) -> str:
    """Convert character name to handle (lowercase, underscores)"""
    return name.lower().replace(" ", "_").replace("'", "").replace("-", "_")

def get_admin_user_id(session: Session) -> uuid.UUID:
    """Get admin user ID from database"""
    result = session.execute(
        text("SELECT user_id FROM profiles WHERE handle = 'loic' OR email = 'loic.ricci@gmail.com' LIMIT 1")
    ).fetchone()
    
    if not result:
        raise Exception("Admin user not found! Make sure admin profile exists.")
    
    return result[0]

def ensure_directory(path: Path):
    """Create directory if it doesn't exist"""
    path.mkdir(parents=True, exist_ok=True)

def log_message(message: str, log_file: Path):
    """Log message to both console and file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(log_line + "\n")

# ============================================================================
# WEB RESEARCH FUNCTIONS
# ============================================================================

def research_and_create_md(
    character: Dict,
    handle: str,
    output_dir: Path,
    log_file: Path
) -> List[Path]:
    """
    Research character and create multiple MD documents.
    Returns list of created MD file paths.
    """
    researcher = WebResearcher()
    created_files = []
    
    # Document 1: Biography (MANDATORY)
    log_message(f"   📖 Researching biography...", log_file)
    bio_queries = [
        f"{character['name']} biography",
        f"{character['name']} history",
        f"{character['name']} origin"
    ]
    
    bio_sources = []
    for query in bio_queries[:2]:  # Limit to 2 queries for speed
        try:
            time.sleep(2)  # Rate limiting
            results = researcher.research_topic(query, max_sources=2)
            bio_sources.extend(results.get('sources', []))
        except Exception as e:
            log_message(f"      ⚠️  Biography research warning: {e}", log_file)
    
    # Create biography MD
    bio_path = output_dir / f"knowledge_{handle}_biography.md"
    with open(bio_path, 'w', encoding='utf-8') as f:
        f.write(f"# {character['name']} - Biography\n\n")
        f.write(f"**Category**: {character['category']}\n")
        f.write(f"**Archetype**: {character['metadata']}\n\n")
        f.write(f"## Overview\n\n{character['description']}\n\n")
        f.write(f"## Research Sources\n\n")
        
        for i, source in enumerate(bio_sources[:3], 1):
            f.write(f"### Source {i}: {source['title']}\n")
            f.write(f"**URL**: {source['url']}\n")
            f.write(f"**Type**: {source['source_type']}\n\n")
            f.write(f"{source['content'][:2000]}...\n\n")
    
    created_files.append(bio_path)
    log_message(f"      ✅ Biography: {len(bio_sources)} sources", log_file)
    
    # Document 2-3: Category-specific documents
    category_docs = CATEGORY_DOCUMENTS.get(character['category'], [])
    for doc_spec in category_docs[:1]:  # Take first category doc
        log_message(f"   📚 Researching {doc_spec['title']}...", log_file)
        
        cat_sources = []
        for query_template in doc_spec['queries'][:2]:
            query = query_template.format(name=character['name'])
            try:
                time.sleep(2)  # Rate limiting
                results = researcher.research_topic(query, max_sources=2)
                cat_sources.extend(results.get('sources', []))
            except Exception as e:
                log_message(f"      ⚠️  Research warning: {e}", log_file)
        
        # Create category MD
        cat_path = output_dir / f"knowledge_{handle}_{doc_spec['suffix']}.md"
        with open(cat_path, 'w', encoding='utf-8') as f:
            f.write(f"# {character['name']} - {doc_spec['title']}\n\n")
            f.write(f"**Category**: {character['category']}\n\n")
            f.write(f"## Research Sources\n\n")
            
            for i, source in enumerate(cat_sources[:3], 1):
                f.write(f"### Source {i}: {source['title']}\n")
                f.write(f"**URL**: {source['url']}\n")
                f.write(f"**Type**: {source['source_type']}\n\n")
                f.write(f"{source['content'][:2000]}...\n\n")
        
        created_files.append(cat_path)
        log_message(f"      ✅ {doc_spec['title']}: {len(cat_sources)} sources", log_file)
    
    # Document 3/4: Personality (MANDATORY)
    log_message(f"   🎭 Researching personality...", log_file)
    personality_queries = [
        f"{character['name']} personality",
        f"{character['name']} character traits"
    ]
    
    personality_sources = []
    for query in personality_queries:
        try:
            time.sleep(2)  # Rate limiting
            results = researcher.research_topic(query, max_sources=2)
            personality_sources.extend(results.get('sources', []))
        except Exception as e:
            log_message(f"      ⚠️  Personality research warning: {e}", log_file)
    
    # Create personality MD
    personality_path = output_dir / f"knowledge_{handle}_personality.md"
    with open(personality_path, 'w', encoding='utf-8') as f:
        f.write(f"# {character['name']} - Personality and Character\n\n")
        f.write(f"**Category**: {character['category']}\n")
        f.write(f"**Metadata**: {character['metadata']}\n\n")
        f.write(f"## Character Overview\n\n{character['description']}\n\n")
        f.write(f"## Research Sources\n\n")
        
        for i, source in enumerate(personality_sources[:3], 1):
            f.write(f"### Source {i}: {source['title']}\n")
            f.write(f"**URL**: {source['url']}\n")
            f.write(f"**Type**: {source['source_type']}\n\n")
            f.write(f"{source['content'][:2000]}...\n\n")
    
    created_files.append(personality_path)
    log_message(f"      ✅ Personality: {len(personality_sources)} sources", log_file)
    
    return created_files

# ============================================================================
# AGENT CREATION FUNCTIONS
# ============================================================================

def create_agent(
    character: Dict,
    handle: str,
    admin_user_id: uuid.UUID,
    session: Session,
    log_file: Path
) -> Optional[uuid.UUID]:
    """Create agent record in database. Returns agent UUID."""
    
    try:
        # Check if agent already exists
        existing = session.execute(
            text("SELECT id FROM avees WHERE handle = :handle"),
            {"handle": handle}
        ).fetchone()
        
        if existing:
            log_message(f"   ⚠️  Agent '{handle}' already exists, skipping creation", log_file)
            return existing[0]
        
        # Create agent
        agent_id = uuid.uuid4()
        bio = f"{character['description']} [{character['category']}]"
        
        session.execute(
            text("""
                INSERT INTO avees (id, owner_user_id, handle, display_name, bio, persona, created_at)
                VALUES (:id, :owner_user_id, :handle, :display_name, :bio, :persona, NOW())
            """),
            {
                "id": str(agent_id),
                "owner_user_id": str(admin_user_id),
                "handle": handle,
                "display_name": character['name'],
                "bio": bio,
                "persona": "Persona will be generated after knowledge base creation."
            }
        )
        
        # Create 3 layers
        for layer in ['public', 'friends', 'intimate']:
            layer_id = uuid.uuid4()
            session.execute(
                text("""
                    INSERT INTO avee_layers (id, avee_id, layer, created_at)
                    VALUES (:id, :avee_id, :layer, NOW())
                """),
                {
                    "id": str(layer_id),
                    "avee_id": str(agent_id),
                    "layer": layer
                }
            )
        
        # Set admin permission to intimate
        perm_id = uuid.uuid4()
        session.execute(
            text("""
                INSERT INTO avee_permissions (id, avee_id, viewer_user_id, max_layer, created_at)
                VALUES (:id, :avee_id, :viewer_user_id, :max_layer, NOW())
            """),
            {
                "id": str(perm_id),
                "avee_id": str(agent_id),
                "viewer_user_id": str(admin_user_id),
                "max_layer": "intimate"
            }
        )
        
        session.commit()
        log_message(f"   ✅ Agent created: {agent_id}", log_file)
        return agent_id
        
    except Exception as e:
        session.rollback()
        log_message(f"   ❌ Error creating agent: {e}", log_file)
        return None

def upload_documents_to_db(
    md_files: List[Path],
    agent_id: uuid.UUID,
    admin_user_id: uuid.UUID,
    session: Session,
    log_file: Path
) -> int:
    """Upload MD documents to database with chunking and embeddings. Returns chunk count."""
    
    total_chunks = 0
    
    for md_file in md_files:
        try:
            # Read MD content
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Create document record
            doc_id = uuid.uuid4()
            title = md_file.stem.replace("knowledge_", "").replace("_", " ").title()
            
            session.execute(
                text("""
                    INSERT INTO documents (id, owner_user_id, avee_id, layer, title, content, source, created_at)
                    VALUES (:id, :owner_user_id, :avee_id, :layer, :title, :content, :source, NOW())
                """),
                {
                    "id": str(doc_id),
                    "owner_user_id": str(admin_user_id),
                    "avee_id": str(agent_id),
                    "layer": "public",
                    "title": title,
                    "content": content,
                    "source": str(md_file)
                }
            )
            
            # Chunk the content
            chunks = chunk_text(content)
            log_message(f"      📄 {md_file.name}: {len(chunks)} chunks", log_file)
            
            # Embed chunks
            if chunks:
                vectors = embed_texts(chunks)
                
                # Store chunks with embeddings
                for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
                    vec_str = "[" + ",".join(str(x) for x in vec) + "]"
                    
                    chunk_id = uuid.uuid4()
                    session.execute(
                        text("""
                            INSERT INTO document_chunks
                              (id, document_id, avee_id, layer, chunk_index, content, embedding, created_at)
                            VALUES
                              (:id, :document_id, :avee_id, :layer, :chunk_index, :content, (:embedding)::vector, NOW())
                        """),
                        {
                            "id": str(chunk_id),
                            "document_id": str(doc_id),
                            "avee_id": str(agent_id),
                            "layer": "public",
                            "chunk_index": i,
                            "content": chunk,
                            "embedding": vec_str
                        }
                    )
                
                total_chunks += len(chunks)
            
            session.commit()
            
        except Exception as e:
            session.rollback()
            log_message(f"      ❌ Error uploading {md_file.name}: {e}", log_file)
    
    return total_chunks

def generate_persona(
    character: Dict,
    md_files: List[Path],
    agent_id: uuid.UUID,
    session: Session,
    log_file: Path
):
    """Generate GPT-4o persona from all MD documents and update agent."""
    
    try:
        # Combine all MD content
        all_knowledge = ""
        for md_file in md_files:
            with open(md_file, 'r', encoding='utf-8') as f:
                all_knowledge += f.read() + "\n\n"
        
        # Truncate if too long (GPT-4o context limit)
        if len(all_knowledge) > 20000:
            all_knowledge = all_knowledge[:20000] + "\n\n[Content truncated for length]"
        
        # Generate persona
        prompt = f"""You are creating an AI persona for {character['name']}, a character from {character['category']}.

Complete Knowledge Base:
{all_knowledge}

Character Metadata: {character['metadata']}

Create a detailed persona that captures:
1. **Voice & Speaking Style**: How they communicate (formal/casual, archaic/modern, humor style)
2. **Core Personality**: Key traits, motivations, values, flaws
3. **Knowledge Domains**: What they know deeply vs. what they're unfamiliar with
4. **Interaction Style**: How they engage with users (teaching, storytelling, challenging, etc.)
5. **Self-Awareness**: Do they know they're fictional? How do they reference their story/legend?
6. **Historical/Cultural Context**: Time period awareness, cultural references they'd make

Format as a natural, flowing persona description (3-4 paragraphs). Write in third person.
Focus on making them feel authentic and distinctive.
"""
        
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert at creating rich, nuanced AI character personas."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=800
        )
        
        persona = response.choices[0].message.content.strip()
        
        # Update agent with persona
        session.execute(
            text("UPDATE avees SET persona = :persona WHERE id = :id"),
            {"persona": persona, "id": str(agent_id)}
        )
        session.commit()
        
        log_message(f"   ✅ Persona generated ({len(persona)} chars)", log_file)
        
    except Exception as e:
        log_message(f"   ❌ Error generating persona: {e}", log_file)

# ============================================================================
# MAIN PROCESSING FUNCTION
# ============================================================================

def process_character(
    character: Dict,
    admin_user_id: uuid.UUID,
    session: Session,
    data_dir: Path,
    log_file: Path
) -> Dict:
    """Process a single character. Returns status dict."""
    
    handle = create_handle(character['name'])
    log_message(f"\n{'='*80}", log_file)
    log_message(f"🎯 Processing: {character['name']} (@{handle})", log_file)
    log_message(f"   Category: {character['category']}", log_file)
    
    status = {
        "name": character['name'],
        "handle": handle,
        "success": False,
        "docs_created": 0,
        "chunks_created": 0,
        "agent_id": None
    }
    
    try:
        # Create character directory
        char_dir = data_dir / handle
        ensure_directory(char_dir)
        
        # Step 1: Web research and MD creation
        log_message(f"📚 Step 1: Web Research & MD Creation", log_file)
        md_files = research_and_create_md(character, handle, char_dir, log_file)
        status['docs_created'] = len(md_files)
        
        # Step 2: Create agent
        log_message(f"🤖 Step 2: Creating Agent", log_file)
        agent_id = create_agent(character, handle, admin_user_id, session, log_file)
        if not agent_id:
            return status
        status['agent_id'] = str(agent_id)
        
        # Step 3: Upload documents with embeddings
        log_message(f"📤 Step 3: Uploading Knowledge Base", log_file)
        chunk_count = upload_documents_to_db(md_files, agent_id, admin_user_id, session, log_file)
        status['chunks_created'] = chunk_count
        
        # Step 4: Generate persona
        log_message(f"🎭 Step 4: Generating Persona", log_file)
        generate_persona(character, md_files, agent_id, session, log_file)
        
        status['success'] = True
        log_message(f"✅ COMPLETE: {character['name']} ({len(md_files)} docs, {chunk_count} chunks)", log_file)
        
    except Exception as e:
        log_message(f"❌ FAILED: {character['name']} - {e}", log_file)
    
    return status

# ============================================================================
# BATCH PROCESSING
# ============================================================================

def process_batch(
    characters: List[Dict],
    batch_num: int,
    admin_user_id: uuid.UUID,
    session: Session,
    data_dir: Path,
    log_file: Path
):
    """Process a batch of 5 characters."""
    
    log_message(f"\n{'#'*80}", log_file)
    log_message(f"# BATCH {batch_num}: {', '.join([c['name'] for c in characters])}", log_file)
    log_message(f"{'#'*80}\n", log_file)
    
    batch_start = time.time()
    results = []
    
    for character in characters:
        char_start = time.time()
        result = process_character(character, admin_user_id, session, data_dir, log_file)
        result['time_seconds'] = int(time.time() - char_start)
        results.append(result)
    
    batch_time = int(time.time() - batch_start)
    
    # Print batch summary
    log_message(f"\n{'='*80}", log_file)
    log_message(f"📊 BATCH {batch_num} SUMMARY", log_file)
    log_message(f"{'='*80}", log_file)
    
    successes = [r for r in results if r['success']]
    failures = [r for r in results if not r['success']]
    
    log_message(f"✅ Successes: {len(successes)}/{len(characters)}", log_file)
    log_message(f"❌ Failures: {len(failures)}", log_file)
    log_message(f"⏱️  Total time: {batch_time}s ({batch_time//60}m {batch_time%60}s)", log_file)
    log_message(f"", log_file)
    
    for r in successes:
        log_message(f"   ✅ {r['name']:30s} - {r['docs_created']} docs, {r['chunks_created']} chunks ({r['time_seconds']}s)", log_file)
    
    if failures:
        log_message(f"", log_file)
        for r in failures:
            log_message(f"   ❌ {r['name']:30s} - FAILED", log_file)
    
    log_message(f"{'='*80}\n", log_file)
    
    return results

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main execution function."""
    
    # Setup
    data_dir = Path("data/wall_of_fame")
    ensure_directory(data_dir)
    
    log_file = Path("wall_of_fame_creation.log")
    
    log_message(f"\n{'#'*80}", log_file)
    log_message(f"# WALL OF FAME: 50 PUBLIC DOMAIN CHARACTER AGENTS", log_file)
    log_message(f"# Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", log_file)
    log_message(f"{'#'*80}\n", log_file)
    
    # Get admin user ID
    with Session(engine) as session:
        try:
            admin_user_id = get_admin_user_id(session)
            log_message(f"✅ Admin user ID: {admin_user_id}", log_file)
        except Exception as e:
            log_message(f"❌ Failed to get admin user: {e}", log_file)
            return
    
    # Process in batches of 5
    batch_size = 5
    all_results = []
    
    for batch_num in range(1, 11):  # 10 batches
        start_idx = (batch_num - 1) * batch_size
        end_idx = start_idx + batch_size
        batch_characters = CHARACTERS[start_idx:end_idx]
        
        with Session(engine) as session:
            batch_results = process_batch(
                batch_characters,
                batch_num,
                admin_user_id,
                session,
                data_dir,
                log_file
            )
            all_results.extend(batch_results)
        
        # Auto-continue to next batch
        if batch_num < 10:
            log_message(f"\n⏩ Auto-continuing to batch {batch_num + 1}...\n", log_file)
            time.sleep(2)  # Brief pause between batches
    
    # Final summary
    log_message(f"\n{'#'*80}", log_file)
    log_message(f"# FINAL SUMMARY: ALL 50 CHARACTERS", log_file)
    log_message(f"{'#'*80}\n", log_file)
    
    successes = [r for r in all_results if r['success']]
    failures = [r for r in all_results if not r['success']]
    
    total_docs = sum(r['docs_created'] for r in successes)
    total_chunks = sum(r['chunks_created'] for r in successes)
    
    log_message(f"✅ Successfully created: {len(successes)}/50 agents", log_file)
    log_message(f"📄 Total documents: {total_docs}", log_file)
    log_message(f"🧩 Total chunks: {total_chunks}", log_file)
    log_message(f"❌ Failed: {len(failures)}", log_file)
    
    if failures:
        log_message(f"\nFailed characters:", log_file)
        for r in failures:
            log_message(f"   - {r['name']}", log_file)
    
    log_message(f"\n🎉 Wall of Fame creation complete!", log_file)
    log_message(f"📝 Full log: {log_file}", log_file)

if __name__ == "__main__":
    main()

