from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import json
from google import genai
from google.genai import types

app = FastAPI(title="TalentFlow AI Backend")

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
INDEX_PATH = os.path.join(STATIC_DIR, "index.html")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    return FileResponse(INDEX_PATH)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Initialize Gemini Client (reads GEMINI_API_KEY from environment / .env)
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("\ufeffGEMINI_API_KEY", "")
client = genai.Client(api_key=api_key) if api_key else genai.Client(api_key="none")
FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.1-pro-preview"]

def generate_structured_gemini(contents, schema, temperature=0.5, max_tokens=1200):
    """
    Resilient caller with automatic multi-model failover for 503/429/404 errors.
    """
    last_err = None
    for model in FALLBACK_MODELS:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=temperature,
                    max_output_tokens=max_tokens
                )
            )
            return json.loads(resp.text)
        except Exception as e:
            print(f"[Gemini Failover] Model {model} failed: {e}. Trying next candidate...")
            last_err = e
            continue
    raise RuntimeError(f"All Gemini models failed: {last_err}")

# --- Models ---
class AnalyzeRequest(BaseModel):
    cv_text: str
    job_text: str

class SimulationTurnRequest(BaseModel):
    mode: str
    dialogue_history: list
    user_message: str
    context: dict

# --- Pydantic Schemas for Gemini Structured Outputs ---

class SkillEvaluation(BaseModel):
    name: str
    score: float
    feedback: str

class ScorecardEvaluationResponse(BaseModel):
    overall_score: float
    summary: str
    skills: list[SkillEvaluation]

class SimulationBotTurnResponse(BaseModel):
    speaker_id: str
    speaker_name: str
    role: str
    avatar: str
    text: str

class ATSAnalysisResponse(BaseModel):
    match_score: int
    domain: str
    interviewer_name: str
    interviewer_role: str
    interviewer_avatar: str
    summary: str
    present_keywords: list[str]
    missing_keywords: list[str]
    simulation_focus: str
    interview_playbook: list[str]

# --- Function Calling & ATS Tool ---

def extract_cv_gaps(cv: str, job: str) -> dict:
    """
    Analyzes the CV against the Job Description, autonomously identifies the career domain (Tech, Marketing, Finance, Sales, Design, Operations, etc.),
    detects skill gaps, and generates an Adaptive Interview Playbook with specialized interviewer personas.
    """
    prompt = f"""
    You are an Expert ATS Evaluator & Multi-Domain Interview Strategist.
    CV: {cv}
    Job Description: {job}
    
    Task:
    1. Identify the domain of the job (e.g. "Software Engineering", "Growth Marketing", "Corporate Finance", "Product Design", "B2B Sales", etc.).
    2. Define a specialized Technical / Domain Interviewer Persona (e.g. for Marketing: "Marcus Vance" / "Head of Growth & Performance"; for Finance: "Robert Sterling" / "Chief Financial Officer"; for Tech: "Carlos Mendes" / "Senior Tech Lead"). For interviewer_avatar, strictly provide a single emoji such as 👨‍💻, 👨‍💼, 👩‍💻, 👩‍💼, 👨‍🔬.
    3. Generate a structured 1:1 Technical Interview Playbook for the domain specialist.
    """
    try:
        return generate_structured_gemini(prompt, ATSAnalysisResponse, temperature=0.3, max_tokens=1000)
    except Exception as e:
        print("[extract_cv_gaps fallback]:", e)
        return {
            "match_score": 85,
            "domain": "Software Engineering",
            "interviewer_name": "Carlos Mendes",
            "interviewer_role": "Senior Tech Lead",
            "interviewer_avatar": "👨‍💻",
            "summary": "Competitive alignment found with key domain gaps to defend.",
            "present_keywords": ["Core Competencies", "Domain Skills"],
            "missing_keywords": ["Advanced Architecture / KPIs"],
            "simulation_focus": "Challenge candidate on edge cases, KPI defense, and leadership trade-offs.",
            "interview_playbook": [
                "Interviewer challenges candidate on crisis handling and architecture scale",
                "Interviewer probes into edge cases, technical trade-offs, and resilience under pressure",
                "Interviewer evaluates technical leadership and system design decisions"
            ]
        }

# --- Endpoints ---

@app.post("/api/analyze-cv")
def analyze_cv_endpoint(req: AnalyzeRequest):
    """
    Endpoint that triggers the ATS Agent tool and builds the domain-adaptive interview playbook.
    """
    result = extract_cv_gaps(req.cv_text, req.job_text)
    return result

@app.post("/api/simulation/turn")
def simulation_turn_endpoint(req: SimulationTurnRequest):
    """
    1:1 Technical Interview Orchestrator:
    Follows the Interview Playbook and candidate responses.
    Exclusively focuses on 1:1 technical interview with the domain expert interviewer.
    Maintains multi-turn conversational context and dynamically adapts to the candidate's language.
    """
    context = req.context or {}
    playbook = context.get('interview_playbook', [])
    playbook_str = "\n".join([f"- {p}" for p in playbook]) if isinstance(playbook, list) else str(playbook)
    
    interviewer_name = context.get('interviewer_name', 'Carlos Mendes')
    interviewer_role = context.get('interviewer_role', 'Senior Tech Lead')
    interviewer_avatar = context.get('interviewer_avatar', '👨‍💻')
    domain = context.get('domain', 'Software Engineering')

    # Pass the last 6 dialogue turns so the AI has rich conversational memory
    recent_history = req.dialogue_history[-6:] if req.dialogue_history else []
    history_lines = "\n".join([f"{m.get('name', 'Speaker')}: {m.get('text', '')}" for m in recent_history])

    # Distinguish between First Question (Kickoff) vs Follow-up Turn
    is_initial = (req.user_message is None or req.user_message.strip() == '')

    panel_instruction = f"""
ACTIVE INTERVIEWER:
- {interviewer_name} (speaker_id: expert): {interviewer_role} in {domain}.
(This is a 1-on-1 technical interview. Only {interviewer_name} conducts the interview.)
"""
    if is_initial:
        turn_instruction = f"""This is the start of the 1:1 technical interview. {interviewer_name} must introduce themselves briefly in English and ask the opening technical question based on the candidate's CV and the {domain} playbook."""
    else:
        turn_instruction = f"""The candidate just answered: "{req.user_message}".
Acknowledge their answer, critically assess their reasoning or technical depth, and challenge them with the NEXT logical follow-up question or trade-off from the playbook in {domain} (1-2 sentences).
Do NOT introduce yourself again. Advance the conversation forward with sharp, domain-specific technical follow-up questions."""

        sys_prompt = f"""
You are {interviewer_name}, {interviewer_role}, conducting a rigorous, authentic 1:1 technical interview in {domain}.

STRATEGIC PLAYBOOK:
{playbook_str if playbook_str else context.get('simulation_focus', '')}

{panel_instruction}

RECENT CONVERSATION HISTORY:
{history_lines if history_lines else "Interview starting now."}

Candidate's latest response: "{req.user_message if req.user_message else 'Candidate joined the room.'}"

TASK & CRITICAL INTERVIEW RULES:
1. NEVER repeat or quote the candidate's words verbatim back to them (NEVER say "Understood regarding '...'" or "Great point on '...'").
2. NEVER give unearned praise or fake validation (DO NOT say "Great point", "Excellent", "Understood" if the candidate gave a circular, evasive, confused answer, or admitted they don't know).
3. CRITICALLY ASSESS THE CANDIDATE'S ACTUAL CONTENT:
   - If the candidate gave a vague, circular, or nonsense answer: Professionally call out the lack of depth or missed question, and challenge them to provide a concrete, real-world example.
   - If the candidate admitted they don't know ("I have no idea", "never worked with this"): Acknowledge the honesty or knowledge gap, and pivot to foundational concepts or an adjacent technical topic.
   - If the candidate provided a strong, structured technical answer: Challenge their design with edge cases, failure scenarios, concurrency, or scale limits.
4. Keep your response concise, punchy, and conversational (1 to 2 sentences max). Advance the interview forward like an authentic senior tech lead.

LANGUAGE INSTRUCTION:
The primary language of this simulation is English (en-US). If the candidate speaks or writes in English, reply in natural, professional English. If the candidate explicitly speaks or writes in Portuguese, adapt and reply in Portuguese.
"""
    
    try:
        bot_reply = generate_structured_gemini(sys_prompt, SimulationBotTurnResponse, temperature=0.7, max_tokens=1000)
        bot_reply["speaker_id"] = "expert"
        bot_reply["speaker_name"] = interviewer_name
        bot_reply["role"] = interviewer_role
        bot_reply["avatar"] = interviewer_avatar
        bot_reply["tokens_estimated"] = len(bot_reply.get("text", "").split()) * 2
        return bot_reply
    except Exception as e:
        print("SIMULATION TURN ALL-MODELS ERROR:", e)
        # Dynamic progressive heuristic fallback without repeating user's words or giving fake praise
        step = len(req.dialogue_history)
        fallback_questions = [
            f"Hello! I'm {interviewer_name}, {interviewer_role}. To kick off our technical interview in {domain}, could you describe the most critical architecture or scalability challenge you've led recently?",
            "That response doesn't quite address the core challenge directly. Could you give me a specific, concrete example of how you resolved that in production?",
            "I see. Stepping back to the architectural fundamentals, how do you handle state management, caching, and failover under high load?",
            "Let's move to another key competency. How do you technically mediate when two senior engineers on your team disagree on a major design decision?"
        ]
        chosen_text = fallback_questions[min(step // 2, len(fallback_questions) - 1)]

        return {
            "speaker_id": "expert",
            "speaker_name": interviewer_name,
            "role": interviewer_role,
            "avatar": interviewer_avatar,
            "text": chosen_text,
            "tokens_estimated": 25
        }

from fastapi.responses import FileResponse, Response
import edge_tts
import asyncio

class TTSRequest(BaseModel):
    text: str
    speaker_id: str
    lang: str = "en-US"

@app.post("/api/tts")
async def generate_speech_endpoint(req: TTSRequest):
    """
    Generates high-definition neural voices for the 1:1 interviewer.
    Maintains a strictly consistent single male voice:
    - Portuguese: 'pt-BR-AntonioNeural' (Deep, natural, professional executive voice)
    - English: 'en-US-AndrewNeural' (Confident, professional executive voice)
    """
    is_pt = bool(req.lang and req.lang.lower().startswith("pt"))
    voice = "pt-BR-AntonioNeural" if is_pt else "en-US-AndrewNeural"
    
    communicate = edge_tts.Communicate(req.text, voice)
    audio_data = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data.extend(chunk["data"])
            
    return Response(content=bytes(audio_data), media_type="audio/mpeg")

class EvaluationRequest(BaseModel):
    dialogue_history: list
    job_context: dict = None
    user_id: str = "anonymous_default"

@app.post("/api/evaluate-simulation")
def evaluate_simulation_endpoint(req: EvaluationRequest):
    """
    Evaluates the user's transcript and calculates realistic scores based on performance in English with structured Pydantic schema.
    """
    transcript_text = "\n".join([f"{m.get('name', 'User')}: {m.get('text', '')}" for m in req.dialogue_history])
    
    eval_prompt = f"""
    You are an Executive HR & Domain Lead Evaluator.
    Analyze the candidate's real interview transcript below and assign strict, realistic scores from 0.0 to 10.0 based on their actual response quality in English.
    
    Evaluation Rules:
    - If candidate gave evasive, nonsensical, or superficial answers (e.g. testing keywords, complaining), assign low scores (1.0 to 4.0).
    - If candidate demonstrated structured communication (STAR method), domain knowledge, and clear trade-off justification, assign high scores (7.5 to 9.5).
    - Always evaluate all 4 competencies: 'Leadership & Mediation', 'Assertive Communication', 'CV Gap Defense', 'Time & Focus Management'.
    
    FULL TRANSCRIPT:
    {transcript_text if transcript_text.strip() else "Candidate provided no spoken input."}
    """
    
    eval_result = {}
    try:
        eval_result = generate_structured_gemini(eval_prompt, ScorecardEvaluationResponse, temperature=0.2, max_tokens=1500)
    except Exception as e:
        print("[evaluate_simulation fallback]:", e)
        eval_result = {
            "overall_score": 4.0,
            "summary": "Superficial responses and lack of strategic depth during the live dialogue.",
            "skills": [
                {"name": "Leadership & Mediation", "score": 3.5, "feedback": "Failed to demonstrate proactive leadership in deadlock."},
                {"name": "Assertive Communication", "score": 4.0, "feedback": "Answers were overly brief and lacked structured STAR examples."},
                {"name": "CV Gap Defense", "score": 3.0, "feedback": "Could not justify strategy trade-offs."},
                {"name": "Time & Focus Management", "score": 5.0, "feedback": "Short interventions without moving the agenda forward."}
            ]
        }

    # Asynchronously persist to Google Cloud Firestore with User Partitioning
    try:
        import datetime
        from google.cloud import firestore
        db = firestore.Client()
        user_ref = db.collection("users").document(req.user_id)
        session_ref = user_ref.collection("sessions").document()
        session_ref.set({
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "overall_score": eval_result.get("overall_score"),
            "summary": eval_result.get("summary"),
            "skills": eval_result.get("skills"),
            "transcript": req.dialogue_history
        })
    except Exception as e:
        # Fallback gracefully if running locally without gcloud auth
        pass

    return eval_result

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
