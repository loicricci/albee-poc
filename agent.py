import os
from typing import List, Dict
import rag_multi
import url_scraper


from dotenv import load_dotenv
from openai import OpenAI


# Charger les variables d'environnement depuis .env
load_dotenv()


api_key = os.getenv("OPENAI_API_KEY")


if not api_key:
   raise ValueError("OPENAI_API_KEY is not set. Check your .env file.")


client = OpenAI(api_key=api_key)


# Agent configurations
AGENT_CONFIGS = {
    "loic": {
        "persona_path": "data/persona_loic.md",
        "knowledge_base_id": "loic",
        "name": "LOÏC-GABEE",
        "title": "GABEE // LOÏC TWIN CONSOLE"
    },
    "victor_hugo": {
        "persona_path": "data/victor_hugo/persona_victor_hugo.md",
        "knowledge_base_id": "victor_hugo",
        "name": "VICTOR HUGO",
        "title": "GABEE // VICTOR HUGO CONSOLE"
    }
}




def load_persona(path: str = "data/persona_loic.md") -> str:
   if not os.path.exists(path):
       return "You are a helpful assistant."
   with open(path, "r", encoding="utf-8") as f:
       return f.read()




def generate_reply(history: List[Dict[str, str]], user_message: str, agent_id: str = "loic", stream: bool = False):
   """
   Generate a reply from the agent.
   
   Args:
       history: Conversation history
       user_message: User's current message
       agent_id: ID of the agent to use ("loic" or "victor_hugo")
       stream: If True, returns a generator that yields tokens; if False, returns complete string
   """
   # Get agent configuration
   config = AGENT_CONFIGS.get(agent_id, AGENT_CONFIGS["loic"])
   persona = load_persona(config["persona_path"])


   messages: List[Dict[str, str]] = [
       {"role": "system", "content": persona}
   ]


   # 1) URL Scraping: Check if user message contains URLs and scrape them
   detected_urls = url_scraper.extract_urls(user_message)
   if detected_urls:
       print(f"[Agent] Detected {len(detected_urls)} URL(s): {detected_urls}")
   
   scraped_urls = url_scraper.scrape_urls_from_text(user_message, max_urls=3)
   if scraped_urls:
       print(f"[Agent] Successfully scraped {len(scraped_urls)} URL(s)")
       url_context_parts = []
       for scraped in scraped_urls:
           # Limit content length per URL to avoid token limits
           content = scraped['content']
           if len(content) > 6000:
               content = content[:6000] + "... [truncated]"
           
           url_context_parts.append(
               f"URL: {scraped['url']}\n"
               f"Title: {scraped['title']}\n"
               f"Content:\n{content}"
           )
       
       url_context = "\n\n---\n\n".join(url_context_parts)
       
       # Limit total URL context to avoid exceeding token limits
       if len(url_context) > 15000:
           url_context = url_context[:15000] + "... [content truncated due to length]"
       
       print(f"[Agent] Adding URL context ({len(url_context)} chars) to messages")
       
       messages.append({
           "role": "system",
           "content": (
               "The user has shared the following web page(s). Please read and analyze the content carefully, "
               "and provide relevant feedback or answer questions about it. Reference specific details from the content when responding.\n\n"
               f"{url_context}"
           ),
       })
   elif detected_urls:
       print(f"[Agent] URLs detected but scraping failed for: {detected_urls}")


   # 2) RAG : récupérer du contexte pertinent
   rag_results = rag_multi.search(user_message, config["knowledge_base_id"], k=4)
   context_chunks = [txt for (txt, _score) in rag_results]
   context_text = "\n\n---\n\n".join(context_chunks) if context_chunks else ""


   if context_text:
       kb_name = "knowledge base" if agent_id == "loic" else "works and writings"
       messages.append({
           "role": "system",
           "content": (
               f"Here is additional context from the {kb_name}. "
               "Use it if relevant, but do not invent facts.\n\n"
               f"{context_text}"
           ),
       })


   # 3) historique de conversation
   for msg in history:
       role = msg.get("role", "user")
       if role not in ("user", "assistant", "system"):
           role = "user"
       messages.append({"role": role, "content": msg["content"]})


   # 4) nouveau message
   messages.append({"role": "user", "content": user_message})


   if stream:
       # Streaming mode: yield tokens as they arrive
       stream_response = client.chat.completions.create(
           model="gpt-4o-mini",
           messages=messages,
           temperature=0.4,
           stream=True,
       )
       
       for chunk in stream_response:
           if chunk.choices[0].delta.content is not None:
               yield chunk.choices[0].delta.content
   else:
       # Non-streaming mode: return complete response
       response = client.chat.completions.create(
           model="gpt-4o-mini",
           messages=messages,
           temperature=0.4,
       )
       return response.choices[0].message.content.strip()
