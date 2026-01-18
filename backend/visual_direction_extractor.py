"""
Visual Direction Extractor Module

Analyzes mood boards and branding documents using GPT-4o Vision
to extract structured visual direction for AI image generation.
"""

import os
import base64
import io
from typing import List, Dict, Any, Optional
from openai import OpenAI

client = OpenAI()

# Structured sections for visual direction
VISUAL_DIRECTION_SECTIONS = [
    "COLOR PALETTE",
    "COMPOSITION STYLE", 
    "VISUAL TECHNIQUES",
    "MOOD & ATMOSPHERE",
    "ARTISTIC REFERENCES",
    "AVOID"
]

# GPT-4o Vision prompt for mood board analysis
MOOD_BOARD_ANALYSIS_PROMPT = """Analyze this mood board/branding document and extract detailed visual direction for AI image generation.

You are an expert art director analyzing visual references to create a comprehensive style guide.

Return a structured analysis with these EXACT sections (use === SECTION NAME === format):

=== COLOR PALETTE ===
List 3-5 dominant colors with:
- Hex code (extract from the images or estimate accurately)
- Descriptive name (e.g., "Deep Navy", "Electric Blue")
- Usage description (dominant, accent, background, highlight)

=== COMPOSITION STYLE ===
Describe the compositional approach:
- Abstract vs figurative
- Symmetry vs asymmetry
- Layering and depth
- Use of negative space
- Flow and movement direction

=== VISUAL TECHNIQUES ===
List specific visual techniques visible:
- Textures (fabric-like, glass, organic, geometric)
- Gradients and color transitions
- Silhouettes and shapes
- Light and shadow treatment
- Overlapping and transparency

=== MOOD & ATMOSPHERE ===
Describe the emotional tone:
- Primary mood (contemplative, energetic, mysterious, etc.)
- Atmosphere (ethereal, grounded, futuristic, etc.)
- Feeling it should evoke in viewers

=== ARTISTIC REFERENCES ===
Identify art movements, styles, or influences:
- Art movements (abstract expressionism, minimalism, etc.)
- Design styles (editorial, commercial, fine art)
- Cultural or era references

=== AVOID ===
Based on this aesthetic, list what should NOT appear in generated images:
- Styles that clash
- Elements that would break the aesthetic
- Common AI art clichés to avoid

Be specific and actionable. This will be used to guide AI image generation."""


class VisualDirectionExtractor:
    """
    Extracts structured visual direction from mood boards using GPT-4o Vision.
    
    Supports:
    - Multiple images analyzed together
    - PDF documents (converted to images)
    - Returns structured, parseable visual direction
    """
    
    def __init__(self):
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY environment variable not set")
    
    def analyze_mood_board(
        self,
        images: List[bytes],
        additional_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze multiple mood board images and extract visual direction.
        
        Args:
            images: List of image data (bytes) to analyze together
            additional_context: Optional context about the brand/agent
        
        Returns:
            Dictionary with:
            - raw_analysis: Full text from GPT-4o Vision
            - sections: Parsed sections dict
            - formatted_guidelines: Ready-to-use branding guidelines text
        """
        print(f"[VisualDirectionExtractor] Analyzing {len(images)} mood board image(s)...")
        
        if not images:
            raise ValueError("At least one image is required")
        
        # Prepare images for GPT-4o Vision
        image_contents = []
        for i, image_data in enumerate(images):
            # Convert to base64
            b64_image = base64.b64encode(image_data).decode('utf-8')
            
            # Detect image type from magic bytes
            image_type = self._detect_image_type(image_data)
            
            image_contents.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{image_type};base64,{b64_image}",
                    "detail": "high"  # High detail for better color/texture analysis
                }
            })
            print(f"[VisualDirectionExtractor] Prepared image {i+1}: {image_type}")
        
        # Build the prompt
        prompt_text = MOOD_BOARD_ANALYSIS_PROMPT
        if additional_context:
            prompt_text += f"\n\nADDITIONAL CONTEXT ABOUT THE BRAND:\n{additional_context}"
        
        # Add text instruction
        messages_content = image_contents + [
            {
                "type": "text",
                "text": prompt_text
            }
        ]
        
        try:
            print(f"[VisualDirectionExtractor] Calling GPT-4o Vision API...")
            
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert art director and brand strategist. Analyze visual references with precision and create actionable style guides for AI image generation."
                    },
                    {
                        "role": "user",
                        "content": messages_content
                    }
                ],
                max_tokens=2000,
                temperature=0.3  # Lower temperature for more consistent analysis
            )
            
            raw_analysis = response.choices[0].message.content.strip()
            tokens_used = response.usage.total_tokens if hasattr(response, 'usage') else 'N/A'
            
            print(f"[VisualDirectionExtractor] ✅ Analysis complete ({tokens_used} tokens)")
            
            # Parse the structured sections
            sections = self._parse_sections(raw_analysis)
            
            # Format as ready-to-use guidelines
            formatted_guidelines = self._format_guidelines(raw_analysis)
            
            return {
                "raw_analysis": raw_analysis,
                "sections": sections,
                "formatted_guidelines": formatted_guidelines,
                "image_count": len(images),
                "tokens_used": tokens_used
            }
            
        except Exception as e:
            print(f"[VisualDirectionExtractor] ❌ Error: {e}")
            raise Exception(f"Failed to analyze mood board: {e}")
    
    def _detect_image_type(self, image_data: bytes) -> str:
        """Detect image MIME type from magic bytes"""
        if image_data[:8] == b'\x89PNG\r\n\x1a\n':
            return "image/png"
        elif image_data[:2] == b'\xff\xd8':
            return "image/jpeg"
        elif image_data[:6] in (b'GIF87a', b'GIF89a'):
            return "image/gif"
        elif image_data[:4] == b'RIFF' and image_data[8:12] == b'WEBP':
            return "image/webp"
        else:
            # Default to PNG if unknown
            return "image/png"
    
    def _parse_sections(self, raw_analysis: str) -> Dict[str, str]:
        """
        Parse the raw analysis into structured sections.
        
        Returns dict with section names as keys and content as values.
        """
        sections = {}
        current_section = None
        current_content = []
        
        for line in raw_analysis.split('\n'):
            # Check if this is a section header
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
    
    def _format_guidelines(self, raw_analysis: str) -> str:
        """
        Format the raw analysis into clean branding guidelines text.
        
        This is the format that will be saved to branding_guidelines field.
        """
        # The raw analysis is already well-formatted, just clean it up
        lines = raw_analysis.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # Remove excessive whitespace but preserve structure
            if line.strip():
                cleaned_lines.append(line)
            elif cleaned_lines and cleaned_lines[-1].strip():
                # Add single blank line between sections
                cleaned_lines.append('')
        
        return '\n'.join(cleaned_lines)
    
    def extract_from_pdf(self, pdf_data: bytes) -> List[bytes]:
        """
        Extract images from a PDF document for analysis.
        
        Args:
            pdf_data: Raw PDF file bytes
        
        Returns:
            List of image bytes (one per page)
        """
        try:
            import fitz  # PyMuPDF
        except ImportError:
            raise ImportError(
                "PyMuPDF is required for PDF analysis. "
                "Install with: pip install pymupdf"
            )
        
        print(f"[VisualDirectionExtractor] Extracting images from PDF...")
        
        images = []
        
        # Open PDF from bytes
        pdf_document = fitz.open(stream=pdf_data, filetype="pdf")
        
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            
            # Render page to image at 2x resolution for quality
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PNG bytes
            img_bytes = pix.tobytes("png")
            images.append(img_bytes)
            
            print(f"[VisualDirectionExtractor] Extracted page {page_num + 1}")
        
        pdf_document.close()
        
        print(f"[VisualDirectionExtractor] ✅ Extracted {len(images)} pages from PDF")
        
        return images


# Convenience function
def analyze_mood_board(
    images: List[bytes],
    additional_context: Optional[str] = None
) -> Dict[str, Any]:
    """
    Analyze mood board images and extract visual direction.
    
    Args:
        images: List of image bytes to analyze
        additional_context: Optional brand context
    
    Returns:
        Dictionary with analysis results
    """
    extractor = VisualDirectionExtractor()
    return extractor.analyze_mood_board(images, additional_context)


def extract_pdf_pages(pdf_data: bytes) -> List[bytes]:
    """
    Extract images from PDF pages.
    
    Args:
        pdf_data: Raw PDF bytes
    
    Returns:
        List of image bytes (one per page)
    """
    extractor = VisualDirectionExtractor()
    return extractor.extract_from_pdf(pdf_data)


# Testing
if __name__ == "__main__":
    from dotenv import load_dotenv
    import sys
    
    load_dotenv("backend/.env", override=True)
    
    print("=" * 60)
    print("Testing Visual Direction Extractor")
    print("=" * 60)
    
    if len(sys.argv) < 2:
        print("\nUsage: python visual_direction_extractor.py <image_path> [image_path2] ...")
        print("\nExample: python visual_direction_extractor.py mood_board.png")
        sys.exit(1)
    
    # Load images from command line args
    images = []
    for image_path in sys.argv[1:]:
        with open(image_path, 'rb') as f:
            images.append(f.read())
        print(f"Loaded: {image_path}")
    
    # Analyze
    result = analyze_mood_board(images)
    
    print("\n" + "=" * 60)
    print("EXTRACTED VISUAL DIRECTION:")
    print("=" * 60)
    print(result["formatted_guidelines"])
    print("=" * 60)
    print(f"\nTokens used: {result['tokens_used']}")
    print(f"Sections found: {list(result['sections'].keys())}")
