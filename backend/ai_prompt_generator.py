"""
AI Prompt Generator Module

Generates prompts for image generation (DALL-E) and post descriptions (GPT-4o)
based on agent context and daily news topics.
"""

import json
import time
import asyncio
import re
from typing import Dict, Any, Tuple
from openai import OpenAI

client = OpenAI()


def transform_hex_to_vivid_descriptions(branding_text: str) -> str:
    """
    Transform hex color codes into vivid, emphatic descriptions that image models understand better.
    
    Image generation models (DALL-E, GPT-Image-1) don't interpret hex codes literally.
    This function converts them to vivid, descriptive language.
    
    Examples:
    - #A7FB90 (primary green) → BRIGHT NEON LIME GREEN - like a highlighter, very saturated, almost fluorescent
    - #0E0F0F (primary black) → DEEP PURE BLACK - like charcoal or ink, completely dark
    """
    # Common hex to vivid description mappings
    # We'll use color analysis to generate appropriate descriptions
    
    def hex_to_rgb(hex_code: str) -> tuple:
        """Convert hex to RGB tuple"""
        hex_code = hex_code.lstrip('#')
        return tuple(int(hex_code[i:i+2], 16) for i in (0, 2, 4))
    
    def describe_color_vividly(hex_code: str, original_name: str = "") -> str:
        """Generate a vivid description for a hex color"""
        try:
            r, g, b = hex_to_rgb(hex_code)
        except:
            return original_name or hex_code
        
        # Calculate brightness and saturation
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        brightness = (max_c + min_c) / 2 / 255
        saturation = (max_c - min_c) / 255 if max_c > 0 else 0
        
        # Determine base color
        if max_c - min_c < 30:  # Grayscale
            if brightness < 0.15:
                return f"DEEP PURE BLACK (like charcoal or ink, completely dark) {hex_code}"
            elif brightness < 0.4:
                return f"DARK CHARCOAL GRAY (deep shadow color) {hex_code}"
            elif brightness > 0.9:
                return f"BRIGHT PURE WHITE (like fresh snow, very bright) {hex_code}"
            elif brightness > 0.8:
                return f"VERY LIGHT GRAY (almost white, soft and pale) {hex_code}"
            else:
                return f"NEUTRAL MEDIUM GRAY {hex_code}"
        
        # Determine dominant color with vivid descriptions
        if g > r and g > b:
            if g > 200 and brightness > 0.6:
                return f"BRIGHT NEON LIME GREEN (like a highlighter, very saturated, almost fluorescent, eye-catching) {hex_code}"
            elif saturation > 0.3 and brightness > 0.5:
                return f"VIBRANT FRESH GREEN (like spring leaves, lively and energetic) {hex_code}"
            else:
                return f"MUTED SAGE GREEN (soft, natural, calming) {hex_code}"
        elif r > g and r > b:
            if r > 200:
                return f"BRIGHT VIVID RED (bold, attention-grabbing, like a stop sign) {hex_code}"
            else:
                return f"DEEP RICH RED (warm, intense) {hex_code}"
        elif b > r and b > g:
            if b > 200:
                return f"BRIGHT ELECTRIC BLUE (vivid, striking, like neon) {hex_code}"
            else:
                return f"DEEP OCEAN BLUE (rich, calming) {hex_code}"
        
        # Mixed colors
        if r > 200 and g > 200:
            return f"BRIGHT YELLOW (sunny, cheerful, eye-catching) {hex_code}"
        elif g > 150 and b > 150:
            return f"BRIGHT CYAN/TURQUOISE (fresh, modern, vibrant) {hex_code}"
        elif r > 150 and b > 150:
            return f"VIVID MAGENTA/PURPLE (bold, creative) {hex_code}"
        
        return f"{original_name} {hex_code}" if original_name else hex_code
    
    # Find all hex codes with their descriptions and transform them
    # Pattern: #XXXXXX followed by optional description in parentheses
    pattern = r'#([A-Fa-f0-9]{6})\s*(?:\(([^)]+)\))?'
    
    def replace_hex(match):
        hex_code = f"#{match.group(1)}"
        original_name = match.group(2) or ""
        return describe_color_vividly(hex_code, original_name)
    
    transformed = re.sub(pattern, replace_hex, branding_text)
    return transformed


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
        
        # Get branding guidelines if available
        branding = agent_context.get('branding_guidelines', '').strip()
        branding_section = ""
        if branding:
            # Transform hex codes to vivid descriptions that image models understand
            branding_transformed = transform_hex_to_vivid_descriptions(branding)
            
            branding_section = f"""
CRITICAL COLOR PALETTE - YOU MUST USE THESE EXACT COLORS:
{branding_transformed}

MANDATORY: The image MUST prominently feature these specific colors as the DOMINANT palette.
These colors should be immediately recognizable - they are the brand identity.
"""
        
        # Construct meta-prompt for GPT-4o to create the image prompt
        meta_prompt = f"""You are an expert at creating detailed image generation prompts for DALL-E 3.

AGENT PROFILE:
- Name: {agent_context['display_name']}
- Bio: {agent_context['bio']}
- Persona Summary: {agent_context['persona'][:500]}
- Style Traits: {', '.join(agent_context['style_traits'])}
- Themes: {', '.join(agent_context['themes'])}
{branding_section}
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
   - If branding guidelines are provided:
     * Make the branding colors the DOMINANT palette (not just accents)
     * Describe each color vividly (e.g., "vibrant lime green", "deep charcoal black")
     * The image should be immediately recognizable as using that color scheme

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
        Generate a social media post description in the agent's authentic voice.
        
        Args:
            agent_context: Agent profile data (including voice instructions)
            topic: Topic data
            image_prompt: The image prompt that was generated (for context)
        
        Returns:
            Engaging social media post that sounds unmistakably like the agent
        """
        print(f"[AIPromptGenerator] Generating post description in {agent_context['display_name']}'s voice...")
        start_time = time.time()
        
        # Get voice-related context (these come from _extract_voice_instructions)
        voice_instructions = agent_context.get('voice_instructions', '')
        speaking_style = agent_context.get('speaking_style', '')
        vocabulary_examples = agent_context.get('vocabulary_examples', [])
        example_phrases = agent_context.get('example_phrases', [])
        tone = agent_context.get('tone', 'authentic')
        
        # Use much more persona context - 2000+ chars for rich voice capture
        persona_full = agent_context.get('persona', '')[:2500]
        
        # Build vocabulary section
        vocab_section = ""
        if vocabulary_examples:
            vocab_sample = vocabulary_examples[:8]
            vocab_section = f"""
VOCABULARY & EXPRESSIONS TO USE:
{', '.join(vocab_sample)}
"""
        
        # Build example phrases section
        examples_section = ""
        if example_phrases:
            examples_section = f"""
EXAMPLES OF HOW THEY SPEAK:
{chr(10).join([f'- "{phrase}"' for phrase in example_phrases[:5]])}
"""
        
        # Build speaking style section
        style_section = ""
        if speaking_style:
            # Limit but keep meaningful content
            style_section = f"""
SPEAKING STYLE & COMMUNICATION:
{speaking_style[:1000]}
"""
        
        # Construct persona-rich meta-prompt
        meta_prompt = f"""You ARE {agent_context['display_name']}. Write a social media post about today's topic in YOUR authentic voice.

CRITICAL INSTRUCTION: You are not writing ABOUT this person - you ARE this person. Every word must sound like it came directly from them.

═══════════════════════════════════════════════════════════════
WHO YOU ARE (YOUR COMPLETE IDENTITY):
═══════════════════════════════════════════════════════════════
{persona_full}

═══════════════════════════════════════════════════════════════
YOUR VOICE (FOLLOW THIS EXACTLY):
═══════════════════════════════════════════════════════════════
Tone: {tone}
{voice_instructions}
{vocab_section}
{examples_section}
{style_section}
═══════════════════════════════════════════════════════════════
TODAY'S TOPIC TO REACT TO:
═══════════════════════════════════════════════════════════════
Topic: {topic['topic']}
Description: {topic.get('description', '')}
Category: {topic.get('category', 'general')}

The post includes an image showing: {image_prompt[:150]}...

═══════════════════════════════════════════════════════════════
WRITING REQUIREMENTS:
═══════════════════════════════════════════════════════════════
1. VOICE AUTHENTICITY (MOST IMPORTANT)
   - Write EXACTLY as {agent_context['display_name']} would write
   - Use THEIR vocabulary, expressions, and speech patterns
   - Capture THEIR emotional style (warm? provocative? witty? passionate?)
   - The post should be IMPOSSIBLE to confuse with someone else's voice

2. PERSONAL REACTION
   - React to the topic AS THIS PERSON would genuinely react
   - Include personal perspective, opinions, or stories if relevant
   - Show their passions, values, and personality through the content

3. NATURAL STRUCTURE
   - 150-300 words
   - 2-4 paragraphs, easy to read on mobile
   - Start with something attention-grabbing IN THEIR STYLE
   - End memorably (question, reflection, call to action - matching their voice)

4. HASHTAGS
   - 3-5 relevant hashtags at the end
   - Mix their typical themes with the topic

REMEMBER: If someone read this post without seeing the author, they should IMMEDIATELY recognize whose voice it is. Generic social media writing is FORBIDDEN.

Write the post now, as {agent_context['display_name']}:
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": f"You ARE {agent_context['display_name']}. Embody their personality, voice, vocabulary, and way of expressing themselves completely. Write as if you are literally this person sharing their genuine thoughts. Your writing must be unmistakably theirs - no generic social media speak."
                    },
                    {
                        "role": "user",
                        "content": meta_prompt
                    }
                ],
                temperature=0.88,  # High creativity for authentic voice
                max_tokens=700
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
        
        # Get branding guidelines if available
        branding = agent_context.get('branding_guidelines', '').strip()
        branding_section = ""
        if branding:
            # Transform hex codes to vivid descriptions, then truncate for character limits
            branding_transformed = transform_hex_to_vivid_descriptions(branding)
            branding_truncated = branding_transformed[:400] if len(branding_transformed) > 400 else branding_transformed
            branding_section = f"""
CRITICAL COLORS (MUST USE):
{branding_truncated}
"""
        
        # Construct meta-prompt for GPT-4o to create the edit prompt
        meta_prompt = f"""You are an expert at creating prompts for the OpenAI Image Edits API.

IMPORTANT: The Image Edits API MODIFIES an existing reference image. The prompt should describe:
1. What to ADD or CHANGE in the image (background, context, elements)
2. What visual elements to incorporate based on the topic
3. Keep the prompt CONCISE (under 800 characters) as the API has a 1000 char limit
4. If branding guidelines are provided, incorporate those colors and visual style elements

AGENT PROFILE:
- Name: {agent_context['display_name']}
- Style Traits: {', '.join(agent_context['style_traits'][:4])}
- Themes: {', '.join(agent_context['themes'][:3])}
{branding_section}
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
        Generate a short, catchy title for the post in the agent's unique voice.
        
        Args:
            topic: Topic data
            agent_context: Agent profile data (including voice instructions)
        
        Returns:
            Short title that sounds unmistakably like the agent
        """
        print(f"[AIPromptGenerator] Generating post title in {agent_context['display_name']}'s voice...")
        start_time = time.time()
        
        # Get voice-related context
        voice_instructions = agent_context.get('voice_instructions', '')
        vocabulary_examples = agent_context.get('vocabulary_examples', [])
        example_phrases = agent_context.get('example_phrases', [])
        tone = agent_context.get('tone', 'authentic')
        persona_preview = agent_context.get('persona', '')[:800]  # More persona context
        
        # Build vocabulary section
        vocab_section = ""
        if vocabulary_examples:
            vocab_sample = vocabulary_examples[:6]
            vocab_section = f"\nVOCABULARY TO USE: {', '.join(vocab_sample)}"
        
        # Build example section
        example_section = ""
        if example_phrases:
            example_section = f"\nEXAMPLE OF THEIR VOICE: \"{example_phrases[0]}\""
        
        meta_prompt = f"""You are writing a social media post title AS IF you ARE {agent_context['display_name']}.

CRITICAL: The title must sound like {agent_context['display_name']} wrote it themselves - their unique voice, vocabulary, and personality must shine through.

WHO YOU ARE:
{persona_preview}

YOUR VOICE:
- Tone: {tone}
- {voice_instructions}
{vocab_section}
{example_section}

TODAY'S TOPIC: {topic['topic']}
{f"Topic description: {topic['description'][:150]}" if topic.get('description') else ""}

REQUIREMENTS:
- Write 5-12 words maximum
- The title MUST sound unmistakably like {agent_context['display_name']}
- Use their vocabulary, expressions, and speech patterns
- React to the topic AS THEY WOULD - with their personality showing
- Emojis only if natural to their style (some characters don't use them)
- This is NOT a generic title - it should be impossible to confuse with another person's post

DO NOT write generic titles like "Exploring the Future" or "Thoughts on X".
DO write titles that capture THIS person's unique reaction to the topic.

Write ONLY the title, nothing else:
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",  # Use mini for speed
                messages=[
                    {
                        "role": "system",
                        "content": f"You are {agent_context['display_name']}. Write exactly as they would - their voice, their words, their personality. Every word must feel authentically theirs."
                    },
                    {
                        "role": "user",
                        "content": meta_prompt
                    }
                ],
                temperature=0.9,
                max_tokens=60
            )
            
            title = response.choices[0].message.content.strip()
            
            # Remove surrounding quotes if present
            if (title.startswith('"') and title.endswith('"')) or (title.startswith("'") and title.endswith("'")):
                title = title[1:-1]
            
            # Ensure it's not too long
            if len(title) > 120:
                title = title[:117] + "..."
            
            duration = time.time() - start_time
            tokens = response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'
            
            print(f"[AIPromptGenerator] ✅ Title generated: {title} ({duration:.2f}s, {tokens} tokens)")
            
            return title
            
        except Exception as e:
            print(f"[AIPromptGenerator] ❌ Error generating title: {e}")
            # Fallback title with agent name
            return f"{agent_context['display_name']} on {topic['topic'][:30]}..."


# Convenience functions
def generate_image_prompt(agent_context: Dict[str, Any], topic: Dict[str, str]) -> str:
    """Generate image prompt"""
    generator = AIPromptGenerator()
    return generator.generate_image_prompt(agent_context, topic)


def generate_description(
    agent_context: Dict[str, Any], 
    topic: Dict[str, str],
    image_prompt: str,
    feedback: str = None
) -> str:
    """Generate post description with optional user feedback for refinement"""
    generator = AIPromptGenerator()
    
    # If feedback provided, inject it into the topic for context
    if feedback:
        enhanced_topic = topic.copy()
        enhanced_topic["user_feedback"] = feedback
        if "description" in enhanced_topic:
            enhanced_topic["description"] = f"{enhanced_topic['description']}\n\nIMPORTANT USER GUIDANCE: {feedback}"
        return generator.generate_description(agent_context, enhanced_topic, image_prompt)
    
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
    edit_instructions: str = "",
    feedback: str = None
) -> Tuple[str, str]:
    """
    Generate edit prompt and title in parallel for OpenAI Image Edits mode.
    
    Args:
        agent_context: Agent profile data
        topic: Topic data
        edit_instructions: Optional custom edit instructions
        feedback: Optional user feedback from rejection (for regeneration)
    
    Returns:
        Tuple of (edit_prompt, title)
    """
    print("[AIPromptGenerator] Generating edit prompt and title in parallel...")
    if feedback:
        print(f"[AIPromptGenerator] Using user feedback: {feedback[:50]}...")
    start_time = time.time()
    
    # Enhance topic with feedback if provided
    enhanced_topic = topic.copy()
    if feedback:
        enhanced_topic["user_feedback"] = feedback
        if "description" in enhanced_topic:
            enhanced_topic["description"] = f"{enhanced_topic['description']}\n\nUSER GUIDANCE: {feedback}"
    
    # Enhance edit instructions with feedback
    enhanced_instructions = edit_instructions
    if feedback:
        enhanced_instructions = f"{edit_instructions}\n\nUser refinement request: {feedback}" if edit_instructions else f"User refinement request: {feedback}"
    
    loop = asyncio.get_event_loop()
    
    edit_prompt_task = loop.run_in_executor(
        None,
        generate_edit_prompt,
        agent_context,
        enhanced_topic,
        enhanced_instructions
    )
    
    title_task = loop.run_in_executor(
        None,
        generate_title,
        enhanced_topic,
        agent_context
    )
    
    # Wait for both to complete
    edit_prompt, title = await asyncio.gather(edit_prompt_task, title_task)
    
    duration = time.time() - start_time
    print(f"[AIPromptGenerator] ✅ Parallel edit prompt generation completed in {duration:.2f}s")
    
    return edit_prompt, title


async def generate_image_prompt_and_title_parallel(
    agent_context: Dict[str, Any], 
    topic: Dict[str, str],
    feedback: str = None
) -> Tuple[str, str]:
    """
    Generate image prompt and title in parallel using asyncio.
    
    These two operations are independent and can run simultaneously.
    
    Args:
        agent_context: Agent profile data
        topic: Topic data
        feedback: Optional user feedback from rejection (for regeneration)
    
    Returns:
        Tuple of (image_prompt, title)
    """
    print("[AIPromptGenerator] Generating image prompt and title in parallel...")
    if feedback:
        print(f"[AIPromptGenerator] Using user feedback: {feedback[:50]}...")
    start_time = time.time()
    
    # Enhance topic with feedback if provided
    enhanced_topic = topic.copy()
    if feedback:
        enhanced_topic["user_feedback"] = feedback
        if "description" in enhanced_topic:
            enhanced_topic["description"] = f"{enhanced_topic['description']}\n\nUSER GUIDANCE FOR IMAGE: {feedback}"
    
    # Run both in thread pool since OpenAI client is synchronous
    loop = asyncio.get_event_loop()
    
    image_prompt_task = loop.run_in_executor(
        None, 
        generate_image_prompt, 
        agent_context, 
        enhanced_topic
    )
    
    title_task = loop.run_in_executor(
        None,
        generate_title,
        enhanced_topic,
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


