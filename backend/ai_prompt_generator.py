"""
AI Prompt Generator Module

Generates prompts for image generation (DALL-E) and post descriptions (GPT-4o)
based on agent context and daily news topics.
"""

import json
import time
import asyncio
from typing import Dict, Any, Tuple
from openai import OpenAI

client = OpenAI()


class AIPromptGenerator:
    """
    Generates AI prompts for:
    1. Image generation with DALL-E 3
    2. Social media post descriptions
    
    Takes agent context and news topic to create personalized, engaging content.
    """
    
    def __init__(self):
        pass
    
    def generate_image_prompt(
        self, 
        agent_context: Dict[str, Any], 
        topic: Dict[str, str]
    ) -> str:
        """
        Generate a detailed DALL-E 3 image prompt.
        
        Args:
            agent_context: Agent profile data from ProfileContextLoader
            topic: Topic data from NewsTopicFetcher
        
                Returns:
            Detailed image generation prompt for DALL-E 3
        """
        print(f"[AIPromptGenerator] Generating image prompt...")
        start_time = time.time()
        
        # Construct meta-prompt for GPT-4o to create the image prompt
        meta_prompt = f"""You are an expert at creating detailed image generation prompts for DALL-E 3.

AGENT PROFILE:
- Name: {agent_context['display_name']}
- Bio: {agent_context['bio']}
- Persona Summary: {agent_context['persona'][:500]}
- Style Traits: {', '.join(agent_context['style_traits'])}
- Themes: {', '.join(agent_context['themes'])}

DAILY TOPIC:
- Topic: {topic['topic']}
- Description: {topic['description']}
- Category: {topic['category']}

TASK:
Create a detailed, vivid image generation prompt that:

1. INCORPORATES THE AGENT'S PERSONALITY
   - Reflects their unique style and traits
   - Includes signature visual elements from their persona
   - Captures their energy and essence

2. RELATES TO THE DAILY TOPIC
   - Connects the agent to the news topic in a creative way
   - Makes the connection feel natural and engaging
   - Can be metaphorical or literal

3. VISUAL STYLE REQUIREMENTS
   - Specify artistic style (photorealistic, artistic, cinematic, etc.)
   - Include lighting, composition, color palette details
   - Describe the scene, setting, and atmosphere
   - Add specific visual elements that make it unique

4. LEGAL SAFETY
   - NO copyrighted characters or trademarked brands
   - NO recognizable celebrities other than the agent
   - NO specific product placements
   - Use generic, creative interpretations

5. TECHNICAL SPECS
   - Image should be suitable for social media (wide format)
   - High detail and professional quality
   - Engaging and eye-catching

IMPORTANT: Your response should be ONLY the image generation prompt itself (200-300 words), not an explanation. Make it detailed, vivid, and creative!
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert prompt engineer for image generation. Create detailed, vivid prompts that produce stunning results."
                    },
                    {
                        "role": "user",
                        "content": meta_prompt
                    }
                ],
                temperature=0.8,  # Higher creativity for visual prompts
                max_tokens=500
                        )
            
            image_prompt = response.choices[0].message.content.strip()
            
            duration = time.time() - start_time
            tokens = response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'
            
            print(f"[AIPromptGenerator] ✅ Image prompt generated ({len(image_prompt)} chars, {duration:.2f}s, {tokens} tokens)")
            print(f"[AIPromptGenerator]    Preview: {image_prompt[:100]}...")
            
            return image_prompt
            
        except Exception as e:
            print(f"[AIPromptGenerator] ❌ Error generating image prompt: {e}")
            raise
    
    def generate_description(
        self, 
        agent_context: Dict[str, Any], 
        topic: Dict[str, str],
        image_prompt: str
    ) -> str:
        """
        Generate a social media post description.
        
        Args:
            agent_context: Agent profile data
            topic: Topic data
            image_prompt: The image prompt that was generated (for context)
        
                Returns:
            Engaging social media post description
        """
        print(f"[AIPromptGenerator] Generating post description...")
        start_time = time.time()
        
        # Construct meta-prompt for post description
        meta_prompt = f"""You are a social media ghostwriter. Write a post for this agent about today's topic.

AGENT PROFILE:
- Name: {agent_context['display_name']}
- Handle: @{agent_context['handle']}
- Bio: {agent_context['bio']}
- Persona: {agent_context['persona'][:600]}
- Style Traits: {', '.join(agent_context['style_traits'])}
- Themes: {', '.join(agent_context['themes'])}

DAILY TOPIC:
- Topic: {topic['topic']}
- Description: {topic['description']}
- Category: {topic['category']}

IMAGE CONTEXT:
The post will include an AI-generated image showing: {image_prompt[:200]}...

TASK:
Write an engaging social media post (150-300 words) that:

1. AUTHENTIC VOICE
   - Sounds exactly like this agent would speak
   - Uses their vocabulary, tone, and style
   - Reflects their personality traits
   - Feels genuine and natural

2. TOPIC CONNECTION
   - References the news topic naturally
   - Makes it relevant to the agent's interests/expertise
   - Can be thoughtful, humorous, or inspirational (matching their style)
   - Doesn't force the connection

3. ENGAGEMENT
   - Starts with an attention-grabbing hook
   - Includes the agent's personal take or perspective
   - Ends with something memorable or a question
   - Uses emojis if it fits the agent's style (not excessive)

4. STRUCTURE
   - 2-4 short paragraphs
   - Easy to read on mobile
   - Natural breaks and pacing

5. HASHTAGS
   - 3-5 relevant hashtags at the end
   - Mix of popular and niche tags
   - Related to both the topic and agent's themes

IMPORTANT: Write ONLY the post text itself, not meta-commentary. Make it feel like the agent wrote it themselves!
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert social media writer. Write in the authentic voice of the person, making content engaging and natural."
                    },
                    {
                        "role": "user",
                        "content": meta_prompt
                    }
                ],
                temperature=0.85,  # High creativity for engaging content
                max_tokens=600
                        )
            
            description = response.choices[0].message.content.strip()
            
            duration = time.time() - start_time
            tokens = response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'
            
            print(f"[AIPromptGenerator] ✅ Description generated ({len(description)} chars, {duration:.2f}s, {tokens} tokens)")
            print(f"[AIPromptGenerator]    Preview: {description[:100]}...")
            
            return description
            
        except Exception as e:
            print(f"[AIPromptGenerator] ❌ Error generating description: {e}")
            raise
    
    def generate_edit_prompt(
        self,
        agent_context: Dict[str, Any],
        topic: Dict[str, str],
        edit_instructions: str = ""
    ) -> str:
        """
        Generate a prompt specifically for OpenAI Image Edits API.
        
        This prompt focuses on MODIFYING an existing reference image rather than
        creating a new image from scratch. It incorporates the topic/context
        while preserving the agent's likeness in the reference image.
        
        Args:
            agent_context: Agent profile data from ProfileContextLoader
            topic: Topic data from NewsTopicFetcher
            edit_instructions: Optional custom edit instructions from agent settings
        
        Returns:
            Concise edit prompt for OpenAI Image Edits API (max ~900 chars)
        """
        print(f"[AIPromptGenerator] Generating image EDIT prompt for reference image...")
        start_time = time.time()
        
        # Construct meta-prompt for GPT-4o to create the edit prompt
        meta_prompt = f"""You are an expert at creating prompts for the OpenAI Image Edits API.

IMPORTANT: The Image Edits API MODIFIES an existing reference image. The prompt should describe:
1. What to ADD or CHANGE in the image (background, context, elements)
2. What visual elements to incorporate based on the topic
3. Keep the prompt CONCISE (under 800 characters) as the API has a 1000 char limit

AGENT PROFILE:
- Name: {agent_context['display_name']}
- Style Traits: {', '.join(agent_context['style_traits'][:4])}
- Themes: {', '.join(agent_context['themes'][:3])}

DAILY TOPIC TO INCORPORATE:
- Topic: {topic['topic']}
- Description: {topic['description'][:200]}
- Category: {topic['category']}

{f"CUSTOM EDIT INSTRUCTIONS: {edit_instructions}" if edit_instructions else ""}

TASK:
Create a concise image edit prompt that:

1. MODIFIES THE BACKGROUND/CONTEXT
   - Transform the setting to relate to the daily topic
   - Add visual elements that connect to the topic
   - Create an atmosphere matching the topic's theme

2. ADDS THEMATIC ELEMENTS
   - Include objects, colors, or effects related to the topic
   - Use metaphorical or literal visual connections
   - Make the edit feel cohesive with the agent's style

3. KEEPS THE SUBJECT
   - The person in the reference image should remain recognizable
   - Their pose and general appearance stay similar
   - Focus edits on surroundings and context

4. TECHNICAL REQUIREMENTS
   - Be specific about what to change
   - Use vivid but concise language
   - Under 800 characters total

EXAMPLES OF GOOD EDIT PROMPTS:
- "Transform the background into a vibrant music festival stage with colorful lights and crowd silhouettes celebrating live performance"
- "Add a futuristic cityscape backdrop with holographic displays showing scientific data, neon blue and purple lighting"
- "Change the setting to an elegant art gallery with impressionist paintings on the walls, soft museum lighting"

Write ONLY the edit prompt (under 800 chars), no explanation:
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at creating concise image edit prompts. Focus on describing modifications to existing images, not creating new ones from scratch."
                    },
                    {
                        "role": "user",
                        "content": meta_prompt
                    }
                ],
                temperature=0.8,
                max_tokens=300  # Shorter since we need concise output
            )
            
            edit_prompt = response.choices[0].message.content.strip()
            
            # Ensure it's not too long for OpenAI Edits API (1000 char limit)
            if len(edit_prompt) > 900:
                # Truncate at word boundary
                edit_prompt = edit_prompt[:900].rsplit(' ', 1)[0] + "..."
                print(f"[AIPromptGenerator] ⚠️  Edit prompt truncated to 900 chars")
            
            duration = time.time() - start_time
            tokens = response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'
            
            print(f"[AIPromptGenerator] ✅ Edit prompt generated ({len(edit_prompt)} chars, {duration:.2f}s, {tokens} tokens)")
            print(f"[AIPromptGenerator]    Preview: {edit_prompt[:100]}...")
            
            return edit_prompt
            
        except Exception as e:
            print(f"[AIPromptGenerator] ❌ Error generating edit prompt: {e}")
            raise

    def generate_title(self, topic: Dict[str, str], agent_context: Dict[str, Any]) -> str:
        """
        Generate a short, catchy title for the post.
        
        Args:
            topic: Topic data
            agent_context: Agent profile data
        
                Returns:
            Short title (50 chars max)
        """
        print(f"[AIPromptGenerator] Generating post title...")
        start_time = time.time()
        
        meta_prompt = f"""Create a short, catchy title for a social media post.

AGENT: {agent_context['display_name']}
TOPIC: {topic['topic']}
AGENT STYLE: {', '.join(agent_context['style_traits'][:3])}

Requirements:
- 5-10 words maximum
- Eye-catching and engaging
- Can use 1-2 emojis if they fit the agent's style
- Should hint at both the agent and topic

Example formats:
- "🎹 Rocking the Future of Music! 🎸"
- "When Art Meets Science 🎨🔬"
- "A New Chapter Begins ✨📖"

Write ONLY the title, nothing else:
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",  # Use mini for simple task
                messages=[
                    {
                        "role": "user",
                        "content": meta_prompt
                    }
                ],
                temperature=0.9,
                max_tokens=50
                        )
            
            title = response.choices[0].message.content.strip()
            
            # Ensure it's not too long
            if len(title) > 100:
                title = title[:97] + "..."
            
            duration = time.time() - start_time
            tokens = response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'
            
            print(f"[AIPromptGenerator] ✅ Title generated: {title} ({duration:.2f}s, {tokens} tokens)")
            
            return title
            
        except Exception as e:
            print(f"[AIPromptGenerator] ❌ Error generating title: {e}")
            # Fallback title
            return f"✨ {topic['topic'][:40]}..."


# Convenience functions
def generate_image_prompt(agent_context: Dict[str, Any], topic: Dict[str, str]) -> str:
    """Generate image prompt"""
    generator = AIPromptGenerator()
    return generator.generate_image_prompt(agent_context, topic)


def generate_description(
    agent_context: Dict[str, Any], 
    topic: Dict[str, str],
    image_prompt: str
) -> str:
    """Generate post description"""
    generator = AIPromptGenerator()
    return generator.generate_description(agent_context, topic, image_prompt)


def generate_title(topic: Dict[str, str], agent_context: Dict[str, Any]) -> str:
    """Generate post title"""
    generator = AIPromptGenerator()
    return generator.generate_title(topic, agent_context)


def generate_edit_prompt(
    agent_context: Dict[str, Any],
    topic: Dict[str, str],
    edit_instructions: str = ""
) -> str:
    """
    Generate an image edit prompt for OpenAI Image Edits API.
    
    This creates a prompt specifically designed to MODIFY an existing reference
    image based on the topic/context, rather than creating a new image.
    
    Args:
        agent_context: Agent profile data
        topic: Topic data
        edit_instructions: Optional custom edit instructions
    
    Returns:
        Concise edit prompt for modifying reference image
    """
    generator = AIPromptGenerator()
    return generator.generate_edit_prompt(agent_context, topic, edit_instructions)


async def generate_edit_prompt_and_title_parallel(
    agent_context: Dict[str, Any],
    topic: Dict[str, str],
    edit_instructions: str = ""
) -> Tuple[str, str]:
    """
    Generate edit prompt and title in parallel for OpenAI Image Edits mode.
    
    Args:
        agent_context: Agent profile data
        topic: Topic data
        edit_instructions: Optional custom edit instructions
    
    Returns:
        Tuple of (edit_prompt, title)
    """
    print("[AIPromptGenerator] Generating edit prompt and title in parallel...")
    start_time = time.time()
    
    loop = asyncio.get_event_loop()
    
    edit_prompt_task = loop.run_in_executor(
        None,
        generate_edit_prompt,
        agent_context,
        topic,
        edit_instructions
    )
    
    title_task = loop.run_in_executor(
        None,
        generate_title,
        topic,
        agent_context
    )
    
    # Wait for both to complete
    edit_prompt, title = await asyncio.gather(edit_prompt_task, title_task)
    
    duration = time.time() - start_time
    print(f"[AIPromptGenerator] ✅ Parallel edit prompt generation completed in {duration:.2f}s")
    
    return edit_prompt, title


async def generate_image_prompt_and_title_parallel(
    agent_context: Dict[str, Any], 
    topic: Dict[str, str]
) -> Tuple[str, str]:
    """
    Generate image prompt and title in parallel using asyncio.
    
    These two operations are independent and can run simultaneously.
    
    Args:
        agent_context: Agent profile data
        topic: Topic data
    
    Returns:
        Tuple of (image_prompt, title)
    """
    print("[AIPromptGenerator] Generating image prompt and title in parallel...")
    start_time = time.time()
    
    # Run both in thread pool since OpenAI client is synchronous
    loop = asyncio.get_event_loop()
    
    image_prompt_task = loop.run_in_executor(
        None, 
        generate_image_prompt, 
        agent_context, 
        topic
    )
    
    title_task = loop.run_in_executor(
        None,
        generate_title,
        topic,
        agent_context
    )
    
    # Wait for both to complete
    image_prompt, title = await asyncio.gather(image_prompt_task, title_task)
    
    duration = time.time() - start_time
    print(f"[AIPromptGenerator] ✅ Parallel generation completed in {duration:.2f}s")
    
    return image_prompt, title


# Testing
if __name__ == "__main__":
    from dotenv import load_dotenv
    import sys
    
    # Add backend to path
    sys.path.insert(0, 'backend')
    
    # Load environment
    load_dotenv("backend/.env", override=True)
    
    # Import other modules
    from profile_context_loader import load_agent_context
    from news_topic_fetcher import get_safe_daily_topic
    
    print("=" * 80)
    print("Testing AI Prompt Generator")
    print("=" * 80)
    
    # Load test data
    agent_handle = sys.argv[1] if len(sys.argv) > 1 else "eltonjohn"
    
    try:
        print("\n1. Loading agent context...")
        agent_context = load_agent_context(agent_handle)
        
        print("\n2. Fetching daily topic...")
        topic = get_safe_daily_topic()
        
        print("\n3. Generating image prompt...")
        image_prompt = generate_image_prompt(agent_context, topic)
        
        print("\n4. Generating title...")
        title = generate_title(topic, agent_context)
        
        print("\n5. Generating description...")
        description = generate_description(agent_context, topic, image_prompt)
        
        print("\n" + "=" * 80)
        print("RESULTS:")
        print("=" * 80)
        print(f"\nTitle:\n{title}")
        print(f"\nImage Prompt:\n{image_prompt}")
        print(f"\nDescription:\n{description}")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


