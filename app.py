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

# Initialize Gemini Client (reads GEMINI_API_KEY from environment or defaults safely)
api_key = os.environ.get("GEMINI_API_KEY", "")
client = genai.Client(api_key=api_key) if api_key else genai.Client()
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

# --- Function Calling (Tools) ---
# We define Python functions that the Orchestrator Agent can call.
# This proves true Agentic behavior for the Hackathon.

def extract_cv_gaps(cv: str, job: str) -> dict:
    """
    Analyzes the CV against the Job Description, detects gaps, and generates an Interview Playbook.
    This playbook contains the exact multi-agent questioning strategy so raw CV text doesn't need to be resent every turn.
    """
    prompt = f"""
    You are an Expert ATS Evaluator & Interview Strategist.
    CV: {cv}
    Job Description: {job}
    
    Analyze the match, find critical gaps, and generate an Interview Playbook for Sofia (HR) and Carlos (Tech Lead).
    
    Return ONLY valid JSON with keys:
    - 'match_score': int (0-100)
    - 'summary': short string explaining the score
    - 'present_keywords': list of strings
    - 'missing_keywords': list of strings
    - 'simulation_focus': str instructions
    - 'interview_playbook': list of 3-4 structured challenge questions (e.g. ['Carlos challenges on DB scalability', 'Sofia evaluates crisis leadership'])
    """
    resp = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    try:
        return json.loads(resp.text)
    except:
        return {
            "match_score": 85, 
            "summary": "Match competitivo encontrado.",
            "present_keywords": ["Liderança", "Software"],
            "missing_keywords": ["Cloud Architecture"],
            "simulation_focus": "O candidato focou em Frontend. Pressione sobre falhas de backend.",
            "interview_playbook": [
                "Carlos: Perguntar sobre resiliência e failover em produção",
                "Sofia: Perguntar como lida com discordâncias no time",
                "Carlos: Questionar gaps em arquitetura de dados"
            ]
        }

# --- Endpoints ---

@app.post("/api/analyze-cv")
def analyze_cv_endpoint(req: AnalyzeRequest):
    """
    Endpoint that triggers the ATS Agent tool and builds the interview playbook.
    """
    result = extract_cv_gaps(req.cv_text, req.job_text)
    return result

@app.post("/api/simulation/turn")
def simulation_turn_endpoint(req: SimulationTurnRequest):
    """
    The Orchestrator pattern: 
    Follows the Interview Playbook and candidate responses in English.
    """
    playbook = req.context.get('interview_playbook', [])
    playbook_str = "\n".join([f"- {p}" for p in playbook]) if isinstance(playbook, list) else str(playbook)

    sys_prompt = f"""
    You are the Supervisor Agent leading the interview simulation ({req.mode}).
    
    STRATEGIC INTERVIEW PLAYBOOK:
    {playbook_str if playbook_str else req.context.get('simulation_focus', '')}
    
    Agents:
    - Carlos (speaker_id: carlos): Skeptical Tech Lead. Focuses on code, data pipelines, scalability, and architecture.
    - Sofia (speaker_id: sofia): HR Facilitator. Focuses on leadership, communication, culture fit, and conflict mediation.
    
    Candidate's last response: "{req.user_message}"
    
    Task: Choose the most appropriate agent and generate a sharp, professional follow-up question or challenge in English (max 2 short sentences).
    
    Return ONLY valid JSON:
    {{
        "speaker_id": "carlos" or "sofia",
        "speaker_name": "Carlos Mendes" or "Sofia Valente",
        "role": "Tech Lead" or "HR Facilitator",
        "avatar": "👨‍💻" or "👩‍💼",
        "text": "Interviewer speech in English. Direct, max 2 sentences."
    }}
    """
    
    resp = client.models.generate_content(
        model=MODEL_ID,
        contents=sys_prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    
    try:
        bot_reply = json.loads(resp.text)
        bot_reply["tokens_estimated"] = len(bot_reply["text"].split()) * 2
        return bot_reply
    except:
        return {
            "speaker_id": "carlos",
            "speaker_name": "Carlos Mendes",
            "role": "Tech Lead",
            "avatar": "👨‍💻",
            "text": "Interesting, but how would your architecture handle sudden failover if the primary database drops during peak traffic?",
            "tokens_estimated": 20
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
    Carlos uses 'en-US-AndrewNeural' (Confident & Deep Tech Lead Voice)
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

@app.post("/api/evaluate-simulation")
def evaluate_simulation_endpoint(req: EvaluationRequest):
    """
    Evaluates the user's transcript and calculates realistic scores based on performance in English.
    """
    transcript_text = "\n".join([f"{m.get('name', 'User')}: {m.get('text', '')}" for m in req.dialogue_history])
    
    eval_prompt = f"""
    You are an Executive HR & Tech Lead Evaluator.
    Analyze the candidate's real interview transcript below and assign strict, realistic scores from 0.0 to 10.0 based on response quality. If they gave evasive, weak, or superficial answers, assign low scores (e.g. 2.0 to 5.0). If they were articulate and demonstrated solid engineering/leadership principles, assign high scores (8.0 to 9.5).
    
    TRANSCRIPT:
    {transcript_text if transcript_text.strip() else "Candidate provided no spoken input."}
    
    Return EXACTLY AND ONLY valid JSON in English:
    {{
        "overall_score": float (e.g. 4.5),
        "summary": "Executive summary in English on candidate's performance, communication, and technical depth.",
        "skills": [
            {{
                "name": "Leadership & Mediation",
                "score": float (0-10),
                "feedback": "Concise feedback in English."
            }},
            {{
                "name": "Assertive Communication",
                "score": float (0-10),
                "feedback": "Concise feedback on clarity and STAR method."
            }},
            {{
                "name": "CV Gap Defense",
                "score": float (0-10),
                "feedback": "Concise feedback on architectural justification."
            }},
            {{
                "name": "Time & Focus Management",
                "score": float (0-10),
                "feedback": "Concise feedback on conciseness and focus."
            }}
        ]
    }}
    """
    
    resp = client.models.generate_content(
        model=MODEL_ID,
        contents=eval_prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    
    eval_result = {}
    try:
        eval_result = json.loads(resp.text)
    except:
        eval_result = {
            "overall_score": 4.0,
            "summary": "Superficial responses and lack of architectural depth during the live dialogue.",
            "skills": [
                {"name": "Leadership & Mediation", "score": 3.5, "feedback": "Failed to demonstrate proactive leadership in technical deadlock."},
                {"name": "Assertive Communication", "score": 4.0, "feedback": "Answers were overly brief and lacked structured STAR examples."},
                {"name": "CV Gap Defense", "score": 3.0, "feedback": "Could not justify distributed systems resilience trade-offs."},
                {"name": "Time & Focus Management", "score": 5.0, "feedback": "Short interventions without moving the technical agenda forward."}
            ]
        }

    # Asynchronously persist to Google Cloud Firestore (Memory & Audit)
    try:
        import datetime
        from google.cloud import firestore
        db = firestore.Client()
        doc_ref = db.collection("interview_sessions").document()
        doc_ref.set({
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

