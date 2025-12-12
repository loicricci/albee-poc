import streamlit as st
from agent import generate_reply, AGENT_CONFIGS
import os
from datetime import datetime
import rag_multi
import url_scraper

st.set_page_config(
    page_title="Gabee • Loïc Twin",
    page_icon="⌘",
    layout="wide",
)

# ---------- GLOBAL CSS: RETRO TERMINAL STYLE ----------
st.markdown(
    """
    <style>
    /* GLOBAL */
    .stApp {
        background: #020308;
        color: #c5f5c5;
        font-family: "SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
    }

    .block-container {
        max-width: 820px;
        padding-top: 2.5rem;
        padding-bottom: 2rem;
    }

    /* LIGHT SCANLINE EFFECT */
    .stApp::before {
        content: "";
        pointer-events: none;
        position: fixed;
        inset: 0;
        background-image: linear-gradient(
            rgba(0, 0, 0, 0.35) 1px,
            transparent 1px
        );
        background-size: 100% 2px;
        mix-blend-mode: soft-light;
        opacity: 0.4;
        z-index: -1;
    }

    /* HEADER: OLD SYSTEM BAR */
    .gabee-header {
        border-bottom: 1px solid #1f3b1f;
        padding: 0.8rem 0 1rem 0;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
    }

    .gabee-logo {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    .gabee-title {
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #eaffea;
    }

    .gabee-subtitle {
        font-size: 0.75rem;
        color: #7fb67f;
    }

    .gabee-status {
        font-size: 0.75rem;
        color: #8bff8b;
        white-space: nowrap;
    }

    .gabee-status span.dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #8bff8b;
        margin-right: 0.25rem;
        box-shadow: 0 0 6px #8bff8b;
    }

    /* CORE AREA */
    .gabee-core {
        min-height: 55vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding-top: 3rem;
        padding-bottom: 3rem;
        text-align: center;
    }

    .gabee-core-box {
        width: 280px;
        height: 180px;
        border-radius: 6px;
        border: 1px solid #355c35;
        box-shadow: 0 0 0 1px rgba(13, 26, 13, 0.9), 0 0 20px rgba(139, 255, 139, 0.1);
        background: radial-gradient(circle at 50% 0%, #071107 0, #020308 80%);
        position: relative;
        margin-bottom: 1.5rem;
        overflow: hidden;
        transition: all 0.3s ease;
    }

    .gabee-core-box:hover {
        box-shadow: 0 0 0 1px rgba(13, 26, 13, 0.9), 0 0 30px rgba(139, 255, 139, 0.15);
    }

    /* simple "activity" animation around the core */
    .gabee-core-box::before {
        content: "[ ONLINE CORE ]";
        position: absolute;
        top: 8px;
        left: 10px;
        font-size: 0.7rem;
        color: #7fb67f;
    }

    .gabee-core-box::after {
        content: "";
        position: absolute;
        bottom: 10px;
        left: 10px;
        width: 80px;
        height: 1px;
        background: linear-gradient(
            to right,
            rgba(139, 255, 139, 0.2),
            #8bff8b,
            rgba(139, 255, 139, 0.2)
        );
        animation: sweep 2.2s linear infinite;
    }

    @keyframes sweep {
        0%   { transform: translateX(0); opacity: 0.2; }
        30%  { opacity: 1; }
        100% { transform: translateX(120px); opacity: 0; }
    }

    .gabee-core-caption {
        font-size: 0.8rem;
        color: #9adf9a;
        max-width: 360px;
    }

    .gabee-core-caption span {
        color: #eaffea;
    }

    /* CONVERSATION HISTORY */
    .gabee-conversation {
        max-width: 720px;
        margin: 0 auto 2rem auto;
        padding: 0 0.5rem;
    }

    /* MESSAGE BOX */
    .gabee-message {
        border-radius: 6px;
        border: 1px solid #294729;
        background: #05080a;
        padding: 1rem 1.1rem;
        font-size: 0.86rem;
        margin-bottom: 1rem;
        box-shadow: 0 0 0 1px rgba(2, 8, 4, 0.9);
        transition: all 0.2s ease;
    }

    .gabee-message:hover {
        box-shadow: 0 0 0 1px rgba(2, 8, 4, 0.9), 0 0 12px rgba(139, 255, 139, 0.08);
    }

    .gabee-message.user {
        border-color: #2a4a5c;
        background: #060a0c;
    }

    .gabee-message.user:hover {
        box-shadow: 0 0 0 1px rgba(2, 8, 4, 0.9), 0 0 12px rgba(139, 199, 255, 0.08);
    }

    .gabee-message-label {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        margin-bottom: 0.35rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .gabee-message-label.assistant {
        color: #7fb67f;
    }

    .gabee-message-label.user {
        color: #7fa8bf;
    }

    .gabee-message-label::before {
        content: "";
        display: inline-block;
        width: 5px;
        height: 5px;
        border-radius: 50%;
    }

    .gabee-message-label.assistant::before {
        background: #8bff8b;
        box-shadow: 0 0 4px #8bff8b;
    }

    .gabee-message-label.user::before {
        background: #8bc7ff;
        box-shadow: 0 0 4px #8bc7ff;
    }

    .gabee-message-content {
        color: #c5f5c5;
        line-height: 1.5;
    }

    .gabee-message.user .gabee-message-content {
        color: #b8dce8;
    }

    /* PROMPT INPUT: RETRO FIELD */
    .stChatInput {
        padding-top: 0;
        padding-bottom: 0.3rem;
    }

    .stChatInput textarea {
        border-radius: 4px !important;
        border: 1px solid #294729 !important;
        background: #05080a !important;
        color: #c5f5c5 !important;
        font-family: "SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace !important;
        font-size: 0.86rem !important;
        padding: 0.65rem 0.8rem !important;
    }

    .stChatInput textarea::placeholder {
        color: #5e8f5e !important;
    }

    .stChatInput textarea:focus-visible {
        outline: none !important;
        border-color: #8bff8b !important;
        box-shadow: 0 0 0 1px #8bff8b;
    }

    /* FOOTER NOTE */
    .gabee-footer {
        font-size: 0.7rem;
        color: #5e8f5e;
        text-align: center;
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid #1f3b1f;
    }

    /* CLEAR BUTTON */
    .stButton {
        display: flex;
        justify-content: center;
        margin: 1rem 0 0.5rem 0;
    }

    .stButton > button {
        border-radius: 4px !important;
        border: 1px solid #3a2929 !important;
        background: #0a0505 !important;
        color: #f5c5c5 !important;
        font-family: "SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace !important;
        font-size: 0.75rem !important;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        padding: 0.4rem 0.9rem !important;
        transition: all 0.15s ease;
    }

    .stButton > button:hover {
        border-color: #ff8b8b !important;
        box-shadow: 0 0 8px rgba(255, 139, 139, 0.3);
        background: #120808 !important;
    }

    /* EXPANDER (CONTRIBUTION FORM) */
    .streamlit-expanderHeader {
        border: 1px solid #294729 !important;
        border-radius: 4px !important;
        background: #05080a !important;
        color: #c5f5c5 !important;
        font-family: "SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace !important;
        font-size: 0.85rem !important;
        padding: 0.7rem 0.9rem !important;
    }

    .streamlit-expanderHeader:hover {
        border-color: #8bff8b !important;
        box-shadow: 0 0 6px rgba(139, 255, 139, 0.2);
    }

    .streamlit-expanderContent {
        border: 1px solid #294729 !important;
        border-top: none !important;
        border-radius: 0 0 4px 4px !important;
        background: #050809 !important;
        padding: 1.2rem 0.9rem !important;
    }

    /* TEXT INPUTS IN CONTRIBUTION FORM */
    .stTextInput input, .stTextArea textarea, .stSelectbox select {
        border: 1px solid #294729 !important;
        border-radius: 4px !important;
        background: #03060a !important;
        color: #c5f5c5 !important;
        font-family: "SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace !important;
        font-size: 0.82rem !important;
    }

    .stTextInput input:focus, .stTextArea textarea:focus, .stSelectbox select:focus {
        border-color: #8bff8b !important;
        box-shadow: 0 0 0 1px #8bff8b;
    }

    .stTextInput label, .stTextArea label, .stSelectbox label {
        color: #7fb67f !important;
        font-family: "SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace !important;
        font-size: 0.75rem !important;
        text-transform: uppercase;
        letter-spacing: 0.1em;
    }

    /* DIVIDER */
    hr {
        border: none;
        border-top: 1px solid #1f3b1f;
        margin: 2rem 0 1.5rem 0;
    }

    /* SUCCESS/ERROR MESSAGES */
    .stAlert {
        border-radius: 4px !important;
        font-family: "SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace !important;
        font-size: 0.8rem !important;
    }

    /* TYPING INDICATOR */
    .typing-indicator {
        display: inline-block;
        color: #8bff8b;
        font-size: 0.9rem;
        animation: blink 1.2s infinite;
    }

    @keyframes blink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0.3; }
    }

    /* SPINNER OVERRIDE */
    .stSpinner > div {
        border-color: #8bff8b transparent transparent transparent !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------- AGENT SELECTION ----------
if "agent_id" not in st.session_state:
    st.session_state["agent_id"] = "loic"

# Agent selector in sidebar or top
agent_options = {agent_id: config["name"] for agent_id, config in AGENT_CONFIGS.items()}
selected_agent = st.selectbox(
    "Select Agent",
    options=list(agent_options.keys()),
    format_func=lambda x: agent_options[x],
    key="agent_selector",
    index=list(agent_options.keys()).index(st.session_state["agent_id"])
)

if selected_agent != st.session_state["agent_id"]:
    st.session_state["agent_id"] = selected_agent
    # Clear history when switching agents
    if "history" in st.session_state:
        st.session_state["history"] = []
    st.rerun()

current_config = AGENT_CONFIGS[st.session_state["agent_id"]]

# ---------- HEADER ----------
st.markdown(
    f"""
    <div class="gabee-header">
        <div class="gabee-logo">
            <div class="gabee-title">{current_config["title"]}</div>
            <div class="gabee-subtitle">personal digital presence interface</div>
        </div>
        <div class="gabee-status">
            <span class="dot"></span>ONLINE  |  PERSONA + MEMORY
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ---------- CORE (only show if no conversation yet) ----------
if not st.session_state.get("history"):
    st.markdown(
        """
        <div class="gabee-core">
            <div class="gabee-core-box"></div>
            <div class="gabee-core-caption">
                <span>Core status:</span> running.  
                Ask something you would ask your future self.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

# ---------- STATE ----------
if "history" not in st.session_state:
    st.session_state["history"] = []

# ---------- DISPLAY CONVERSATION HISTORY ----------
if st.session_state["history"]:
    st.markdown('<div class="gabee-conversation">', unsafe_allow_html=True)
    
    for msg in st.session_state["history"]:
        role = msg["role"]
        content = msg["content"]
        
        if role == "user":
            label = "YOU"
            label_class = "user"
        else:
            label = current_config["name"]
            label_class = "assistant"
        
        message_html = f"""
        <div class="gabee-message {label_class}">
            <div class="gabee-message-label {label_class}">{label}</div>
            <div class="gabee-message-content">{content}</div>
        </div>
        """
        st.markdown(message_html, unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True)
    
    # Clear conversation button
    st.markdown('<div style="height: 0.5rem;"></div>', unsafe_allow_html=True)
    col_clear = st.columns([1, 1, 1])
    with col_clear[1]:
        if st.button("⌫  CLEAR CONVERSATION", use_container_width=True):
            st.session_state["history"] = []
            st.rerun()

# ---------- PROMPT ----------
agent_name = current_config["name"].replace("-", " ").title()
user_input = st.chat_input(f"Ask something to {agent_name}...")

if user_input:
    # Add user message to history
    st.session_state["history"].append({"role": "user", "content": user_input})
    history_for_agent = st.session_state["history"][:-1]
    
    # Check for URLs in the message and scrape them
    urls = url_scraper.extract_urls(user_input)
    url_status_placeholder = st.empty()
    
    scraped_count = 0
    if urls:
        with url_status_placeholder.container():
            st.info(f"🔗 Detected {len(urls)} URL(s). Scraping content...")
        
        # Actually scrape the URLs here to show results
        scraped_urls = url_scraper.scrape_urls_from_text(user_input, max_urls=3)
        scraped_count = len(scraped_urls)
        
        if scraped_count > 0:
            with url_status_placeholder.container():
                st.success(f"✅ Successfully scraped {scraped_count} URL(s). Analyzing content...")
        elif urls:
            with url_status_placeholder.container():
                st.warning(f"⚠️ Could not scrape {len(urls)} URL(s). They may be inaccessible or require authentication.")
    
    # Create container for streaming
    st.markdown('<div class="gabee-conversation">', unsafe_allow_html=True)
    
    # Display user message
    st.markdown(
        f"""
        <div class="gabee-message user">
            <div class="gabee-message-label user">YOU</div>
            <div class="gabee-message-content">{user_input}</div>
        </div>
        """,
        unsafe_allow_html=True
    )
    
    # Clear URL status after displaying user message
    if urls:
        url_status_placeholder.empty()
    
    # Stream assistant response with typing indicator
    st.markdown(
        f'''
        <div class="gabee-message assistant">
            <div class="gabee-message-label assistant">{current_config["name"]}</div>
            <div class="gabee-message-content">
        ''',
        unsafe_allow_html=True
    )
    
    message_placeholder = st.empty()
    full_response = ""
    
    # Stream tokens with better batching for smoother display
    token_buffer = ""
    buffer_size = 3  # Update every 3 tokens for smoother streaming
    
    for token in generate_reply(history_for_agent, user_input, agent_id=st.session_state["agent_id"], stream=True):
        token_buffer += token
        if len(token_buffer) >= buffer_size:
            full_response += token_buffer
            # Show with typing cursor
            message_placeholder.markdown(full_response + '<span style="color: #8bff8b;">▋</span>', unsafe_allow_html=True)
            token_buffer = ""
    
    # Flush remaining tokens
    if token_buffer:
        full_response += token_buffer
    
    # Final display without cursor
    message_placeholder.markdown(full_response, unsafe_allow_html=True)
    
    st.markdown('</div></div></div>', unsafe_allow_html=True)
    
    # Save complete response to history
    st.session_state["history"].append({"role": "assistant", "content": full_response})
    
    # Rerun to display everything cleanly
    st.rerun()

# ---------- KNOWLEDGE BASE MANAGEMENT ----------
st.markdown("---")
col_reload1, col_reload2, col_reload3 = st.columns([1, 1, 1])
with col_reload2:
    if st.button("🔄  RELOAD KNOWLEDGE BASE", use_container_width=True, help="Manually refresh the RAG index with all documents"):
        try:
            current_agent_id = st.session_state["agent_id"]
            config = AGENT_CONFIGS[current_agent_id]
            data_dir = "data" if current_agent_id == "loic" else "data/victor_hugo"
            persona_file = "persona_loic.md" if current_agent_id == "loic" else "persona_victor_hugo.md"
            rag_multi.reload_index(config["knowledge_base_id"], data_dir, persona_file)
            st.success(f"✅ {current_config['name']} knowledge base reloaded successfully!")
        except Exception as e:
            st.error(f"❌ Failed to reload: {str(e)}")

# ---------- CONTRIBUTION FORM ----------
with st.expander("➕  ADD NEW CONTRIBUTION", expanded=False):
    st.markdown(
        '<div style="color: #9adf9a; font-size: 0.8rem; margin-bottom: 1rem;">Add new information to Loïc\'s knowledge base</div>', 
        unsafe_allow_html=True
    )
    
    col1, col2 = st.columns([3, 1])
    with col1:
        contrib_title = st.text_input("Title", placeholder="e.g., New Project Update", key="contrib_title")
    with col2:
        contrib_topic = st.selectbox("Topic", ["Work", "Personal", "Project", "Idea", "Other"], key="contrib_topic")
    
    contrib_content = st.text_area(
        "Content", 
        placeholder="Write the information you want to add to the knowledge base...",
        height=150,
        key="contrib_content"
    )
    
    col3, col4 = st.columns([2, 1])
    with col3:
        contrib_email = st.text_input("Your Email", value="loic.ricci@gmail.com", key="contrib_email")
    with col4:
        st.markdown('<div style="height: 1.5rem;"></div>', unsafe_allow_html=True)  # Spacer
        save_button = st.button("💾  SAVE CONTRIBUTION", use_container_width=True)
    
    if save_button:
        if contrib_title and contrib_content:
            # Create contribution filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_title = "".join(c if c.isalnum() or c in " _-" else "" for c in contrib_title).replace(" ", "_")
            
            # Save to appropriate directory based on current agent
            current_agent_id = st.session_state["agent_id"]
            if current_agent_id == "victor_hugo":
                contrib_dir = os.path.join("data", "victor_hugo", "contributions")
            else:
                contrib_dir = os.path.join("data", "contributions")
            
            filename = f"{contrib_topic.lower()}_{timestamp}_{safe_title}.md"
            filepath = os.path.join(contrib_dir, filename)
            
            # Create contribution content with metadata
            contribution_md = f"""---
Title: {contrib_title}
Topic: {contrib_topic}
Date: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Contributor: {contrib_email}
---

# {contrib_title}

{contrib_content}
"""
            
            # Save the file
            os.makedirs(contrib_dir, exist_ok=True)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(contribution_md)
            
            # Reload the RAG index to include the new contribution immediately
            try:
                config = AGENT_CONFIGS[current_agent_id]
                data_dir = "data" if current_agent_id == "loic" else "data/victor_hugo"
                persona_file = "persona_loic.md" if current_agent_id == "loic" else "persona_victor_hugo.md"
                rag_multi.reload_index(config["knowledge_base_id"], data_dir, persona_file)
                st.success(f"✅ Contribution saved and indexed! File: `{filename}`")
                st.info("💡 The new information is now available to the agent immediately!")
            except Exception as e:
                st.success(f"✅ Contribution saved! File: `{filename}`")
                st.warning(f"⚠️ File saved but indexing failed: {str(e)}. The agent will use it after restart.")
        else:
            st.error("⚠️ Please fill in both Title and Content fields.")

st.markdown(
    """
    <div class="gabee-footer">
        [ POC BUILD ] local twin console • persona + documents loaded from <code>/data</code>
    </div>
    """,
    unsafe_allow_html=True,
)
