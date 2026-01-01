"""
LLM-based Response Formatter for Native Agents

Uses OpenAI to generate contextual, natural language responses for complex queries.
"""

import os
from typing import Dict, Any, Optional, List
import openai
from openai import AsyncOpenAI


class LLMFormatter:
    """
    Formats weather data into natural language responses using LLM.
    
    Used for complex queries that need:
    - Contextual understanding (e.g., "Can I wear shorts?")
    - Follow-up questions (e.g., "And the day after?")
    - Activity recommendations
    - Natural conversation
    """
    
    def __init__(self):
        """Initialize LLM formatter with OpenAI client"""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    
    async def format_response(
        self,
        user_query: str,
        weather_data: Dict[str, Any],
        location_name: str,
        user_name: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Format weather data into a natural language response.
        
        Args:
            user_query: The user's question
            weather_data: Raw weather data from API
            location_name: Name of the location
            user_name: User's display name for personalization
            conversation_history: Previous conversation messages
            
        Returns:
            Natural language response
        """
        
        # Build system prompt
        system_prompt = self._build_system_prompt()
        
        # Build user prompt with weather data
        user_prompt = self._build_user_prompt(
            user_query=user_query,
            weather_data=weather_data,
            location_name=location_name,
            user_name=user_name
        )
        
        # Build messages
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add conversation history if available
        if conversation_history:
            for msg in conversation_history[-4:]:  # Last 4 messages for context
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        # Add current query
        messages.append({"role": "user", "content": user_prompt})
        
        # Call OpenAI
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            # Fallback to simple format on error
            return f"I couldn't generate a detailed response. Error: {str(e)}\n\nWeather data: {self._simple_format(weather_data, location_name)}"
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for the LLM"""
        return """You are a helpful weather assistant. Your role is to:

1. Answer weather-related questions directly and concisely
2. Provide specific recommendations when asked (e.g., clothing, activities)
3. Use the provided weather data to give accurate information
4. Be conversational and friendly
5. Reference previous conversation context when relevant

Guidelines:
- If asked about clothing (shorts, jacket, etc.), consider:
  * Temperature (shorts: >20°C, jacket: <15°C)
  * Precipitation (umbrella if rain expected)
  * Wind (mention if strong winds)
- If asked about activities, consider weather conditions
- Keep responses concise but helpful (2-4 sentences typically)
- Use temperature in Celsius
- Include relevant emojis for visual appeal (☀️🌧️❄️🌤️☁️)
- Always mention the location being referenced

Format:
- Start with a direct answer to the question
- Provide supporting weather details
- End with a recommendation if applicable"""
    
    def _build_user_prompt(
        self,
        user_query: str,
        weather_data: Dict[str, Any],
        location_name: str,
        user_name: Optional[str] = None
    ) -> str:
        """Build the user prompt with weather data"""
        
        # Extract relevant weather information
        weather_summary = self._extract_weather_summary(weather_data)
        
        greeting = f"User: {user_name}" if user_name else "User"
        
        prompt = f"""{greeting} asks: "{user_query}"

Location: {location_name}

Current Weather Data:
{weather_summary}

Please provide a helpful, direct answer to their question based on this weather data."""
        
        return prompt
    
    def _extract_weather_summary(self, weather_data: Dict[str, Any]) -> str:
        """Extract and format key weather information"""
        
        summary_parts = []
        
        # Current weather
        if "current" in weather_data:
            current = weather_data["current"]
            summary_parts.append("Current conditions:")
            summary_parts.append(f"  - Temperature: {current.get('temperature_2m')}°C")
            summary_parts.append(f"  - Feels like: {current.get('apparent_temperature')}°C")
            summary_parts.append(f"  - Humidity: {current.get('relative_humidity_2m')}%")
            summary_parts.append(f"  - Wind: {current.get('wind_speed_10m')} km/h")
            
            precip = current.get('precipitation', 0)
            if precip > 0:
                summary_parts.append(f"  - Precipitation: {precip} mm")
        
        # Daily forecast
        if "daily" in weather_data:
            daily = weather_data["daily"]
            times = daily.get("time", [])
            temp_max = daily.get("temperature_2m_max", [])
            temp_min = daily.get("temperature_2m_min", [])
            precip_sum = daily.get("precipitation_sum", [])
            
            summary_parts.append("\nForecast:")
            for i in range(min(3, len(times))):
                day_name = "Today" if i == 0 else "Tomorrow" if i == 1 else times[i]
                summary_parts.append(f"  {day_name}:")
                summary_parts.append(f"    - Temp: {temp_min[i]}°C to {temp_max[i]}°C")
                if precip_sum[i] > 0.5:
                    summary_parts.append(f"    - Rain: {precip_sum[i]} mm")
                else:
                    summary_parts.append(f"    - Conditions: Dry")
        
        # Hourly forecast (if available)
        if "hourly" in weather_data and not summary_parts:
            # Use hourly if no current/daily data
            hourly = weather_data["hourly"]
            summary_parts.append("Hourly forecast available (showing next few hours)")
        
        return "\n".join(summary_parts) if summary_parts else "Weather data available"
    
    def _simple_format(self, weather_data: Dict[str, Any], location_name: str) -> str:
        """Simple fallback format without LLM"""
        
        if "current" in weather_data:
            current = weather_data["current"]
            temp = current.get('temperature_2m', 'N/A')
            return f"Current weather in {location_name}: {temp}°C"
        
        return f"Weather data for {location_name} is available."


# Singleton instance
_llm_formatter_instance = None


def get_llm_formatter() -> LLMFormatter:
    """
    Get the global LLM formatter instance.
    """
    global _llm_formatter_instance
    if _llm_formatter_instance is None:
        _llm_formatter_instance = LLMFormatter()
    return _llm_formatter_instance




