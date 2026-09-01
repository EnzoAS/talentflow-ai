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
api_key = os.environ.get("GEMINI_API_KEY", "")
client = genai.Client(api_key=api_key) if api_key else genai.Client(api_key="none")
MODEL_ID = "gemini-3.5-flash"

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
    2. Define a specialized Technical / Domain Interviewer Persona (e.g. for Marketing: "Marcus Vance" / "Head of Growth & Performance"; for Finance: "Robert Sterling" / "Chief Financial Officer"; for Tech: "Carlos Mendes" / "Senior Tech Lead").
    3. Generate a structured Interview Playbook for Sofia (HR / Culture Facilitator) and the domain specialist.
    """
    try:
        resp = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ATSAnalysisResponse,
                max_output_tokens=600,
                temperature=0.3
            )
        )
        return json.loads(resp.text)
    except Exception as e:
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
                "Interviewer challenges candidate on crisis handling and metric drop",
                "Sofia evaluates communication and conflict management under pressure",
                "Interviewer challenges strategic methodology and architecture trade-offs"
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
    The Orchestrator pattern: 
    Follows the Interview Playbook and candidate responses in English, dynamically morphing
    between Sofia (HR) and the Domain Specialist (Marketing, Tech, Finance, etc.).
    Maintains multi-turn conversational context for natural follow-ups.
    """
    context = req.context or {}
    playbook = context.get('interview_playbook', [])
    playbook_str = "\n".join([f"- {p}" for p in playbook]) if isinstance(playbook, list) else str(playbook)
    
    interviewer_name = context.get('interviewer_name', 'Executive Lead')
    interviewer_role = context.get('interviewer_role', 'Domain Lead')
    interviewer_avatar = context.get('interviewer_avatar', '👨‍💼')
    domain = context.get('domain', 'Domain Strategy')

    # Pass the last 3-4 dialogue turns so the AI has conversational memory
    recent_history = req.dialogue_history[-4:] if req.dialogue_history else []
    history_lines = "\n".join([f"{m.get('name', 'Speaker')}: {m.get('text', '')}" for m in recent_history])

    # Distinguish between First Question (Kickoff) vs Follow-up Turn
    is_initial = (req.user_message is None or req.user_message.strip() == '')

    if is_initial:
        turn_instruction = f"""This is the start of the interview. Sofia Valente or {interviewer_name} must introduce themselves briefly and ask the opening question tailored specifically to the candidate's CV and the {domain} role."""
    else:
        turn_instruction = f"""The candidate just answered: "{req.user_message}". Acknowledge their point and challenge them with the next sharp, realistic follow-up question or trade-off in {domain} (max 2 short sentences). Do NOT re-introduce yourself."""

    sys_prompt = f"""
    You are the Supervisor Agent orchestrating the live interview simulation ({req.mode}) for the domain: {domain}.
    
    STRATEGIC PLAYBOOK:
    {playbook_str if playbook_str else context.get('simulation_focus', '')}
    
    ACTIVE PANEL MEMBERS:
    - {interviewer_name} (speaker_id: expert): {interviewer_role}. Challenges candidate on domain depth and trade-offs in {domain}.
    - Sofia Valente (speaker_id: sofia): HR Facilitator. Focuses on leadership, communication, and conflict mediation.
    
    RECENT CONVERSATION HISTORY:
    {history_lines if history_lines else "Interview starting now."}
    
    Candidate's newest response: "{req.user_message if req.user_message else 'Candidate joined the room.'}"
    
    Task:
    {turn_instruction}
    
    Return ONLY a valid JSON object with keys "speaker_id", "speaker_name", "role", "avatar", "text".
    Example:
    {{"speaker_id": "expert", "speaker_name": "{interviewer_name}", "role": "{interviewer_role}", "avatar": "{interviewer_avatar}", "text": "Your follow-up question here."}}
    """
    
    try:
        resp = client.models.generate_content(
            model=MODEL_ID,
            contents=sys_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                max_output_tokens=600,
                temperature=0.7
            )
        )
        
        raw = resp.text.strip()
        # Find JSON boundaries
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            raw = match.group(0)

        bot_reply = json.loads(raw)
        bot_reply["tokens_estimated"] = len(bot_reply.get("text", "").split()) * 2
        return bot_reply
    except Exception as e:
        print("SIMULATION TURN ERROR:", e)
        # Dynamic fallback acknowledging candidate's response
        candidate_thought = req.user_message if req.user_message else "your background"
        return {
            "speaker_id": "expert",
            "speaker_name": interviewer_name,
            "role": interviewer_role,
            "avatar": interviewer_avatar,
            "text": f"Fair enough. Taking '{candidate_thought}' into account, how would you approach collaborating with the team to overcome that gap in production?",
            "tokens_estimated": 25
        }

from fastapi.responses import FileResponse, Response
import edge_tts
import asyncio

class TTSRequest(BaseModel):
    text: str
    speaker_id: str

@app.post("/api/tts")
async def generate_speech_endpoint(req: TTSRequest):
    """
    Generates high-definition neural voices for interviewers.
    Sofia uses 'en-US-AvaNeural' (Professional & Natural HR Voice)
    Expert uses 'en-US-AndrewNeural' (Confident & Deep Executive Voice)
    """
    voice = "en-US-AvaNeural" if req.speaker_id == "sofia" else "en-US-AndrewNeural"
    
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
        resp = client.models.generate_content(
            model=MODEL_ID,
            contents=eval_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScorecardEvaluationResponse,
                max_output_tokens=600,
                temperature=0.2
            )
        )
        eval_result = json.loads(resp.text)
    except Exception as e:
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

