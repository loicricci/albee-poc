# AutoPost Diagnostic Tool

A standalone diagnostic UI for end-to-end analysis and testing of the autopost generation flow. This tool is completely independent from the main application and provides detailed insights into every step of the post generation process.

## 🎯 Purpose

The AutoPost Diagnostic Tool helps you:

- **Analyze** the complete autopost flow step-by-step
- **Monitor** timing and performance for each phase
- **Debug** issues by seeing all intermediate data
- **Test** different configurations (image engines, topics, categories)
- **Improve** the system based on detailed metrics

## 🚀 Getting Started

### 1. Start the Backend Server

Make sure your backend server is running:

```bash
cd backend
uvicorn main:app --reload
```

The server should be running at `http://localhost:8000`

### 2. Open the Diagnostic UI

Simply open the HTML file in your browser:

```bash
open autopost_diagnostic.html
```

Or navigate to: `file:///path/to/gabee-poc/autopost_diagnostic.html`

### 3. Configure Authentication

1. **Get Your Auth Token**:
   - Open your main app in the browser
   - Log in as usual
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run: `localStorage.getItem('supabase.auth.token')`
   - Copy the JWT token (the part between quotes after `"access_token":"`)

2. **Enter Configuration**:
   - API Endpoint: `http://localhost:8000` (default)
   - Auth Token: Paste the JWT token you copied

### 4. Load Agents

Click **"Load Agents"** to fetch all available agents from your account.

Select an agent from the list - the Agent ID will auto-populate.

### 5. Configure Generation

Set your test parameters:

- **Topic**: Leave empty for auto-fetch from news, or specify a custom topic
- **Category**: Filter news by category (technology, science, etc.)
- **Image Engine**: Choose between DALL-E 3 or GPT-Image-1

### 6. Generate & Analyze

Click **"Generate Post"** and watch the diagnostic data appear in real-time!

## 📊 What You'll See

### Summary Cards

- **Total Duration**: Complete end-to-end time
- **Steps Completed**: Number of successful steps
- **Post ID**: Generated post identifier
- **Image Engine**: Which AI model was used

### Detailed Step Analysis

Each step shows:

- ✅/❌ **Status**: Success or failure indicator
- ⏱️ **Duration**: Time taken for that step
- 📋 **Data**: Complete input/output data for the step

#### Steps Tracked:

1. **Fetch/Use Topic**: News API call or custom topic
2. **Load Agent Context**: RAG context, persona, reference images
3. **Generate Image Prompt + Title**: Parallel AI calls
4. **Generate Description**: GPT-4o call
5. **Generate Image**: DALL-E 3 or GPT-Image-1
6. **Upload & Create Post**: Supabase storage and database

### Step Details

Click on any step header to expand and see:

- **Timing metrics**: Exact duration in seconds
- **Success status**: Whether the step completed successfully
- **Generated content**: 
  - Topics and descriptions
  - AI prompts (image and edit prompts)
  - Generated text (titles, descriptions)
  - Image URLs and file paths
- **API responses**: Complete JSON data
- **Error traces**: Full stack traces if something fails

### Visual Output

- **Generated Images**: View the created images inline
- **JSON Formatting**: Syntax-highlighted JSON for easy reading
- **Post Links**: Direct links to view the created post

## 🔍 Use Cases

### Performance Analysis

Track timing for each step to identify bottlenecks:

```
Step 1: Fetch topic          → 0.234s
Step 2: Load context         → 0.891s  ⚠️ Slow
Step 3: Generate prompts     → 2.145s
Step 4: Generate image       → 8.234s  ⚠️ Bottleneck
Step 5: Create post          → 0.456s
```

### Prompt Engineering

See exactly what prompts are sent to each AI model:

- Image generation prompts (DALL-E 3)
- Edit instructions (GPT-Image-1)
- Description generation prompts (GPT-4o)

### Image Engine Comparison

Test the same topic with different engines:

1. Generate with DALL-E 3
2. Note the result and timing
3. Generate with GPT-Image-1
4. Compare quality and performance

### Error Debugging

When something fails:

- See which step failed
- View the complete error message
- Check the error trace
- Review all steps that completed before the error

### Topic Testing

Test how different topics work:

- Try manual topics vs auto-fetched
- Test different categories
- See how the agent responds to various themes

## 🛠️ Technical Details

### Architecture

The diagnostic tool consists of:

1. **HTML UI** (`autopost_diagnostic.html`): 
   - Standalone, no dependencies
   - Modern responsive design
   - Real-time updates

2. **Diagnostic API** (`backend/autopost_diagnostic_api.py`):
   - FastAPI router at `/auto-post/diagnostic`
   - Step-by-step logging
   - Complete data capture

3. **Integration**: 
   - Registered in `backend/main.py`
   - Uses existing autopost infrastructure
   - No modifications to main flow

### API Endpoint

**POST** `/auto-post/diagnostic/generate`

Request:
```json
{
  "avee_id": "agent-uuid",
  "topic": "Optional custom topic",
  "category": "technology",
  "image_engine": "dall-e-3"
}
```

Response:
```json
{
  "success": true,
  "agent_handle": "eltonjohn",
  "total_duration": 12.345,
  "steps": [
    {
      "step_number": 1,
      "step_name": "Fetch/use topic",
      "duration": 0.234,
      "success": true,
      "data": { ... }
    },
    ...
  ],
  "messages": [
    {"timestamp": 0.0, "message": "Starting..."},
    ...
  ],
  "final_result": {
    "post_id": "...",
    "image_url": "...",
    "view_url": "..."
  }
}
```

### Data Captured

Each step captures relevant data:

- **Topic Step**: Topic text, source, category
- **Context Step**: Agent name, document count, reference images
- **Prompt Step**: Generated prompts and titles, character counts
- **Description Step**: Full description text
- **Image Step**: File path, size, engine used, image URL
- **Post Step**: Post ID, URLs, metadata

### Security

- Requires valid Supabase JWT token
- Respects agent ownership and admin permissions
- Same authorization as main autopost API

## 📝 Tips & Tricks

### Getting Auth Tokens

**Chrome/Edge**:
```javascript
// In console:
localStorage.getItem('supabase.auth.token')
```

**Firefox**:
```javascript
// In console:
localStorage.getItem('supabase.auth.token')
```

### Testing Multiple Scenarios

Keep the diagnostic UI open and test rapidly:

1. Generate with Topic A → Analyze
2. Change topic to B → Generate → Analyze
3. Switch image engine → Generate → Compare
4. Clear and repeat

### Comparing Results

Open multiple browser tabs with the diagnostic UI to compare:

- Tab 1: DALL-E 3 results
- Tab 2: GPT-Image-1 results
- Tab 3: Different topics

### Saving Results

Use browser tools to save diagnostic data:

1. Right-click in the output panel
2. "Inspect Element"
3. Copy the data from the expanded step
4. Save to file for later analysis

### Performance Testing

For baseline performance metrics:

1. Test same configuration 3-5 times
2. Note durations for each step
3. Calculate averages
4. Identify outliers

## 🔧 Troubleshooting

### "Failed to load agents"

- Check that backend server is running
- Verify API endpoint is correct
- Ensure auth token is valid (not expired)

### "Not authorized" Error

- Token may be expired - get a fresh one
- Verify you own the agent (or are admin)
- Check that you're logged in to the main app

### No Image Displayed

- Check browser console for CORS errors
- Verify image URL is accessible
- Ensure Supabase storage is configured correctly

### Slow Response

- Backend may be processing - wait patiently
- Image generation takes 5-15 seconds typically
- Check backend logs for actual progress

## 🎨 UI Features

### Collapsible Steps

Click any step header to expand/collapse details. This keeps the view clean while allowing deep inspection when needed.

### Syntax Highlighting

JSON data is automatically formatted and syntax-highlighted:

- 🔴 Keys in red
- 🟢 Strings in green
- 🟡 Numbers in orange
- 🔵 Booleans in blue

### Responsive Design

The UI adapts to your screen size:

- Desktop: Side-by-side layout
- Tablet/Mobile: Stacked layout

### Status Banner

Real-time status at the top:

- 🔵 Blue: Generation in progress
- 🟢 Green: Success
- 🔴 Red: Error

## 📚 Example Analysis Workflow

### Scenario: Improving Image Quality

1. **Baseline Test**
   - Generate post with current settings
   - Note image quality and prompt
   - Record timing

2. **Test Different Engine**
   - Switch from DALL-E 3 to GPT-Image-1
   - Keep same topic
   - Compare results

3. **Test with Reference Image**
   - Ensure agent has reference images
   - Use GPT-Image-1 (uses references)
   - Compare to pure generation

4. **Analyze Prompts**
   - Expand Step 3 details
   - Review image prompt text
   - Consider prompt engineering improvements

5. **Iterate**
   - Make changes to prompt generation code
   - Re-test with diagnostic tool
   - Compare before/after

## 🚦 Next Steps

After using the diagnostic tool to identify improvements:

1. **Document Findings**: Note what you learned
2. **Plan Changes**: Decide what to optimize
3. **Implement**: Make code changes
4. **Re-test**: Use diagnostic tool to verify improvements
5. **Deploy**: Roll out improvements to production

## 📖 Related Documentation

- `DAILY_POST_GENERATOR_README.md` - Main autopost documentation
- `AUTOPOST_IMAGE_ENGINE_IMPLEMENTATION_COMPLETE.md` - Image engine details
- `MULTIPLE_REFERENCE_IMAGES_QUICK_START.md` - Reference image system

## 🤝 Support

If you encounter issues or have questions:

1. Check the troubleshooting section above
2. Review backend logs: `backend/logs/`
3. Check browser console for JavaScript errors
4. Verify all environment variables are set

---

**Happy Debugging! 🎉**

Use this tool to understand, analyze, and improve the autopost generation flow. Every insight makes the system better!



