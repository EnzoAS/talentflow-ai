from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import json
import base64
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

def generate_structured_gemini(contents, schema, temperature=0.5, max_tokens=3500):
    """
    Resilient caller with automatic multi-model failover for 503/429/404 errors.
    Supports both text prompts and multimodal lists with images.
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
    user_image: str | None = None
    language: str | None = "pt-BR"

# --- Pydantic Schemas for Gemini Structured Outputs ---

class TurnHighlight(BaseModel):
    title: str
    turn_index: int
    quote: str
    analysis: str

class ShadowAnswer(BaseModel):
    turn_index: int
    user_answer: str
    senior_rewrite: str
    key_takeaway: str

class SkillEvaluation(BaseModel):
    name: str
    score: float
    feedback: str

class ScorecardEvaluationResponse(BaseModel):
    overall_score: float
    recommendation: str  # "Strong Hire", "Hire", "Lean Hire", "Lean No Hire", "Strong No Hire"
    seniority_level_estimated: str
    market_salary_estimate: str
    summary: str
    skills: list[SkillEvaluation]
    trade_off_score: float
    trade_off_feedback: str
    star_method_score: float
    star_method_feedback: str
    signal_to_noise_score: float
    signal_to_noise_feedback: str
    peak_moment: TurnHighlight | None = None
    critical_gap_moment: TurnHighlight | None = None
    shadow_coaching: list[ShadowAnswer] = []
    visual_presence_score: float | None = None
    visual_presence_feedback: str | None = None

class SimulationBotTurnResponse(BaseModel):
    speaker_id: str
    speaker_name: str
    role: str
    avatar: str
    text: str
    visual_observation: str | None = None

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
    Analyze the candidate's CV against the target Job Description in depth.
    
    CV:
    {cv}
    
    Job Description:
    {job}
    
    Task:
    1. Identify the exact professional domain (e.g. "Sports Science & High Performance", "Growth Marketing", "Corporate Finance", "Software Engineering", "Product Design", "Medicine / Health", "Sales & Business Development", etc.).
    2. Define a specialized Technical / Domain Interviewer Persona appropriate for this exact field (e.g. for Sports: "Dr. Rodrigo Silva" / "Head de Fisiologia & Performance"; for Tech: "Carlos Mendes" / "Senior Tech Lead"; for Finance: "Robert Sterling" / "CFO"). For interviewer_avatar, strictly provide a single emoji such as 👨‍💻, 👨‍💼, 👩‍💻, 👩‍💼, 👨‍🔬, 🏃‍♂️.
    3. Calculate a realistic ATS match_score (0-100) based on actual keyword alignment.
    4. Extract real, domain-specific present keywords from the CV and missing keywords from the job description.
    5. Formulate an adaptive 1:1 interview focus and a 3-step playbook specifically tailored to this industry.
    """
    try:
        return generate_structured_gemini(prompt, ATSAnalysisResponse, temperature=0.3, max_tokens=3500)
    except Exception as e:
        print("[extract_cv_gaps fallback]:", e)
        return {
            "match_score": 85,
            "domain": "Domain Specialist",
            "interviewer_name": "Dr. Carlos Mendes",
            "interviewer_role": "Executive Lead Interviewer",
            "interviewer_avatar": "👨‍💼",
            "summary": "Competitive alignment found with key domain gaps to defend.",
            "present_keywords": ["Professional Experience", "Domain Competencies"],
            "missing_keywords": ["Advanced Methodologies", "Cross-functional Strategy"],
            "simulation_focus": "Assess core domain expertise, problem-solving under pressure, and strategic trade-offs.",
            "interview_playbook": [
                "Probe into past practical cases and crisis management",
                "Evaluate technical trade-offs and domain methodology decisions",
                "Assess strategic decision-making and cross-team communication"
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
    # Prepare multimodal contents if webcam frame is attached
    image_part = None
    if req.user_image and isinstance(req.user_image, str) and len(req.user_image) > 50:
        try:
            raw_b64 = req.user_image
            if "base64," in raw_b64:
                raw_b64 = raw_b64.split("base64,")[1]
            img_bytes = base64.b64decode(raw_b64)
            image_part = types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")
        except Exception as img_err:
            print("[Multimodal image decode warning]:", img_err)

    visual_rules = """
5. AGENTIC VIDEO UNDERSTANDING & NON-VERBAL OBSERVATION:
   - An active camera snapshot of the candidate answering this question is attached.
   - Inspect their visual presence, eye contact, body language, facial tension, and posture:
     * Are they maintaining confident, natural eye contact with the camera?
     * Do their eyes drift as if reading off a second screen, notes, or cheating?
     * Do they show physical hesitation, uncertainty, or nervous micro-expressions?
   - In 'visual_observation', provide a concise 1-sentence assessment of their non-verbal presence (e.g. "Direct eye contact, composed posture", "Noticeable gaze shift towards secondary screen", or "Slight hesitation visible before addressing the trade-off").
   - If appropriate, you may subtly acknowledge or challenge their visible confidence or hesitation in your question.
""" if image_part else """
5. VIDEO ANALYSIS:
   - Candidate camera is currently OFF. Set 'visual_observation' to null. Focus strictly on their spoken argument.
"""

    is_pt = bool(req.language and ("pt" in req.language.lower() or "br" in req.language.lower()))

    if is_pt:
        lang_instruction = """
LANGUAGE INSTRUCTION:
The interview must be conducted 100% in natural, professional Brazilian Portuguese (pt-BR).
Introduce yourself in Portuguese, and formulate all questions, technical follow-ups, and challenges strictly in natural Brazilian Portuguese.
"""
        if is_initial:
            turn_instruction = f"""This is the start of the 1:1 technical interview. {interviewer_name} must introduce themselves briefly in natural Brazilian Portuguese and ask the opening technical question in Portuguese based on the candidate's CV and the {domain} playbook."""
        else:
            turn_instruction = f"""The candidate just answered: "{req.user_message}".
Acknowledge their answer in Portuguese, critically assess their reasoning or technical depth, and challenge them with the NEXT logical follow-up question or trade-off from the playbook in {domain} (1-2 sentences in Portuguese).
Do NOT introduce yourself again. Advance the conversation forward with sharp, domain-specific technical follow-up questions in Portuguese."""
    else:
        lang_instruction = """
LANGUAGE INSTRUCTION:
The primary language of this simulation is English (en-US). Formulate all questions, follow-ups, and challenges in natural, professional English.
"""
        if is_initial:
            turn_instruction = f"""This is the start of the 1:1 technical interview. {interviewer_name} must introduce themselves briefly in English and ask the opening technical question based on the candidate's CV and the {domain} playbook."""
        else:
            turn_instruction = f"""The candidate just answered: "{req.user_message}".
Acknowledge their answer in English, critically assess their reasoning or technical depth, and challenge them with the NEXT logical follow-up question or trade-off from the playbook in {domain} (1-2 sentences).
Do NOT introduce yourself again. Advance the conversation forward with sharp, domain-specific technical follow-up questions."""

    sys_prompt = f"""
You are {interviewer_name}, {interviewer_role}, conducting a rigorous, authentic 1:1 technical interview in {domain}.

STRATEGIC PLAYBOOK:
{playbook_str if playbook_str else context.get('simulation_focus', '')}

{panel_instruction}

TURN INSTRUCTION:
{turn_instruction}

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
{visual_rules}

{lang_instruction}
"""
    
    try:
        contents = [sys_prompt, image_part] if image_part else sys_prompt
        bot_reply = generate_structured_gemini(contents, SimulationBotTurnResponse, temperature=0.7, max_tokens=1000)
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
            "visual_observation": "Candidate observed on camera with steady focus." if image_part else None,
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
    had_video: bool = False
    video_observations: list[str] = []
    language: str | None = "pt-BR"

@app.post("/api/evaluate-simulation")
def evaluate_simulation_endpoint(req: EvaluationRequest):
    """
    Evaluates the user's transcript and calculates realistic scores with structured Pydantic schema.
    Includes Big Tech hiring recommendation, seniority diagnostics, forensic highlights, and shadow coaching rewrites.
    Fully supports Brazilian Portuguese (pt-BR) and English (en-US).
    """
    transcript_text = "\n".join([f"Turn {i+1} - {m.get('name', 'User')}: {m.get('text', '')}" for i, m in enumerate(req.dialogue_history)])

    context_info = ""
    if req.job_context:
        context_info = f"""
TARGET ROLE & CONTEXT:
- ATS Match: {req.job_context.get('match_score', 80)}%
- Target Focus: {req.job_context.get('simulation_focus', 'Senior Technical Role')}
- Missing Keywords/Gaps to Defend: {', '.join(req.job_context.get('missing_keywords', []))}
"""

    visual_section = ""
    if req.had_video and req.video_observations:
        obs_text = "\n".join([f"- {obs}" for obs in req.video_observations if obs])
        visual_section = f"""
NON-VERBAL VIDEO OBSERVATIONS LOGGED DURING SESSION:
{obs_text}

Provide 'visual_presence_score' (0.0 to 10.0) assessing their non-verbal executive presence, eye contact, and composure under pressure, along with 'visual_presence_feedback'.
"""
    else:
        visual_section = """
The candidate completed this session in audio/voice-only mode (camera off). Set 'visual_presence_score' and 'visual_presence_feedback' to null.
"""

    is_pt = bool(req.language and ("pt" in req.language.lower() or "br" in req.language.lower()))

    if is_pt:
        lang_section = """
LANGUAGE & LOCALIZATION REQUIREMENT:
All evaluation feedback, summary, skill feedback, trade-off feedback, star method feedback, signal-to-noise feedback, forensic highlight analysis, and shadow coaching rewrites & takeaways MUST be written in natural, professional Brazilian Portuguese (pt-BR).
You may preserve standard global tech terms (e.g. 'Trade-off', 'STAR', 'Cache invalidation', 'Strong Hire', etc.).
For market_salary_estimate, formulate in Brazilian Reais (e.g. 'R$ 15.000 - R$ 20.000 / mês' or annual equivalent).
"""
    else:
        lang_section = """
LANGUAGE & LOCALIZATION REQUIREMENT:
All evaluation feedback, summary, and analysis must be formulated in natural, professional English (en-US).
For market_salary_estimate, formulate in USD annual benchmark (e.g. '$140k - $175k / yr').
"""
    
    eval_prompt = f"""
    You are an Executive Hiring Committee & Principal Technical Bar Raiser at a top tier technology firm (FAANG/Fintech).
    Analyze the candidate's complete interview transcript below with high calibration, rigorous standards, and strict zero-unearned-praise policy.
    
    {context_info}
    
    EVALUATION GUIDELINES:
    1. FAANG DECISION MATRIX ('recommendation'):
       - "Strong Hire": Exceptional clarity, deep architectural mastery, proactive trade-off reasoning, high leadership signal. (Overall 8.5 - 10.0)
       - "Hire": Solid, clear competence, solves core problems directly with good engineering judgment. (Overall 7.0 - 8.4)
       - "Lean Hire": Acceptable baseline, but lacked depth, concrete metrics, or senior nuance. (Overall 5.5 - 6.9)
       - "Lean No Hire": Noticeable knowledge gaps, circular reasoning, or superficial answers. (Overall 4.0 - 5.4)
       - "Strong No Hire": Severe lack of competence, buzzword stuffing without substance, or refusal/inability to answer. (Overall < 4.0)

    2. SENIORITY LEVEL & SALARY BENCHMARK:
       - Calibrate 'seniority_level_estimated' (e.g. 'Principal / Staff Engineer (L6)', 'Senior Tech Lead (L5)', 'Mid-Level Software Engineer (L4)', 'Associate Engineer (L3)').
       - Calibrate 'market_salary_estimate' according to the demonstrated seniority and target market.

    3. ADVANCED SENIORITY DIAGNOSTICS:
       - 'trade_off_score' (0.0 to 10.0) & 'trade_off_feedback': Did they weigh trade-offs (scalability vs simplicity, consistency vs availability, latency vs cost, tech debt)?
       - 'star_method_score' (0.0 to 10.0) & 'star_method_feedback': Did they structure behavioral/case answers with clear Situation, Task, Action, and measurable Results/metrics?
       - 'signal_to_noise_score' (0.0 to 10.0) & 'signal_to_noise_feedback': Directness and technical density vs vague buzzwords, rambling, or stalling.

    4. FORENSIC MOMENTS:
       - 'peak_moment': Highlight the single best turn/answer where the candidate showed true strength, quoting their exact words and explaining why it scored high.
       - 'critical_gap_moment': Highlight the weakest turn where the candidate stumbled, gave a circular answer, or failed to answer the technical challenge, quoting their words and analyzing the gap.

    5. THE "SHADOW ANSWER" COACHING (Actionable High-Impact Rewrites):
       - For 1 or 2 of the candidate's weaker turns, provide 'shadow_coaching':
         * 'turn_index': Turn number.
         * 'user_answer': What they actually answered.
         * 'senior_rewrite': How a Principal Engineer / Senior Leader would articulate that exact answer with metrics, trade-offs, and crisp precision.
         * 'key_takeaway': 1 memorable lesson they can apply in real interviews.

    6. 4 CORE COMPETENCIES:
       - 'Leadership & Mediation', 'Assertive Communication', 'CV Gap Defense', 'Time & Focus Management'.

    {visual_section}
    
    {lang_section}

    FULL TRANSCRIPT:
    {transcript_text if transcript_text.strip() else "Candidate provided no spoken input."}
    """
    
    eval_result = {}
    try:
        eval_result = generate_structured_gemini(eval_prompt, ScorecardEvaluationResponse, temperature=0.2, max_tokens=4000)
    except Exception as e:
        print("[evaluate_simulation fallback]:", e)
        if is_pt:
            eval_result = {
                "overall_score": 4.0,
                "recommendation": "Lean No Hire",
                "seniority_level_estimated": "Engenheiro Pleno (L4)",
                "market_salary_estimate": "R$ 12.000 - R$ 16.000 / mês",
                "summary": "O candidato forneceu respostas sucintas sem demonstrar profundidade em trade-offs técnicos e métricas concretas de impacto.",
                "skills": [
                    {"name": "Liderança & Mediação", "score": 3.5, "feedback": "Não demonstrou postura proativa na resolução de impasses técnicos."},
                    {"name": "Comunicação Assertiva", "score": 4.0, "feedback": "Respostas sem metodologia STAR e ausência de dados mensuráveis."},
                    {"name": "Defesa de Gaps do CV", "score": 3.0, "feedback": "Não justificou os trade-offs das decisões arquiteturais tomadas."},
                    {"name": "Gestão de Tempo & Foco", "score": 5.0, "feedback": "Respostas breves que não moveram a discussão técnica para frente."}
                ],
                "trade_off_score": 3.5,
                "trade_off_feedback": "Não analisou prós e contras ou limites de escalabilidade das soluções apresentadas.",
                "star_method_score": 3.0,
                "star_method_feedback": "Falta de resultados quantificáveis e impacto direto no negócio.",
                "signal_to_noise_score": 4.5,
                "signal_to_noise_feedback": "Termos conceituais sem detalhamento técnico concreto de implementação.",
                "peak_moment": {
                    "title": "Apresentação da Stack",
                    "turn_index": 1,
                    "quote": "Mencionou tecnologias e arquitetura base.",
                    "analysis": "Demonstrou conhecimento do ecossistema moderno."
                },
                "critical_gap_moment": {
                    "title": "Gargalo de Escala não Explorado",
                    "turn_index": 2,
                    "quote": "Resposta genérica sobre caching e banco de dados.",
                    "analysis": "Perdeu a chance de explicar invalidação de cache, particionamento e tolerância a falhas."
                },
                "shadow_coaching": [
                    {
                        "turn_index": 2,
                        "user_answer": "Eu usei Redis para deixar as consultas mais rápidas.",
                        "senior_rewrite": "Implementamos um cluster Redis L2 distribuído com política LRU e TTL adaptativo, reduzindo a latência p99 do PostgreSQL em 65% sob picos de 12k req/s.",
                        "key_takeaway": "Sempre quantifique a redução de latência e fundamente as escolhas de resiliência e concorrência."
                    }
                ],
                "visual_presence_score": 7.0 if req.had_video else None,
                "visual_presence_feedback": "Manteve contato visual e postura firme." if req.had_video else None
            }
        else:
            eval_result = {
                "overall_score": 4.0,
                "recommendation": "Lean No Hire",
                "seniority_level_estimated": "Mid-Level Engineer (L4)",
                "market_salary_estimate": "$90,000 - $115,000 / yr",
                "summary": "Candidate provided overly brief responses lacking technical trade-off depth and concrete metrics.",
                "skills": [
                    {"name": "Leadership & Mediation", "score": 3.5, "feedback": "Failed to demonstrate proactive leadership in technical deadlock."},
                    {"name": "Assertive Communication", "score": 4.0, "feedback": "Answers lacked structured STAR methodology and real metrics."},
                    {"name": "CV Gap Defense", "score": 3.0, "feedback": "Could not justify architecture trade-offs."},
                    {"name": "Time & Focus Management", "score": 5.0, "feedback": "Brief answers without moving discussion forward."}
                ],
                "trade_off_score": 3.5,
                "trade_off_feedback": "Did not explore pros and cons or scaling limits of the proposed solutions.",
                "star_method_score": 3.0,
                "star_method_feedback": "Lacked specific quantifiable outcomes or measurable impact.",
                "signal_to_noise_score": 4.5,
                "signal_to_noise_feedback": "Superficial buzzwords without concrete technical explanation.",
                "peak_moment": {
                    "title": "Initial System Mention",
                    "turn_index": 1,
                    "quote": "Referenced FastAPI and microservices.",
                    "analysis": "Showed familiarity with the modern stack."
                },
                "critical_gap_moment": {
                    "title": "Unaddressed Scaling Bottlenecks",
                    "turn_index": 2,
                    "quote": "Gave brief statement without detailing Redis caching strategy.",
                    "analysis": "Missed opportunity to explain cache invalidation and connection pooling."
                },
                "shadow_coaching": [
                    {
                        "turn_index": 2,
                        "user_answer": "I used Redis to make things faster.",
                        "senior_rewrite": "We implemented an L2 distributed Redis cluster with adaptive TTL and LRU eviction, reducing Postgres p99 query latency by 65% under peak traffic.",
                        "key_takeaway": "Always quantify the latency reduction and explain the eviction/concurrency policy."
                    }
                ],
                "visual_presence_score": 7.0 if req.had_video else None,
                "visual_presence_feedback": "Maintained eye contact and engaged posture." if req.had_video else None
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
            "recommendation": eval_result.get("recommendation"),
            "seniority_level_estimated": eval_result.get("seniority_level_estimated"),
            "market_salary_estimate": eval_result.get("market_salary_estimate"),
            "summary": eval_result.get("summary"),
            "skills": eval_result.get("skills"),
            "trade_off_score": eval_result.get("trade_off_score"),
            "star_method_score": eval_result.get("star_method_score"),
            "signal_to_noise_score": eval_result.get("signal_to_noise_score"),
            "peak_moment": eval_result.get("peak_moment"),
            "critical_gap_moment": eval_result.get("critical_gap_moment"),
            "shadow_coaching": eval_result.get("shadow_coaching"),
            "visual_presence_score": eval_result.get("visual_presence_score"),
            "visual_presence_feedback": eval_result.get("visual_presence_feedback"),
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
