import streamlit as st
from agent import generate_reply

st.set_page_config(
    page_title="Albee • Loïc Twin",
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
        padding-top: 1.2rem;
        padding-bottom: 0.6rem;
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
    .albee-header {
        border-bottom: 1px solid #1f3b1f;
        padding: 0.6rem 0 0.7rem 0;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
    }

    .albee-logo {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    .albee-title {
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #eaffea;
    }

    .albee-subtitle {
        font-size: 0.75rem;
        color: #7fb67f;
    }

    .albee-status {
        font-size: 0.75rem;
        color: #8bff8b;
        white-space: nowrap;
    }

    .albee-status span.dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #8bff8b;
        margin-right: 0.25rem;
        box-shadow: 0 0 6px #8bff8b;
    }

    /* CORE AREA */
    .albee-core {
        min-height: 60vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding-top: 2.8rem;
        padding-bottom: 2.4rem;
        text-align: center;
    }

    .albee-core-box {
        width: 260px;
        height: 160px;
        border-radius: 4px;
        border: 1px solid #355c35;
        box-shadow: 0 0 0 1px rgba(13, 26, 13, 0.9);
        background: radial-gradient(circle at 50% 0%, #071107 0, #020308 80%);
        position: relative;
        margin-bottom: 1.1rem;
        overflow: hidden;
    }

    /* simple "activity" animation around the core */
    .albee-core-box::before {
        content: "[ ONLINE CORE ]";
        position: absolute;
        top: 8px;
        left: 10px;
        font-size: 0.7rem;
        color: #7fb67f;
    }

    .albee-core-box::after {
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

    .albee-core-caption {
        font-size: 0.8rem;
        color: #9adf9a;
        max-width: 360px;
    }

    .albee-core-caption span {
        color: #eaffea;
    }

    /* ANSWER BOX */
    .albee-answer {
        max-width: 640px;
        border-radius: 4px;
        border: 1px solid #294729;
        background: #05080a;
        padding: 0.8rem 0.9rem;
        font-size: 0.86rem;
        color: #c5f5c5;
        box-shadow: 0 0 0 1px rgba(2, 8, 4, 0.9);
        margin: 0 auto 0.8rem auto;
    }

    .albee-answer-label {
        font-size: 0.72rem;
        color: #7fb67f;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        margin-bottom: 0.25rem;
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
    .albee-footer {
        font-size: 0.7rem;
        color: #5e8f5e;
        text-align: center;
        margin-top: 0.1rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------- HEADER ----------
st.markdown(
    """
    <div class="albee-header">
        <div class="albee-logo">
            <div class="albee-title">ALBEE // LOÏC TWIN CONSOLE</div>
            <div class="albee-subtitle">personal digital presence interface</div>
        </div>
        <div class="albee-status">
            <span class="dot"></span>ONLINE  |  PERSONA + MEMORY
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ---------- CORE + ANSWER PLACEHOLDER ----------
st.markdown(
    """
    <div class="albee-core">
        <div class="albee-core-box"></div>
        <div class="albee-core-caption">
            <span>Core status:</span> running.  
            Ask something you would ask your future self.
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

answer_placeholder = st.empty()

# ---------- STATE ----------
if "history" not in st.session_state:
    st.session_state["history"] = []

# ---------- PROMPT ----------
user_input = st.chat_input("Ask something to your Loïc-Albee twin...")

if user_input:
    st.session_state["history"].append({"role": "user", "content": user_input})
    history_for_agent = st.session_state["history"][:-1]

    reply = generate_reply(history_for_agent, user_input)
    st.session_state["history"].append({"role": "assistant", "content": reply})

    answer_html = f"""
    <div class="albee-answer">
        <div class="albee-answer-label">LOÏC-ALBEE</div>
        <div>{reply}</div>
    </div>
    """
    answer_placeholder.markdown(answer_html, unsafe_allow_html=True)

st.markdown(
    """
    <div class="albee-footer">
        [ POC BUILD ] local twin console • persona + documents loaded from <code>/data</code>
    </div>
    """,
    unsafe_allow_html=True,
)
