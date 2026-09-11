# TalentFlow AI 🚀
**Autonomous Multi-Agent Career Studio & Executive Interview Simulation Co-pilot**

*Submission for the Google Cloud "All Things Agentic" Hackathon*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-talentflow--hackathon.web.app-blue?style=for-the-badge&logo=google-cloud)](https://talentflow-hackathon.web.app)
[![Google Cloud Run](https://img.shields.io/badge/Google%20Cloud-Run%20%2B%20Firestore-4285F4?style=for-the-badge&logo=google-cloud)](https://talentflow-ai-609036053311.us-central1.run.app)
[![Gemini Engine](https://img.shields.io/badge/AI%20Engine-Gemini%203.6%20Flash%20%2B%203.1%20Pro-8E75B2?style=for-the-badge&logo=googlegemini)](https://aistudio.google.com/)

---

## 📌 Executive Summary
**TalentFlow AI** is an enterprise-grade, domain-agnostic **Agent-as-a-Service (AaaS)** career acceleration platform powered by **Google Gemini** (`gemini-3.6-flash` and `gemini-3.1-pro-preview`) and the **Google Cloud Ecosystem** (Cloud Run, Firebase Hosting, Cloud Firestore).

Instead of conventional, single-prompt conversational chatbots, TalentFlow AI orchestrates an **autonomous pipeline of 4 specialized AI agents** that dynamically adapt to any career domain (Software Engineering, Data Science, Sports Technology, Healthcare, Finance, Marketing, Executive Leadership, etc.).

The platform performs deep ATS gap analysis between a candidate's resume and target position, designs a custom technical playbook, conducts a live 1:1 interview with neural voices and multimodal computer vision, records session audio/video for forensic self-review, and convenes an independent **Bar Raiser Hiring Committee** to produce an **Executive Scorecard** with FAANG decision matrix and actionable *Shadow Coaching* rewrites.

---

## 🤖 Multi-Agent System Architecture (AaaS)

TalentFlow AI follows the **Pipeline & Blackboard Multi-Agent Pattern**, ensuring strict cognitive separation of duties: **the agent who interviews is not the agent who evaluates**.

```
                           +-------------------------------------------------------------+
                           |           Frontend Meeting Studio (SPA + TailwindCSS)       |
                           |  - Real-Time Closed Captions (0ms perceived latency)        |
                           |  - Multimodal Video Understanding (Live Frame Capture)      |
                           |  - SpeechRecognition + HTML5 MediaRecorder (Audio/Video)   |
                           |  - Bilingual Switcher (🇧🇷 Português BR / 🇺🇸 English US)       |
                           +------------------------------+------------------------------+
                                                          | HTTP / JSON REST
                                                          v
+-------------------------------------------------------------------------------------------------------------------------+
|                                    Google Cloud Run Backend (FastAPI + Python)                                          |
|                                                                                                                         |
|  [Agent 1: ATS Profiler & Persona Architect] ---> Compiles Gap Matrix & Dynamic Interviewer Playbook                    |
|                         |                                                                                               |
|                         v                                                                                               |
|  [Agent 2: Adaptive 1:1 Technical Interviewer] <---> [Agent 3: Multimodal Vision Observer]                             |
|    - Provocative domain challenges                    - Non-verbal cues, eye contact, composure                         |
|    - Neural Speech (Edge-TTS)                         - Real-time frame analysis                                        |
|                         |                                                                                               |
|                         v                                                                                               |
|  [Agent 4: Executive Bar Raiser & Hiring Committee]                                                                     |
|    - Neutral audit of complete transcript + vision observations                                                         |
|    - FAANG Hiring Matrix (Strong Hire -> Strong No Hire) & Calibrated Seniority (L3 to L6)                              |
|    - Advanced Diagnostics: Trade-offs, STAR Method, Signal-to-Noise Ratio                                               |
|    - Shadow Coaching (Senior Principal Engineer Rewrites of candidate answers)                                          |
|                         |                                                                                               |
|                         v                                                                                               |
|  [Google Cloud Firestore Session Blackboard] ---> User-partitioned persistent historical telemetry                      |
+---------------------------------------------------------+---------------------------------------------------------------+
                                                          |
                                                          | Google GenAI SDK (Failover Cluster)
                                                          v
                                     +-----------------------------------------+
                                     |    Gemini Enterprise Generative Models   |
                                     |  - Primary: gemini-3.6-flash            |
                                     |  - Failover: gemini-3.1-pro-preview     |
                                     +-----------------------------------------+
```

### The 4 Specialized Agents:
1. **Agent 1 — ATS Profiler & Persona Architect (`/api/analyze`)**:
   - Parses the candidate's CV against any target job description.
   - Extracts matched core competencies, critical missing keywords, and architecture trade-offs.
   - Dynamically constructs the persona and playbook of the ideal lead interviewer.
2. **Agent 2 — Adaptive 1:1 Technical Lead Interviewer (`/api/simulation/turn`)**:
   - Conduits the technical interview turn-by-turn with conversational agility.
   - Pushes the candidate to justify design choices, latency, scalability, and edge cases.
   - Streams synchronized, high-definition neural audio (`pt-BR-AntonioNeural` or `en-US-AndrewNeural`).
3. **Agent 3 — Multimodal Vision Observer (Agentic Video Understanding)**:
   - Samples lightweight compressed frames from the candidate's active camera feed.
   - Evaluates non-verbal executive presence, eye contact, and emotional composure under challenging technical questions without interrupting speech.
4. **Agent 4 — Executive Bar Raiser & Hiring Committee (`/api/evaluate-simulation`)**:
   - An independent, unyielding evaluation committee operating with zero unearned praise.
   - Assigns a calibrated FAANG recommendation (`Strong Hire`, `Hire`, `Lean Hire`, `Lean No Hire`, `Strong No Hire`), estimated seniority level (e.g., *Senior Tech Lead L5*), and market salary benchmark.
   - Produces **Shadow Coaching** rewrites: shows verbatim how a Principal Engineer would articulate the candidate's weakest answers with concrete metrics and architectural rigor.

---

## 🌟 Key Features

### 🇧🇷 1. Native Brazilian Portuguese & Bilingual Support
- **Default pt-BR**: Formulates all technical inquiries, executive dialogue, and evaluation reports in natural, professional Brazilian Portuguese.
- **1-Click Language Switcher**: Seamlessly toggle between `🇧🇷 Português (BR)` and `🇺🇸 English (US)` at any time to prepare for domestic or international Big Tech roles.
- **Neural TTS & Speech Recognition**: Edge-TTS and browser `SpeechRecognition` automatically reconfigure their language models dynamically.

### 📹 2. Session Recording & Forensic Replay (Audio + Video)
- Powered by the native HTML5 **`MediaRecorder API`**:
  - **Camera Active (`CAM ON`)**: Records webcam video and microphone audio concurrently.
  - **Voice-Only Mode**: Records microphone audio in high-fidelity `audio/webm`.
- **In-App Scorecard Player**: Review your own performance right on the scorecard with video/audio playback controls.
- **1-Click Local Download**: Export your recorded simulation (`.webm`) with zero server overhead or third-party cloud storage costs.

### 🔒 3. Interview Turn Guards & Clean Teardown
- **Speech & Chat Lock**: Microphone and text input are strictly disabled before the interviewer finishes formulating and vocalizing their question, preventing overlapping speech.
- **Safe Teardown on "End Simulation"**:
  - Instantly releases webcam hardware tracks (`track.stop()`), turning off the camera light.
  - Aborts active speech recognition streams and silences synthesizer audio.
  - Clears timers and enables instant start of a new interview (`🔄 Iniciar Nova Simulação`).

### 📊 4. Interactive Radar Scorecard & Long-Term Memory
- **4 Core Competencies Radar Chart**: Real-time rendering via Chart.js for *Leadership & Mediation*, *Assertive Communication (STAR)*, *CV Gap Defense*, and *Time & Focus Management*.
- **Google Cloud Firestore Persistence**: Every session transcript, scorecard metrics, and video observations are asynchronously stored with user partitioning.

---

## 🛠️ Tech Stack & Google Cloud Ecosystem

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Generative LLM Engine** | **Gemini 3.6 Flash & 3.1 Pro Preview** | Low-latency multi-agent reasoning, multimodal video analysis, and structured Pydantic outputs |
| **SDK** | **Google GenAI SDK (`google-genai`)** | Official Python SDK managing model configurations and failover resilience |
| **Backend Framework** | **Python (FastAPI + Uvicorn)** | High-throughput asynchronous REST API & multi-agent pipeline |
| **Cloud Hosting** | **Google Cloud Run** | Fully managed serverless container runtime in `us-central1` |
| **Edge CDN** | **Firebase Hosting** | Global low-latency CDN for static assets and client routing |
| **Cloud Database** | **Google Cloud Firestore** | NoSQL session memory, scorecards, and candidate evolution telemetry |
| **Neural Voice Engine** | **Edge-TTS (`edge-tts`)** | Deep executive neural voices (`pt-BR-AntonioNeural` & `en-US-AndrewNeural`) |
| **Client Frontend** | **HTML5, TailwindCSS, Chart.js, Web Speech API** | Single Page Application with Dark/Light modes and MediaRecorder |

---

## 🧪 Quickstart & Local Execution

### Prerequisites
- Python 3.10+
- A Google Cloud Project with the **Gemini API** enabled
- A valid `GEMINI_API_KEY`

### Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/EnzoAS/talentflow-ai.git
   cd talentflow-ai
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *(or `pip install fastapi uvicorn google-genai pydantic edge-tts python-dotenv google-cloud-firestore`)*

3. **Configure Environment Variables:**
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```

4. **Start the local server:**
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

5. **Access the application:**
   Open [http://localhost:8000](http://localhost:8000) in Google Chrome or any modern browser.

---

## ☁️ Production Deployment

### 1. Deploy to Google Cloud Run:
```bash
gcloud run deploy talentflow-ai \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="your_api_key_here"
```

### 2. Deploy Static Frontend to Firebase Hosting:
```bash
firebase deploy --only hosting
```

---

## 👥 Hackathon Submission Details
- **Hackathon:** Google Cloud "All Things Agentic"
- **Category:** Autonomous Agents & Multi-Agent Architectures (AaaS)
- **Production URL:** [https://talentflow-hackathon.web.app](https://talentflow-hackathon.web.app)
- **Cloud Run Origin:** [https://talentflow-ai-609036053311.us-central1.run.app](https://talentflow-ai-609036053311.us-central1.run.app)
- **GitHub Repository:** [https://github.com/EnzoAS/talentflow-ai](https://github.com/EnzoAS/talentflow-ai)
- **License:** Apache 2.0