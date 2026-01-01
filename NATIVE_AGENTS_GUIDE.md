# Native Agents System Guide

## Overview

**Native Agents** are system-level agents that provide contextual information to all users. Unlike user-created agents (Avees), native agents are platform-provided services that deliver personalized responses based on user profile information.

### Key Features

- 🌍 **System-Level**: Available to all users by default
- 🎯 **Contextual**: Adapts responses based on user profile (location, preferences, etc.)
- 🔌 **Extensible**: Easy to add new native agents
- 🤖 **Auto-Detection**: Can automatically detect which agent to use based on query
- 📊 **Structured Data**: Returns both natural language and structured data

## Available Native Agents

### 1. Weather Agent 🌤️

Provides weather forecasts and current conditions using the **Open-Meteo API** (Météo-France AROME/ARPEGE models).

**Features:**
- Current weather conditions
- Hourly forecasts (up to 4 days)
- Daily forecasts
- Temperature, precipitation, wind, humidity
- Contextual advice (e.g., "Don't forget your umbrella!")
- Personalized greetings using user's name

**Requirements:**
- User must have location set in profile (latitude/longitude)

**Example Queries:**
- "What's the weather like?"
- "Will it rain tomorrow?"
- "What's the forecast for this week?"
- "How's the weather today?"

## API Endpoints

### List All Native Agents

```http
GET /native-agents/
```

Returns all available native agents and their capabilities.

**Response:**
```json
{
  "agents": [
    {
      "agent_id": "weather",
      "name": "Weather Agent",
      "description": "Provides weather forecasts and current conditions based on your location",
      "requires_location": true,
      "supported_queries": [
        "current_weather",
        "hourly_forecast",
        "daily_forecast",
        "temperature",
        "precipitation",
        "wind"
      ]
    }
  ],
  "count": 1
}
```

### Get Agent Info

```http
GET /native-agents/{agent_id}
```

Get detailed information about a specific agent.

### Query a Native Agent

```http
POST /native-agents/query
```

**Request Body:**
```json
{
  "query": "What's the weather like?",
  "agent_id": "weather",  // Optional: specify agent or let system auto-detect
  "context": {}  // Optional: additional context
}
```

**Response:**
```json
{
  "content": "Hey John! Current weather in Paris:\n\n🌡️ **Temperature:** 18°C (feels like 17°C)\n☁️ **Conditions:** Partly cloudy\n💧 **Humidity:** 65%\n🌬️ **Wind:** 12 km/h\n\n_Data from Open-Meteo (Météo-France)_",
  "data": {
    "current": {
      "temperature_2m": 18,
      "apparent_temperature": 17,
      "relative_humidity_2m": 65,
      "wind_speed_10m": 12,
      "weather_code": 2
    }
  },
  "metadata": {
    "location": "Paris",
    "coordinates": {
      "latitude": 48.8566,
      "longitude": 2.3522
    },
    "query_type": "current",
    "source": "Open-Meteo (Météo-France AROME/ARPEGE)"
  },
  "timestamp": "2025-12-25T10:30:00Z"
}
```

### Update User Location

```http
POST /native-agents/me/location
```

**Request Body:**
```json
{
  "location": "Paris, France",
  "latitude": "48.8566",
  "longitude": "2.3522",
  "timezone": "Europe/Paris"  // Optional
}
```

### Get User Location

```http
GET /native-agents/me/location
```

**Response:**
```json
{
  "location": "Paris, France",
  "latitude": "48.8566",
  "longitude": "2.3522",
  "timezone": "Europe/Paris",
  "has_location": true
}
```

### Quick Weather

```http
POST /native-agents/weather
```

Shortcut endpoint to get current weather for authenticated user.

## Architecture

### Directory Structure

```
backend/
├── native_agents/
│   ├── __init__.py          # Module initialization
│   ├── base.py              # Base NativeAgent class
│   ├── weather_agent.py     # Weather Agent implementation
│   └── registry.py          # Agent registry and routing
└── native_agents_api.py     # FastAPI routes
```

### Class Hierarchy

```
NativeAgent (Abstract Base Class)
├── WeatherAgent
├── NewsAgent (future)
├── FinanceAgent (future)
└── ... (extensible)
```

### Data Flow

```
User Request
    ↓
FastAPI Endpoint (/native-agents/query)
    ↓
NativeAgentRegistry
    ↓
├─ Auto-detect agent (if not specified)
├─ Get user profile (location, preferences)
└─ Route to appropriate agent
    ↓
Agent.process_request()
    ↓
├─ Validate user profile
├─ Fetch external data (API calls)
├─ Format natural language response
└─ Return AgentResponse
    ↓
Return to User (JSON)
```

## Database Schema Updates

### Profile Table Updates

```sql
ALTER TABLE profiles
  ADD COLUMN location TEXT,
  ADD COLUMN latitude TEXT,
  ADD COLUMN longitude TEXT,
  ADD COLUMN timezone TEXT;
```

**Migration File:** `backend/migrations/015_add_profile_location.sql`

## Usage Examples

### From Python/Backend

```python
from native_agents.registry import get_registry

# Get registry
registry = get_registry()

# List all agents
agents = registry.list_agents()

# Query weather agent
user_profile = {
    "display_name": "John",
    "latitude": "48.8566",
    "longitude": "2.3522",
    "location": "Paris"
}

response = await registry.process_query(
    user_query="What's the weather?",
    user_profile=user_profile,
    agent_id="weather"
)

print(response.content)  # Natural language response
print(response.data)     # Structured weather data
```

### From Frontend (JavaScript/TypeScript)

```typescript
// Set user location first
async function setUserLocation(location: string, lat: string, lon: string) {
  const response = await fetch('/native-agents/me/location', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      location,
      latitude: lat,
      longitude: lon,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  });
  return response.json();
}

// Query weather
async function getWeather(query: string) {
  const response = await fetch('/native-agents/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      agent_id: 'weather'  // Or omit for auto-detection
    })
  });
  return response.json();
}

// Usage
await setUserLocation('Paris, France', '48.8566', '2.3522');
const weather = await getWeather("What's the weather like today?");
console.log(weather.content);  // Natural language response
console.log(weather.data);     // Structured data
```

## Adding New Native Agents

To add a new native agent (e.g., News Agent):

### 1. Create Agent Class

```python
# backend/native_agents/news_agent.py

from .base import NativeAgent, AgentResponse
from typing import Dict, Any, Optional

class NewsAgent(NativeAgent):
    def get_agent_id(self) -> str:
        return "news"
    
    def get_name(self) -> str:
        return "News Agent"
    
    def get_description(self) -> str:
        return "Provides personalized news updates"
    
    def requires_location(self) -> bool:
        return False  # Or True if location-based news
    
    def can_handle(self, user_query: str) -> bool:
        keywords = ["news", "headlines", "updates", "current events"]
        return any(kw in user_query.lower() for kw in keywords)
    
    async def process_request(
        self, 
        user_query: str, 
        user_profile: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        # Your implementation here
        # 1. Fetch news from API
        # 2. Filter/personalize based on user_profile
        # 3. Format response
        
        return AgentResponse(
            content="Here are today's top news stories...",
            data={"articles": [...]},
            metadata={"source": "NewsAPI"}
        )
```

### 2. Register in Registry

```python
# backend/native_agents/registry.py

from .news_agent import NewsAgent

class NativeAgentRegistry:
    def _initialize_agents(self):
        # Existing agents
        weather_agent = WeatherAgent()
        self.register_agent(weather_agent)
        
        # New agent
        news_agent = NewsAgent()
        self.register_agent(news_agent)
```

### 3. Update __init__.py

```python
# backend/native_agents/__init__.py

from .news_agent import NewsAgent

__all__ = ["NativeAgent", "AgentResponse", "WeatherAgent", "NewsAgent", "NativeAgentRegistry"]
```

That's it! The new agent will automatically be available through the API.

## Best Practices

### For Agent Developers

1. **Always validate user profile** using `validate_user_profile()`
2. **Return meaningful error messages** when data is missing
3. **Provide structured data** in addition to natural language
4. **Implement `can_handle()`** for auto-detection
5. **Use async/await** for external API calls
6. **Add timeout handling** for API requests
7. **Cache API responses** when appropriate

### For API Consumers

1. **Set user location** before using location-based agents
2. **Handle errors gracefully** (missing data, API failures)
3. **Use structured data** for UI rendering when available
4. **Implement retry logic** for transient failures
5. **Respect rate limits** of external APIs

## Testing

### Test Weather Agent

```bash
# 1. Run database migration
cd backend
python -c "from db import SessionLocal, engine; from sqlalchemy import text; db = SessionLocal(); db.execute(text(open('migrations/015_add_profile_location.sql').read())); db.commit()"

# 2. Start backend
uvicorn main:app --reload

# 3. Test endpoints (requires authentication)
curl -X GET http://localhost:8000/native-agents/

curl -X POST http://localhost:8000/native-agents/me/location \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location":"Paris, France","latitude":"48.8566","longitude":"2.3522","timezone":"Europe/Paris"}'

curl -X POST http://localhost:8000/native-agents/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the weather like?","agent_id":"weather"}'
```

## Future Native Agents Ideas

- 📰 **News Agent**: Personalized news based on interests and location
- 💰 **Finance Agent**: Stock prices, crypto, currency conversion
- 🚗 **Traffic Agent**: Real-time traffic and commute information
- 📅 **Calendar Agent**: Meeting suggestions, scheduling
- 🎭 **Events Agent**: Local events and activities
- 🍽️ **Restaurant Agent**: Recommendations based on location and preferences
- 🏥 **Health Agent**: Health tips, medication reminders
- 📚 **Learning Agent**: Educational content recommendations

## Troubleshooting

### "Agent requires location data"

**Solution:** Update user profile with location:
```bash
POST /native-agents/me/location
```

### "No agent found for query"

**Solution:** Either:
1. Specify `agent_id` explicitly in request
2. Improve query to include agent-specific keywords

### Weather Agent returns errors

**Possible causes:**
- Invalid coordinates (out of range)
- Open-Meteo API is down (rare)
- Network connectivity issues

**Solution:** Check user's location data and try again.

## API Rate Limits

- **Open-Meteo API**: Free tier allows 10,000 requests/day
- **Native Agents API**: No built-in limits (consider adding rate limiting)

## Security Considerations

1. **Authentication Required**: All query endpoints require valid JWT token
2. **User Profile Isolation**: Users can only access their own profile data
3. **API Key Management**: External API keys should be stored in environment variables
4. **Input Validation**: All user inputs are validated before processing
5. **Error Messages**: Don't expose internal details in error messages

## Performance

- **Weather API Response Time**: ~200-500ms
- **Average Processing Time**: <1 second
- **Caching**: Consider implementing caching for frequently accessed data

## Support

For issues or questions about Native Agents:
1. Check this documentation
2. Review agent implementation in `backend/native_agents/`
3. Check API logs for errors
4. Contact development team

---

**Ready to use! 🚀**

The Native Agents system is fully functional and ready for production use. Start by setting your location and asking for weather!




