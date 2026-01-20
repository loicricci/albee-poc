"""
AI Prompt Generator Module

Generates prompts for image generation (DALL-E) and post descriptions (GPT-4o)
based on agent context and daily news topics.
"""

import json
import time
import asyncio
import re
import functools
from typing import Dict, Any, Tuple, Optional
from openai import OpenAI

client = OpenAI()

# Image style mappings - descriptive directives for each style
IMAGE_STYLE_DIRECTIVES = {
    "realistic": "Create a photorealistic image with natural lighting, realistic textures, and authentic human features. The image should look like a real photograph.",
    "cartoon": "Create a cartoon-style illustration with simple shapes, bold outlines, exaggerated features, and vibrant flat colors. Think classic animated style.",
    "anime": "Create a Japanese anime-style illustration with large expressive eyes, clean linework, vibrant colors, and characteristic anime aesthetics.",
    "futuristic": "Create a futuristic sci-fi themed image with advanced technology, neon lights, holographic displays, cyber elements, and a high-tech atmosphere.",
    "illustration": "Create a digital art illustration with painterly qualities, artistic brushwork, stylized elements suitable for editorial or concept art.",
    "3d_render": "Create a 3D rendered image with depth, volume, realistic lighting and shadows, as if created in CGI software or game engine.",
    "sketch": "Create a hand-drawn sketch style image with pencil or ink linework, rough expressive strokes, cross-hatching, and an artistic unfinished quality.",
    "fantasy": "Create a fantasy-themed image with mythical elements, magical atmospheres, ethereal lighting, and elements of wonder and imagination.",
}


def get_style_directive(image_style: Optional[str]) -> str:
    """
    Get the style directive text for a given image style.
    
    Args:
        image_style: The style key (realistic, cartoon, anime, etc.) or None
    
    Returns:
        Style directive text to include in prompts, or empty string if no style
    """
    if not image_style or image_style not in IMAGE_STYLE_DIRECTIVES:
        return ""
    return IMAGE_STYLE_DIRECTIVES[image_style]


def parse_structured_branding(branding_text: str) -> Dict[str, str]:
    """
    Parse structured branding guidelines into sections.
    
    Looks for sections marked with === SECTION NAME ===
    
    Returns dict with section names as keys and content as values.
    """
    sections = {}
    current_section = None
    current_content = []
    
    for line in branding_text.split('\n'):
        stripped = line.strip()
        if stripped.startswith('===') and stripped.endswith('==='):
            # Save previous section
            if current_section:
                sections[current_section] = '\n'.join(current_content).strip()
            
            # Start new section
            section_name = stripped.strip('=').strip()
            current_section = section_name
            current_content = []
        elif current_section:
            current_content.append(line)
    
    # Save last section
    if current_section:
        sections[current_section] = '\n'.join(current_content).strip()
    
    return sections


def format_branding_for_artistic_brief(branding_text: str) -> str:
    """
    Format branding guidelines for the artistic brief meta-prompt.
    
    If structured sections exist, format them clearly.
    Otherwise, transform hex codes and return as-is.
    """
    sections = parse_structured_branding(branding_text)
    
    if sections:
        # We have structured branding - format it for the prompt
        formatted_parts = []
        
        # Priority order for sections
        priority_sections = [
            "COLOR PALETTE",
            "COMPOSITION STYLE", 
            "VISUAL TECHNIQUES",
            "MOOD & ATMOSPHERE",
            "ARTISTIC REFERENCES",
            "AVOID"
        ]
        
        for section_name in priority_sections:
            if section_name in sections:
                content = sections[section_name]
                # Transform hex codes in color palette
                if "COLOR" in section_name:
                    content = transform_hex_to_vivid_descriptions(content)
                formatted_parts.append(f"[{section_name}]\n{content}")
        
        # Add any other sections not in priority list
        for section_name, content in sections.items():
            if section_name not in priority_sections:
                formatted_parts.append(f"[{section_name}]\n{content}")
        
        return "\n\n".join(formatted_parts)
    else:
        # No structured sections - just transform hex codes
        return transform_hex_to_vivid_descriptions(branding_text)


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
        topic: Dict[str, str],
        image_style: Optional[str] = None
    ) -> str:
        """
        Generate a VISUAL PROMPT for AI image generation.
        
        This method creates prompts with a layered approach:
        1. SUBJECT/NARRATIVE (LITERAL) - Who/what, doing what, where
        2. STYLE/MEDIUM (ARTISTIC) - Art style, rendering approach
        3. VISUAL EXECUTION (BRANDING) - Colors, composition, lighting
        4. AVOID LIST - Generic AI adjectives to exclude
        
        Args:
            agent_context: Agent profile data from ProfileContextLoader
            topic: Topic data from NewsTopicFetcher
            image_style: Optional image style (realistic, cartoon, anime, etc.)
        
        Returns:
            Visual prompt for image generation (150-200 words)
        """
        print(f"[AIPromptGenerator] Generating VISUAL PROMPT (subject + artistic direction)...")
        if image_style:
            print(f"[AIPromptGenerator] Using image style: {image_style}")
        start_time = time.time()
        
        # Get branding guidelines and format for artistic brief
        branding = agent_context.get('branding_guidelines', '').strip()
        branding_section = ""
        has_structured_branding = False
        
        if branding:
            # Check if we have structured branding (with === sections)
            parsed_sections = parse_structured_branding(branding)
            has_structured_branding = bool(parsed_sections)
            
            # Format branding for the prompt
            formatted_branding = format_branding_for_artistic_brief(branding)
            
            branding_section = f"""
═══════════════════════════════════════════════════════════════
BRAND VISUAL DIRECTION (extracted from mood board):
═══════════════════════════════════════════════════════════════
{formatted_branding}
"""
        
        # Get style directive if style is specified
        style_directive = get_style_directive(image_style)
        style_section = ""
        if style_directive:
            style_section = f"""
STYLE OVERRIDE: {style_directive}
"""
        
        # Build the avoid list from branding if available
        avoid_section = ""
        if has_structured_branding:
            parsed = parse_structured_branding(branding)
            if "AVOID" in parsed:
                avoid_section = f"\nFROM BRAND GUIDELINES - AVOID:\n{parsed['AVOID']}"
        
        # Construct meta-prompt for GPT-4o to create a VISUAL PROMPT
        meta_prompt = f"""You are a VISUAL PROMPT ENGINEER creating prompts for AI image generation.

Your job is to create a VISUAL PROMPT that combines LITERAL subject matter with ARTISTIC execution.

═══════════════════════════════════════════════════════════════
LAYERED PROMPT STRUCTURE (FOLLOW THIS ORDER):
═══════════════════════════════════════════════════════════════

1. SUBJECT & NARRATIVE (LITERAL - BE SPECIFIC)
   - WHO or WHAT is the main subject
   - WHAT are they doing (action/pose)
   - WHERE is this happening (setting/environment)
   
2. STYLE & MEDIUM
   - Art style (illustration, cinematic, painterly, etc.)
   - Rendering approach and visual treatment

3. VISUAL EXECUTION
   - How brand colors are applied (lighting, accents, atmosphere)
   - Composition (rule of thirds, asymmetrical, etc.)
   - Lighting direction and mood

4. MOOD & ATMOSPHERE
   - Emotional tone
   - What feeling should the image evoke
{branding_section}{style_section}
═══════════════════════════════════════════════════════════════
TOPIC TO DEPICT:
═══════════════════════════════════════════════════════════════
Topic: {topic['topic']}
Category: {topic.get('category', 'general')}
{f"Context: {topic.get('description', '')[:200]}" if topic.get('description') else ""}

═══════════════════════════════════════════════════════════════
AGENT CONTEXT (for style and thematic influence):
═══════════════════════════════════════════════════════════════
Themes: {', '.join(agent_context['themes'])}
Traits: {', '.join(agent_context['style_traits'][:5])}

═══════════════════════════════════════════════════════════════
YOUR TASK - CREATE A VISUAL PROMPT:
═══════════════════════════════════════════════════════════════

Write a 150-200 word visual prompt that includes:

1. SUBJECT & NARRATIVE (REQUIRED - START WITH THIS)
   - Describe the subject literally based on the topic
   - Include action, pose, or state
   - Describe the setting/environment clearly

2. STYLE & MEDIUM
   - Define the artistic style (e.g., "fantasy illustration", "cinematic photograph", "painterly digital art")
   - Specify rendering approach

3. COLOR & LIGHTING (from branding)
   - How brand colors appear (as lighting, atmosphere, accents on subject)
   - Light source direction and quality
   - Color temperature and mood

4. COMPOSITION
   - Subject placement (rule of thirds, centered, etc.)
   - Use of negative space
   - Depth and layering

5. MOOD
   - Emotional tone connecting subject to theme
   - Atmospheric quality

AVOID (produces generic AI output):
- Generic quality adjectives: "stunning", "beautiful", "high quality", "professional", "amazing", "masterpiece"
- Hyper-detailed photorealistic face close-ups (use stylized or partially shadowed faces instead)
- Contradictory style instructions
- Overly long prompts (keep under 200 words)
{avoid_section}

OUTPUT FORMAT:
Write ONLY the visual prompt (150-200 words). Start with the subject description.
Do NOT include explanations, headers, numbered sections, or meta-commentary.

Example of GOOD output:
"King Arthur in weathered medieval armor walks across the barren lunar surface, Earth a blue marble on the distant horizon. Fantasy illustration style with cinematic dramatic lighting from below. Deep navy sky with electric blue rim lighting illuminating the armor's edges and creating ethereal glow. Asymmetrical composition with figure positioned in the left third, vast grey lunar landscape stretching into negative space on the right. Footprints trail behind in the fine dust. Mood: epic isolation meets contemplative wonder. Stylized face with determined expression, partially shadowed by the helmet. Starfield visible in the dark sky above."

Now write the visual prompt:"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert visual prompt engineer. You create image prompts that combine LITERAL subject/narrative with ARTISTIC execution. The subject matter is specific and clear; the visual style is creative and distinctive. Your prompts produce high-quality images that depict the topic accurately while avoiding generic AI aesthetics."
                    },
                    {
                        "role": "user",
                        "content": meta_prompt
                    }
                ],
                temperature=0.75,
                max_tokens=400  # Slightly more tokens for subject + artistic direction
            )
            
            image_prompt = response.choices[0].message.content.strip()
            
            # Clean up any accidental scene descriptions or forbidden phrases
            forbidden_starts = ["create an image", "generate an image", "a photorealistic", "a digital artwork showing"]
            for forbidden in forbidden_starts:
                if image_prompt.lower().startswith(forbidden):
                    # Remove the forbidden start
                    image_prompt = image_prompt[len(forbidden):].strip()
                    if image_prompt.startswith("of "):
                        image_prompt = image_prompt[3:].strip()
            
            duration = time.time() - start_time
            tokens = response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'
            
            print(f"[AIPromptGenerator] ✅ Visual prompt generated ({len(image_prompt)} chars, {duration:.2f}s, {tokens} tokens)")
            print(f"[AIPromptGenerator]    Preview: {image_prompt[:100]}...")
            
            return image_prompt
            
        except Exception as e:
            print(f"[AIPromptGenerator] ❌ Error generating visual prompt: {e}")
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
        edit_instructions: str = "",
        image_style: Optional[str] = None
    ) -> str:
        """
        Generate an ARTISTIC EDIT BRIEF for OpenAI Image Edits API.
        
        This creates mood-driven edit instructions that transform the reference
        image's atmosphere and context while preserving the subject.
        
        Args:
            agent_context: Agent profile data from ProfileContextLoader
            topic: Topic data from NewsTopicFetcher
            edit_instructions: Optional custom edit instructions from agent settings
            image_style: Optional image style (realistic, cartoon, anime, etc.)
        
        Returns:
            Concise artistic edit brief (max ~900 chars)
        """
        print(f"[AIPromptGenerator] Generating ARTISTIC EDIT BRIEF...")
        if image_style:
            print(f"[AIPromptGenerator] Using image style: {image_style}")
        start_time = time.time()
        
        # Get branding guidelines and format for artistic brief
        branding = agent_context.get('branding_guidelines', '').strip()
        branding_section = ""
        avoid_items = []
        
        if branding:
            parsed_sections = parse_structured_branding(branding)
            
            if parsed_sections:
                # Extract key sections for edit prompt
                color_info = parsed_sections.get("COLOR PALETTE", "")
                if color_info:
                    color_info = transform_hex_to_vivid_descriptions(color_info)[:300]
                    branding_section += f"\nCOLORS: {color_info}"
                
                composition = parsed_sections.get("COMPOSITION STYLE", "")
                if composition:
                    branding_section += f"\nSTYLE: {composition[:150]}"
                
                techniques = parsed_sections.get("VISUAL TECHNIQUES", "")
                if techniques:
                    branding_section += f"\nTECHNIQUES: {techniques[:150]}"
                
                avoid = parsed_sections.get("AVOID", "")
                if avoid:
                    avoid_items = [a.strip() for a in avoid.split('\n') if a.strip()][:3]
            else:
                # No structured sections - just transform hex codes
                branding_section = f"\nBRAND COLORS: {transform_hex_to_vivid_descriptions(branding)[:300]}"
        
        # Get style directive if style is specified
        style_directive = get_style_directive(image_style)
        
        # Build avoid string
        avoid_str = ""
        if avoid_items:
            avoid_str = f"\nAVOID: {', '.join(avoid_items)}"
        
        # Construct meta-prompt for artistic edit brief
        meta_prompt = f"""Create an ARTISTIC EDIT BRIEF for transforming a reference image.

The edit should transform ATMOSPHERE and CONTEXT, not add literal objects.
{branding_section}
{f"STYLE: {style_directive}" if style_directive else ""}
{avoid_str}

TOPIC TO EVOKE: {topic['topic']}

Create a brief (under 700 chars) that describes:
1. How to transform the ATMOSPHERE (lighting, color grading, mood)
2. What ABSTRACT elements to add to the background (gradients, shapes, textures)
3. How brand colors should be applied (as ambient light, color wash, accents)

DO NOT describe:
- Specific objects or scenes
- Literal interpretations of the topic
- Changes to the subject/person

GOOD EXAMPLE:
"Transform atmosphere with deep navy (#0E2A47) color wash. Add flowing abstract forms in electric blue (#1F6BFF) behind subject. Gradient from dark edges to lighter center. Subtle fabric-like textures overlaying background. Mood: contemplative sophistication. Light source from upper left creating soft shadows."

Write ONLY the edit brief:"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You create artistic edit briefs that transform image atmosphere through color, light, and abstract forms - never literal scene changes."
                    },
                    {
                        "role": "user",
                        "content": meta_prompt
                    }
                ],
                temperature=0.75,
                max_tokens=250
            )
            
            edit_prompt = response.choices[0].message.content.strip()
            
            # Clean up any scene descriptions
            forbidden_starts = ["transform the background into", "add a", "change the setting to"]
            for forbidden in forbidden_starts:
                if edit_prompt.lower().startswith(forbidden):
                    edit_prompt = edit_prompt[len(forbidden):].strip()
            
            # Ensure it's not too long for OpenAI Edits API (1000 char limit)
            if len(edit_prompt) > 900:
                edit_prompt = edit_prompt[:900].rsplit(' ', 1)[0] + "..."
                print(f"[AIPromptGenerator] ⚠️  Edit prompt truncated to 900 chars")
            
            duration = time.time() - start_time
            tokens = response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'
            
            print(f"[AIPromptGenerator] ✅ Artistic edit brief generated ({len(edit_prompt)} chars, {duration:.2f}s, {tokens} tokens)")
            print(f"[AIPromptGenerator]    Preview: {edit_prompt[:100]}...")
            
            return edit_prompt
            
        except Exception as e:
            print(f"[AIPromptGenerator] ❌ Error generating edit brief: {e}")
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
def generate_image_prompt(
    agent_context: Dict[str, Any], 
    topic: Dict[str, str],
    image_style: Optional[str] = None
) -> str:
    """Generate image prompt"""
    generator = AIPromptGenerator()
    return generator.generate_image_prompt(agent_context, topic, image_style=image_style)


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
    edit_instructions: str = "",
    image_style: Optional[str] = None
) -> str:
    """
    Generate an image edit prompt for OpenAI Image Edits API.
    
    This creates a prompt specifically designed to MODIFY an existing reference
    image based on the topic/context, rather than creating a new image.
    
    Args:
        agent_context: Agent profile data
        topic: Topic data
        edit_instructions: Optional custom edit instructions
        image_style: Optional image style (realistic, cartoon, anime, etc.)
    
    Returns:
        Concise edit prompt for modifying reference image
    """
    generator = AIPromptGenerator()
    return generator.generate_edit_prompt(agent_context, topic, edit_instructions, image_style=image_style)


def generate_video_prompt(
    agent_context: Dict[str, Any],
    topic: Dict[str, str],
    feedback: str = None
) -> str:
    """
    Generate a video generation prompt for SORA 2 API.
    
    Creates a prompt optimized for video generation, focusing on motion,
    camera work, and dynamic visual storytelling.
    
    Args:
        agent_context: Agent profile data
        topic: Topic data
        feedback: Optional user feedback for refinement
    
    Returns:
        Video generation prompt for SORA 2
    """
    print(f"[AIPromptGenerator] Generating VIDEO prompt for SORA 2...")
    start_time = time.time()
    
    # Enhance topic with feedback if provided
    enhanced_topic = topic.copy()
    if feedback:
        enhanced_topic["user_feedback"] = feedback
        if "description" in enhanced_topic:
            enhanced_topic["description"] = f"{enhanced_topic['description']}\n\nUSER GUIDANCE: {feedback}"
    
    # Get branding guidelines if available
    branding = agent_context.get('branding_guidelines', '').strip()
    branding_section = ""
    if branding:
        branding_transformed = transform_hex_to_vivid_descriptions(branding)
        branding_section = f"""
COLOR PALETTE (incorporate these colors):
{branding_transformed[:300]}
"""
    
    # Construct meta-prompt for GPT-4o to create the video prompt
    # NOTE: We intentionally do NOT include the agent's display_name to avoid Sora 2 moderation blocks
    # Sora 2 blocks any prompts that mention real people by name
    meta_prompt = f"""You are an expert at creating detailed video generation prompts for SORA 2 (OpenAI's video AI).

AGENT PROFILE (use for style inspiration, but NEVER mention names):
- Style/Persona: {agent_context['bio'][:200] if agent_context.get('bio') else 'Creative professional'}
- Style Traits: {', '.join(agent_context['style_traits'])}
- Themes: {', '.join(agent_context['themes'])}
{branding_section}
DAILY TOPIC:
- Topic: {enhanced_topic['topic']}
- Description: {enhanced_topic.get('description', '')}
- Category: {enhanced_topic.get('category', 'general')}

TASK:
Create a detailed video generation prompt (10 seconds) that:

1. CAPTURES THE ESSENCE (NO NAMES - CRITICAL!)
   - Reflects the personality and style visually
   - Includes signature aesthetic elements
   - If a person is shown, use "a figure", "the subject", "someone", NOT names
   - NEVER use real names, celebrity names, or character names

2. RELATES TO THE DAILY TOPIC
   - Connects the visual narrative to the topic
   - Makes the connection creative and engaging
   - Can be metaphorical or literal

3. VIDEO-SPECIFIC ELEMENTS (CRITICAL)
   - Describe MOTION and MOVEMENT (what moves, how fast, direction)
   - Specify CAMERA WORK (pan, zoom, tracking, static, cinematic)
   - Include TRANSITIONS (smooth cuts, fades, continuous shot)
   - Describe ATMOSPHERE and MOOD progression
   - Add dynamic visual effects or lighting changes

4. VISUAL STYLE
   - Cinematic quality, professional production feel
   - Lighting that enhances mood (golden hour, neon, dramatic, soft)
   - Color grading that matches the theme
   - High detail and visual appeal

5. LEGAL SAFETY (STRICT - WILL BE REJECTED OTHERWISE)
   - ABSOLUTELY NO real person names (will be blocked by moderation)
   - NO copyrighted characters or trademarked brands
   - NO recognizable celebrities or public figures
   - Use "a figure", "the subject", "someone" instead of names
   - Keep content general-audience appropriate

EXAMPLE VIDEO PROMPTS (notice: no names, only "a figure", "the subject"):
- "Slow cinematic pan across a bustling city at golden hour, camera rises to reveal glittering skyscrapers, then smoothly zooms into a window where papers flutter in the breeze, warm light filtering through"
- "Dynamic tracking shot following a figure walking through a rain-soaked neon-lit street, reflections shimmer on wet pavement, camera occasionally catches glimpses of their shadow as they pass storefronts"
- "A subject sits at a desk in a cozy study, surrounded by books. The camera slowly orbits around them as golden afternoon light streams through venetian blinds, casting striped shadows across the scene"

CRITICAL RULES:
1. Your response should be ONLY the video prompt itself (150-250 words)
2. NEVER include any names - use "a figure", "the subject", "someone" instead
3. Focus on motion, camera work, and dynamic storytelling
4. Make it vivid and cinematic!
"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert video prompt engineer. Create prompts that describe motion, camera work, and cinematic storytelling for AI video generation."
                },
                {
                    "role": "user",
                    "content": meta_prompt
                }
            ],
            temperature=0.85,
            max_tokens=400
        )
        
        video_prompt = response.choices[0].message.content.strip()
        
        duration = time.time() - start_time
        tokens = response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'
        
        print(f"[AIPromptGenerator] ✅ Video prompt generated ({len(video_prompt)} chars, {duration:.2f}s, {tokens} tokens)")
        print(f"[AIPromptGenerator]    Preview: {video_prompt[:100]}...")
        
        return video_prompt
        
    except Exception as e:
        print(f"[AIPromptGenerator] ❌ Error generating video prompt: {e}")
        raise


async def generate_edit_prompt_and_title_parallel(
    agent_context: Dict[str, Any],
    topic: Dict[str, str],
    edit_instructions: str = "",
    feedback: str = None,
    image_style: Optional[str] = None
) -> Tuple[str, str]:
    """
    Generate edit prompt and title in parallel for OpenAI Image Edits mode.
    
    Args:
        agent_context: Agent profile data
        topic: Topic data
        edit_instructions: Optional custom edit instructions
        feedback: Optional user feedback from rejection (for regeneration)
        image_style: Optional image style (realistic, cartoon, anime, etc.)
    
    Returns:
        Tuple of (edit_prompt, title)
    """
    print("[AIPromptGenerator] Generating edit prompt and title in parallel...")
    if feedback:
        print(f"[AIPromptGenerator] Using user feedback: {feedback[:50]}...")
    if image_style:
        print(f"[AIPromptGenerator] Using image style: {image_style}")
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
    
    # Use functools.partial to pass additional arguments
    edit_prompt_func = functools.partial(
        generate_edit_prompt,
        agent_context,
        enhanced_topic,
        enhanced_instructions,
        image_style
    )
    
    edit_prompt_task = loop.run_in_executor(None, edit_prompt_func)
    
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
    feedback: str = None,
    image_style: Optional[str] = None
) -> Tuple[str, str]:
    """
    Generate image prompt and title in parallel using asyncio.
    
    These two operations are independent and can run simultaneously.
    
    Args:
        agent_context: Agent profile data
        topic: Topic data
        feedback: Optional user feedback from rejection (for regeneration)
        image_style: Optional image style (realistic, cartoon, anime, etc.)
    
    Returns:
        Tuple of (image_prompt, title)
    """
    print("[AIPromptGenerator] Generating image prompt and title in parallel...")
    if feedback:
        print(f"[AIPromptGenerator] Using user feedback: {feedback[:50]}...")
    if image_style:
        print(f"[AIPromptGenerator] Using image style: {image_style}")
    start_time = time.time()
    
    # Enhance topic with feedback if provided
    enhanced_topic = topic.copy()
    if feedback:
        enhanced_topic["user_feedback"] = feedback
        if "description" in enhanced_topic:
            enhanced_topic["description"] = f"{enhanced_topic['description']}\n\nUSER GUIDANCE FOR IMAGE: {feedback}"
    
    # Run both in thread pool since OpenAI client is synchronous
    loop = asyncio.get_event_loop()
    
    # Use functools.partial to pass additional arguments
    image_prompt_func = functools.partial(
        generate_image_prompt,
        agent_context,
        enhanced_topic,
        image_style
    )
    
    image_prompt_task = loop.run_in_executor(None, image_prompt_func)
    
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


