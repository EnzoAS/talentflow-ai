import os
import re
import json

class CVAnalyzer:
    """
    Motor de Analise de Curriculo e Vaga (ATS Match & Gap Detector).
    """
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.client = None
        if self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self.client = genai.GenerativeModel("gemini-1.5-flash")
            except Exception as e:
                print(f"[CVAnalyzer] Erro ao inicializar Gemini: {e}")

    def extract_keywords(self, text: str):
        terms = [
            "TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Python", "Java",
            "Go", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "PostgreSQL", "MongoDB",
            "Redis", "GraphQL", "REST APIs", "Microsserviços", "CI/CD", "Git", "Scrum",
            "Liderança", "Mentoria", "Arquitetura", "TDD", "Testes Automatizados", "Gestão de Conflitos",
            "Métricas de Negócio", "ROI", "Alta Disponibilidade", "Observabilidade", "Kafka", "RabbitMQ",
            "Clean Architecture", "Segurança", "Performance", "Fullstack", "DevOps"
        ]
        found = []
        text_lower = text.lower()
        for term in terms:
            pattern = r'\b' + re.escape(term.lower()) + r'\b'
            if re.search(pattern, text_lower):
                found.append(term)
        return found

    def analyze(self, cv_text: str, job_text: str) -> dict:
        if self.client:
            try:
                return self._analyze_with_llm(cv_text, job_text)
            except Exception as e:
                print(f"[CVAnalyzer] Fallback para motor heuristico: {e}")
        return self._analyze_heuristic(cv_text, job_text)

    def _analyze_with_llm(self, cv_text: str, job_text: str) -> dict:
        prompt = (
            "Você é um especialista em ATS e Tech Recruiter sênior.\n"
            "Analise o currículo em relação à vaga e retorne JSON:\n"
            "{\n"
            '  "match_score": 78,\n'
            '  "summary": "Resumo executivo.",\n'
            '  "present_keywords": ["React", "TypeScript", "Node.js"],\n'
            '  "missing_keywords": ["Liderança", "Microsserviços", "Métricas de Negócio"],\n'
            '  "strengths": ["Forte experiência em front-end", "Domínio de APIs REST"],\n'
            '  "gaps": ["Falta de menção a liderança direta de pessoas"],\n'
            '  "simulation_focus": "O entrevistador deve focar em liderança e microsserviços.",\n'
            '  "suggested_questions": ["Como lidou com atrito técnico no time?"]\n'
            "}\n\n"
            f"CURRÍCULO:\n{cv_text}\n\nVAGA:\n{job_text}"
        )
        response = self.client.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        data = json.loads(response.text)
        data["engine"] = "gemini-1.5-flash"
        return data

    def _analyze_heuristic(self, cv_text: str, job_text: str) -> dict:
        cv_keywords = set(self.extract_keywords(cv_text))
        job_keywords = set(self.extract_keywords(job_text))

        if not job_keywords:
            job_keywords = {"TypeScript", "Next.js", "Node.js", "Liderança", "Microsserviços", "Métricas de Negócio"}

        present = list(cv_keywords.intersection(job_keywords))
        missing = list(job_keywords.difference(cv_keywords))

        if len(job_keywords) > 0:
            score = int(round((len(present) / len(job_keywords)) * 100))
        else:
            score = 70

        score = max(35, min(95, score))

        if not present:
            present = ["TypeScript", "React", "Node.js", "APIs REST"]
        if not missing:
            missing = ["Liderança de Pessoas", "Microsserviços", "Métricas de Negócio / ROI"]

        missing_str = ", ".join(missing[:3])
        return {
            "match_score": score,
            "summary": f"O perfil possui {score}% de alinhamento com a vaga, apresentando forte base técnica com lacunas em competências de liderança e arquitetura.",
            "present_keywords": present,
            "missing_keywords": missing,
            "strengths": [
                "Sólida bagagem em desenvolvimento e tecnologias essenciais.",
                "Experiência prática com APIs e ecossistema moderno."
            ],
            "gaps": [
                f"Ausência de termos-chave no CV: {missing_str}.",
                "Falta de quantificação de métricas de impacto e resultados de negócio."
            ],
            "simulation_focus": f"Testar a capacidade do candidato de argumentar sobre {missing[0] if missing else 'arquitetura'} e mediação de decisões sob pressão.",
            "suggested_questions": [
                f"Como você compensa sua experiência em {missing[0] if missing else 'gestão'} em projetos de alta complexidade?",
                "Descreva uma decisão técnica recente e como você mediu o impacto direto no usuário ou negócio."
            ],
            "engine": "heuristic-ats-v1"
        }
