"""
Weather Agent using Open-Meteo API

Provides weather information based on user location.
Uses the Météo-France API from Open-Meteo: https://open-meteo.com/en/docs/meteofrance-api

Enhanced with:
- Hybrid responses (templates + LLM)
- Conversation context tracking
- Intelligent query routing
"""

import httpx
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import re

from .base import NativeAgent, AgentResponse
from .context_manager import get_context_manager
from .query_analyzer import get_query_analyzer
from .llm_formatter import get_llm_formatter
from .config import get_config


class WeatherAgent(NativeAgent):
    """
    Native agent that provides weather information using Open-Meteo API.
    
    Features:
    - Current weather conditions
    - Hourly forecast (up to 4 days)
    - Daily forecast
    - Temperature, precipitation, wind, and more
    - Contextual responses based on user profile
    """
    
    def __init__(self):
        super().__init__()
        self.api_base_url = "https://api.open-meteo.com/v1/meteofrance"
        self.context_manager = get_context_manager()
        self.query_analyzer = get_query_analyzer()
        self.config = get_config()
        # LLM formatter - lazy load to avoid init errors if OPENAI_API_KEY not set
        self._llm_formatter = None
    
    def get_agent_id(self) -> str:
        return "weather"
    
    def get_name(self) -> str:
        return "Weather Agent"
    
    def get_description(self) -> str:
        return "Provides weather forecasts and current conditions based on your location"
    
    def requires_location(self) -> bool:
        return True
    
    def get_supported_query_types(self) -> list[str]:
        return [
            "current_weather",
            "hourly_forecast",
            "daily_forecast",
            "temperature",
            "precipitation",
            "wind"
        ]
    
    def can_handle(self, user_query: str) -> bool:
        """
        Detect if query is weather-related.
        """
        weather_keywords = [
            "weather", "temperature", "rain", "snow", "wind", "forecast",
            "sunny", "cloudy", "cold", "hot", "warm", "humid", "storm",
            "météo", "temps", "pluie", "neige", "vent", "prévisions"
        ]
        
        query_lower = user_query.lower()
        return any(keyword in query_lower for keyword in weather_keywords)
    
    async def process_request(
        self, 
        user_query: str, 
        user_profile: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """
        Process weather request and return formatted response.
        
        Enhanced with hybrid routing:
        - Simple queries use fast template responses
        - Complex queries use LLM for contextual answers
        - Tracks conversation history for follow-ups
        """
        
        # Validate user profile has location
        is_valid, error_msg = self.validate_user_profile(user_profile)
        if not is_valid:
            return AgentResponse(
                content=error_msg,
                data=None,
                metadata={"error": "missing_location"}
            )
        
        # Extract user info
        user_id = user_profile.get("user_id", "unknown")
        user_name = user_profile.get("display_name", user_profile.get("handle", ""))
        latitude = float(user_profile.get("latitude"))
        longitude = float(user_profile.get("longitude"))
        location_name = user_profile.get("location", f"{latitude}, {longitude}")
        timezone = user_profile.get("timezone", "auto")
        
        # Save user query to context
        self.context_manager.add_message(user_id, "user", user_query)
        
        # Analyze query complexity and intent
        has_history = self.context_manager.has_context(user_id)
        query_analysis = self.query_analyzer.analyze_query(user_query, has_history)
        
        # Determine if we should use LLM
        use_llm = self.config.should_use_llm(
            is_complex=query_analysis["is_complex"],
            is_followup=query_analysis["is_followup"]
        )
        
        # Determine what kind of weather info is requested
        query_type = self._detect_query_type(user_query, query_analysis)
        
        try:
            # Fetch weather data from Open-Meteo API
            weather_data = await self._fetch_weather_data(
                latitude=latitude,
                longitude=longitude,
                timezone=timezone,
                query_type=query_type
            )
            
            # Format response - hybrid approach
            if use_llm:
                response_content = await self._format_with_llm(
                    user_query=user_query,
                    weather_data=weather_data,
                    location_name=location_name,
                    user_name=user_name,
                    user_id=user_id
                )
                response_method = "llm"
            else:
                response_content = self._format_response(
                    weather_data=weather_data,
                    user_query=user_query,
                    location_name=location_name,
                    query_type=query_type,
                    user_profile=user_profile
                )
                response_method = "template"
            
            # Save agent response to context
            self.context_manager.add_message(
                user_id, 
                "agent", 
                response_content,
                metadata={
                    "weather_data": weather_data,
                    "location": location_name,
                    "query_type": query_type
                }
            )
            
            return AgentResponse(
                content=response_content,
                data=weather_data,
                metadata={
                    "location": location_name,
                    "coordinates": {"latitude": latitude, "longitude": longitude},
                    "query_type": query_type,
                    "query_analysis": query_analysis,
                    "response_method": response_method,
                    "source": "Open-Meteo (Météo-France AROME/ARPEGE)"
                }
            )
            
        except Exception as e:
            error_msg = f"Sorry, I couldn't fetch weather data at the moment. Error: {str(e)}"
            self.context_manager.add_message(user_id, "agent", error_msg)
            
            return AgentResponse(
                content=error_msg,
                data=None,
                metadata={"error": str(e)}
            )
    
    def _detect_query_type(self, user_query: str, query_analysis: Optional[Dict[str, Any]] = None) -> str:
        """
        Detect what type of weather information is requested.
        
        Enhanced to use query analysis intent if available.
        """
        # Use intent from query analysis if available
        if query_analysis and "intent" in query_analysis:
            intent = query_analysis["intent"]
            if intent in ["rain_forecast", "rain_tomorrow", "tomorrow", "current", "forecast"]:
                return intent
        
        # Fallback to keyword matching
        query_lower = user_query.lower()
        
        # Check for rain-specific queries
        if any(word in query_lower for word in ["rain", "pluie", "pleuvoir", "precipitation", "wet"]):
            if any(word in query_lower for word in ["coming", "next", "days", "week", "jours", "prochains"]):
                return "rain_forecast"
            elif any(word in query_lower for word in ["tomorrow", "demain"]):
                return "rain_tomorrow"
        
        # Check for specific requests
        if any(word in query_lower for word in ["tomorrow", "demain", "next day"]):
            return "tomorrow"
        elif any(word in query_lower for word in ["week", "semaine", "days", "jours", "forecast", "prévisions", "coming", "next few"]):
            return "week"
        elif any(word in query_lower for word in ["now", "current", "currently", "maintenant", "aujourd'hui", "today"]):
            return "current"
        elif any(word in query_lower for word in ["tonight", "ce soir", "evening"]):
            return "tonight"
        else:
            # Default to current + today
            return "current"
    
    async def _fetch_weather_data(
        self,
        latitude: float,
        longitude: float,
        timezone: str = "auto",
        query_type: str = "current"
    ) -> Dict[str, Any]:
        """
        Fetch weather data from Open-Meteo API.
        """
        
        # Build parameters based on query type
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "timezone": timezone,
        }
        
        # Add current weather
        params["current"] = [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "precipitation",
            "rain",
            "weather_code",
            "cloud_cover",
            "wind_speed_10m",
            "wind_direction_10m"
        ]
        
        # Add hourly forecast for more detailed queries
        if query_type in ["current", "tonight", "tomorrow"]:
            params["hourly"] = [
                "temperature_2m",
                "precipitation_probability",
                "precipitation",
                "weather_code",
                "wind_speed_10m"
            ]
            params["forecast_days"] = 2
        
        # Add daily forecast for week view, tomorrow, or rain queries
        if query_type in ["tomorrow", "week", "rain_forecast", "rain_tomorrow"]:
            params["daily"] = [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max"
            ]
            # Use more days for week forecast
            if query_type == "week":
                params["forecast_days"] = 4
            else:
                params["forecast_days"] = 2
        
        # Convert lists to comma-separated strings
        for key in ["current", "hourly", "daily"]:
            if key in params and isinstance(params[key], list):
                params[key] = ",".join(params[key])
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(self.api_base_url, params=params)
            response.raise_for_status()
            return response.json()
    
    def _format_response(
        self,
        weather_data: Dict[str, Any],
        user_query: str,
        location_name: str,
        query_type: str,
        user_profile: Dict[str, Any]
    ) -> str:
        """
        Format weather data into a natural language response.
        """
        
        # Get user's name for personalization
        user_name = user_profile.get("display_name", user_profile.get("handle", ""))
        greeting = f"Hey {user_name}! " if user_name else "Hello! "
        
        # Get current weather data
        current = weather_data.get("current", {})
        temp = current.get("temperature_2m")
        feels_like = current.get("apparent_temperature")
        humidity = current.get("relative_humidity_2m")
        wind_speed = current.get("wind_speed_10m")
        weather_code = current.get("weather_code", 0)
        precipitation = current.get("precipitation", 0)
        
        # Weather code to description mapping (WMO Weather interpretation codes)
        weather_desc = self._get_weather_description(weather_code)
        
        if query_type == "current":
            response = f"{greeting}Current weather in {location_name}:\n\n"
            response += f"🌡️ **Temperature:** {temp}°C (feels like {feels_like}°C)\n"
            response += f"☁️ **Conditions:** {weather_desc}\n"
            response += f"💧 **Humidity:** {humidity}%\n"
            response += f"🌬️ **Wind:** {wind_speed} km/h\n"
            
            if precipitation > 0:
                response += f"🌧️ **Precipitation:** {precipitation} mm\n"
            
            # Add contextual advice
            if temp < 5:
                response += "\n🧥 It's quite cold! Make sure to dress warmly."
            elif temp > 28:
                response += "\n☀️ It's hot outside! Stay hydrated and wear sunscreen."
            
            if precipitation > 0:
                response += "\n☔ Don't forget your umbrella!"
        
        elif query_type == "tomorrow":
            daily = weather_data.get("daily", {})
            if daily:
                temp_max = daily.get("temperature_2m_max", [None, None])[1]
                temp_min = daily.get("temperature_2m_min", [None, None])[1]
                precip = daily.get("precipitation_sum", [None, None])[1] or 0
                
                response = f"{greeting}Weather forecast for tomorrow in {location_name}:\n\n"
                response += f"🌡️ **Temperature:** {temp_min}°C to {temp_max}°C\n"
                
                if precip > 0.5:
                    response += f"🌧️ **Precipitation:** {precip}mm rain expected\n"
                    response += "\n☔ Don't forget your umbrella!\n"
                else:
                    response += f"☀️ **Conditions:** Dry weather\n"
            else:
                response = f"{greeting}Tomorrow's forecast is not available right now."
        
        elif query_type == "week":
            daily = weather_data.get("daily", {})
            if daily:
                response = f"{greeting}Weather forecast for the next few days in {location_name}:\n\n"
                
                times = daily.get("time", [])
                temp_max_list = daily.get("temperature_2m_max", [])
                temp_min_list = daily.get("temperature_2m_min", [])
                precip_list = daily.get("precipitation_sum", [])
                precip_prob_list = daily.get("precipitation_probability_max", [])
                
                # Count rainy days
                rainy_days = sum(1 for p in precip_list[:4] if p > 0.5)
                total_precip = sum(precip_list[:4])
                
                # Add summary
                if rainy_days > 0:
                    response += f"📊 **Summary:** Expect rain on {rainy_days} day(s) with a total of {total_precip:.1f}mm of precipitation.\n\n"
                else:
                    response += f"☀️ **Summary:** No significant rain expected in the coming days!\n\n"
                
                for i in range(min(4, len(times))):
                    date = times[i]
                    day_name = self._get_day_name(date, i)
                    response += f"**{day_name}** ({date}):\n"
                    response += f"  🌡️ {temp_min_list[i]}°C - {temp_max_list[i]}°C"
                    
                    # Always show precipitation
                    if precip_list[i] > 0.5:
                        response += f" | 🌧️ {precip_list[i]}mm rain"
                        if precip_prob_list and i < len(precip_prob_list):
                            response += f" ({precip_prob_list[i]}% chance)"
                    else:
                        response += f" | ☀️ Dry"
                    response += "\n\n"
                
                # Add advice
                if rainy_days > 2:
                    response += "☔ **Tip:** Keep an umbrella handy this week!\n"
                elif rainy_days == 0:
                    response += "😎 **Tip:** Great week for outdoor activities!\n"
            else:
                response = f"{greeting}Weekly forecast is not available right now."
        
        elif query_type == "rain_forecast":
            # Specific rain forecast for coming days
            daily = weather_data.get("daily", {})
            if daily:
                times = daily.get("time", [])
                precip_list = daily.get("precipitation_sum", [])
                precip_prob_list = daily.get("precipitation_probability_max", [])
                temp_max_list = daily.get("temperature_2m_max", [])
                temp_min_list = daily.get("temperature_2m_min", [])
                
                # Count rainy days
                rainy_days = []
                for i in range(min(4, len(times))):
                    if precip_list[i] > 0.5:  # More than 0.5mm counts as rain
                        rainy_days.append((self._get_day_name(times[i], i), precip_list[i], times[i]))
                
                total_precip = sum(precip_list[:4])
                
                # Direct answer first!
                if len(rainy_days) > 0:
                    response = f"{greeting}**Yes, rain is expected** in {location_name} over the next few days!\n\n"
                    response += f"🌧️ Rain expected on **{len(rainy_days)} day(s)** with a total of **{total_precip:.1f}mm**.\n\n"
                    response += "**Rainy days:**\n"
                    for day_name, precip, date in rainy_days:
                        response += f"  • **{day_name}** ({date}): {precip}mm of rain\n"
                    response += "\n☔ **Recommendation:** Keep an umbrella with you!\n"
                else:
                    response = f"{greeting}**No, no significant rain expected** in {location_name} over the next few days! 🌤️\n\n"
                    response += "**Forecast summary:**\n"
                    for i in range(min(4, len(times))):
                        day_name = self._get_day_name(times[i], i)
                        response += f"  • **{day_name}:** {temp_min_list[i]}°C - {temp_max_list[i]}°C, Dry ☀️\n"
                    response += "\n😎 **Perfect weather for outdoor plans!**\n"
            else:
                response = f"{greeting}Rain forecast is not available right now."
        
        elif query_type == "rain_tomorrow":
            # Specific rain forecast for tomorrow
            daily = weather_data.get("daily", {})
            if daily and len(daily.get("precipitation_sum", [])) > 1:
                precip = daily.get("precipitation_sum", [None, None])[1]
                temp_max = daily.get("temperature_2m_max", [None, None])[1]
                temp_min = daily.get("temperature_2m_min", [None, None])[1]
                
                if precip > 0.5:
                    response = f"{greeting}**Yes, rain is expected tomorrow** in {location_name}! 🌧️\n\n"
                    response += f"• **Precipitation:** {precip}mm of rain\n"
                    response += f"• **Temperature:** {temp_min}°C - {temp_max}°C\n"
                    response += f"\n☔ Don't forget your umbrella tomorrow!\n"
                else:
                    response = f"{greeting}**No, no rain expected tomorrow** in {location_name}! ☀️\n\n"
                    response += f"• **Conditions:** Dry weather\n"
                    response += f"• **Temperature:** {temp_min}°C - {temp_max}°C\n"
                    response += f"\n😎 Great day ahead!\n"
            else:
                response = f"{greeting}Tomorrow's rain forecast is not available right now."
        
        else:
            response = f"{greeting}Current weather in {location_name}: {temp}°C, {weather_desc}"
        
        response += f"\n\n_Data from Open-Meteo (Météo-France)_"
        
        return response
    
    async def _format_with_llm(
        self,
        user_query: str,
        weather_data: Dict[str, Any],
        location_name: str,
        user_name: Optional[str],
        user_id: str
    ) -> str:
        """
        Format response using LLM for contextual, natural answers.
        
        Used for complex queries like:
        - "Can I wear shorts?"
        - "Should I bring an umbrella?"
        - Follow-up questions
        """
        try:
            # Lazy load LLM formatter
            if self._llm_formatter is None:
                self._llm_formatter = get_llm_formatter()
            
            # Get conversation history
            context_messages = self.context_manager.get_context(user_id, limit=4)
            conversation_history = [
                {"role": msg.role, "content": msg.content}
                for msg in context_messages
            ]
            
            # Generate response with LLM
            response = await self._llm_formatter.format_response(
                user_query=user_query,
                weather_data=weather_data,
                location_name=location_name,
                user_name=user_name,
                conversation_history=conversation_history[:-1]  # Exclude current query
            )
            
            response += f"\n\n_Data from Open-Meteo (Météo-France)_"
            return response
            
        except Exception as e:
            # Fallback to template on LLM error
            print(f"LLM formatting failed: {e}, falling back to template")
            return self._format_response(
                weather_data=weather_data,
                user_query=user_query,
                location_name=location_name,
                query_type="current",
                user_profile={"display_name": user_name}
            )
    
    def _get_weather_description(self, weather_code: int) -> str:
        """
        Convert WMO weather code to human-readable description.
        Based on: https://open-meteo.com/en/docs
        """
        weather_codes = {
            0: "Clear sky",
            1: "Mainly clear",
            2: "Partly cloudy",
            3: "Overcast",
            45: "Foggy",
            48: "Depositing rime fog",
            51: "Light drizzle",
            53: "Moderate drizzle",
            55: "Dense drizzle",
            61: "Slight rain",
            63: "Moderate rain",
            65: "Heavy rain",
            71: "Slight snow",
            73: "Moderate snow",
            75: "Heavy snow",
            77: "Snow grains",
            80: "Slight rain showers",
            81: "Moderate rain showers",
            82: "Violent rain showers",
            85: "Slight snow showers",
            86: "Heavy snow showers",
            95: "Thunderstorm",
            96: "Thunderstorm with slight hail",
            99: "Thunderstorm with heavy hail"
        }
        
        return weather_codes.get(weather_code, "Unknown")
    
    def _get_day_name(self, date_str: str, index: int) -> str:
        """Get day name from date string."""
        if index == 0:
            return "Today"
        elif index == 1:
            return "Tomorrow"
        else:
            try:
                date_obj = datetime.fromisoformat(date_str)
                return date_obj.strftime("%A")
            except:
                return f"Day {index + 1}"

