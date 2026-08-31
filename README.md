# TalentFlow AI 🚀
**Autonomous Multi-Agent Career & Interview Simulation Co-pilot**

*Submission for the Google Cloud "All Things Agentic" Hackathon*

---

## 📌 Executive Summary
**TalentFlow AI** is a next-generation career preparation platform powered by **Gemini 3.5 Flash** and Google Cloud. Instead of conventional single-turn conversational chatbots, TalentFlow AI introduces an **autonomous multi-agent system** that simulates real-world high-stakes technical interviews and group dynamics.

The platform analyzes a candidate's resume against targeted job descriptions, detects critical skill gaps, and dynamically orchestrates specialized AI recruiters (HR Facilitator & Technical Lead) who challenge the candidate in real-time. Upon completion, an **Evaluator Agent** performs an in-depth behavioral analysis and produces an **Executive Scorecard** featuring an interactive **Radar Chart** and personalized feedback across core competencies.

---

## 🌟 Key Features & Agentic Behavior

### 1. ATS Ingestion & Gap Detection Tool
- Parses candidates' CVs and cross-references them with specific job descriptions.
- Employs structured tool output (`extract_cv_gaps`) to isolate missing keywords and define strategic focus areas for interviewers.

### 2. Autonomous Supervisor / Orchestration Pattern
- Rather than static prompts, an invisible **Supervisor Agent** inspects candidate arguments in real-time.
- Autonomously routes turns to specialized agents:
  - **Sofia Valente (HR Facilitator):** Focuses on leadership, communication, and team mediation.
  - **Carlos Mendes (Senior Tech Lead):** Skeptical interviewer challenging architecture decisions, scalability, and technical compromises.

### 3. Real-Time Dynamic Evaluation Engine
- The **Evaluator Agent** analyzes the entire session transcript.
- Generates structured JSON metrics (0.0 to 10.0) for:
  - Leadership & Conflict Mediation
  - Assertive Communication (STAR Method)
  - CV Gap Defense
  - Time & Focus Management
- Real-time reactive updates to the **Skills Radar Chart** (Chart.js) and progress bars.

### 4. Enterprise-Grade SaaS UI
- Clean, responsive Light & Dark Mode interface with smooth state transitions.
- Voice-enabled through the Web Speech API with bidirectional closed captions.

---

## 🏗️ System Architecture

```
                      +---------------------------------------+
                      |   Frontend (Vanilla JS + TailwindCSS) |
                      |    - Meeting Studio & Closed Captions |
                      |    - Chart.js Radar Visualization     |
                      |    - Web Speech API (Voice-to-Text)   |
                      +-------------------+-------------------+
                                          |
                                          | HTTP / JSON REST
                                          v
                      +---------------------------------------+
                      |   Google Cloud Run (FastAPI Backend)  |
                      |                                       |
                      |   [Supervisor / Orchestrator Agent]   |
                      |      |              |             |   |
                      |      v              v             v   |
                      |  [ATS Tool]   [Sofia (HR)]  [Carlos]  |
                      |      |                            |   |
                      |      +------------+---------------+   |
                      |                   |                   |
                      |                   v                   |
                      |       [Evaluator Agent (Scorecard)]   |
                      +-------------------+-------------------+
                                          |
                                          | Google GenAI SDK
                                          v
                      +---------------------------------------+
                      |       Gemini Enterprise Platform      |
                      |          (Gemini 3.5 Flash)           |
                      +---------------------------------------+
```

---

## 🧪 Reproducible Testing Instructions

To thoroughly test and verify all agentic workflows, follow this step-by-step test script:

### Step 1: Ingestion & ATS Tool Verification
1. Open `http://localhost:8000`.
2. Click **"Start Interview Simulation →"** on the landing page.
3. Click the **"🪄 Use Sample"** button (this populates a Senior Fullstack Engineer CV and a Tech Lead Job Description).
4. Click **"Analyze Match & Gaps"**.
   - **Verification:** The ATS agent will execute tool calling, detect missing keywords, and automatically compile a customized **Interview Playbook**.

### Step 2: Live Multi-Agent Simulation
1. Click **"Start 1:1 Technical Interview"** or **"Start Group Dynamics"**.
2. Click **"▶ Start"** in the Meeting Studio toolbar.
   - **Verification:** Listen to the high-definition neural voice (powered by Edge/Cloud TTS) as *Sofia* or *Carlos* begins the interview based on the playbook.
3. Click **"💬 Type"** or activate the **"🎙️ Microphone"** to submit a response (e.g., *"We used an active-passive PostgreSQL cluster with Redis caching for high availability"*).
   - **Verification:** The **Supervisor Agent** will analyze the response and route a sharp follow-up challenge to the appropriate interviewer persona.

### Step 3: Executive Scorecard & Competency Radar
1. Click **"🔴 End Simulation"**.
   - **Verification:** The **Evaluator Agent** parses the transcript, assigns structured 0–10 scores, updates the **Chart.js Radar Chart**, and provides actionable feedback across 4 core competencies.

### Step 4: Memory & Session History
1. Click the **"📜 6. History"** tab in the header.
   - **Verification:** Confirm that the completed session, grade, executive summary, and verbatim transcript are persisted.

---

## 🛠️ Tech Stack & Google Cloud Ecosystem

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **LLM Engine** | **Gemini 3.5 Flash** | Ultra-fast agentic reasoning, function calling, and structured JSON generation |
| **SDK / Framework** | **Google GenAI SDK (`google-genai`)** | Official Python SDK managing tools, schemas, and model sessions |
| **Backend** | **Python (FastAPI + Uvicorn)** | Async API Gateway & Multi-Agent State Orchestration |
| **Neural Voice Engine** | **Edge-TTS / Cloud TTS** | High-definition real-time neural audio streaming |
| **Deployment** | **Google Cloud Run** | Scalable containerized serverless hosting |
| **Frontend** | **HTML5, TailwindCSS, Chart.js** | Single Page Application (SPA) with native Dark Mode |

---

## 🚀 Getting Started Locally

### Prerequisites
- Python 3.10+
- Google Cloud Project with the **Gemini API** enabled
- A valid `GEMINI_API_KEY`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/talentflow-ai.git
   cd talentflow-ai
   ```

2. **Install Python dependencies:**
   ```bash
   pip install fastapi uvicorn google-genai pydantic edge-tts
   ```

3. **Configure Environment Variables:**
   Create a `.env` file or export your API key:
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```

4. **Launch the application:**
   ```bash
   python -m uvicorn app:app --port 8000
   ```

5. **Open your browser:**
   Navigate to [http://localhost:8000](http://localhost:8000)

---

## 👥 Hackathon Submission Details
- **Track:** All Things Agentic (Google Cloud)
- **Model Used:** Gemini 3.5 Flash
- **Live Demo URL:** [https://talentflow-ai-609036053311.us-central1.run.app](https://talentflow-ai-609036053311.us-central1.run.app)
- **Demo Video:** *[Insert YouTube Link]*
