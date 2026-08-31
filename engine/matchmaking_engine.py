import os
import json

class MatchmakingEngine:
    """
    Motor de Matchmaking Inteligente de Vagas e Talentos.
    Cruza notas de simulação com requisitos técnicos e salva no radar de oportunidades.
    """
    def __init__(self):
        self.jobs_database = [
            {
                "id": "job_01",
                "title": "Tech Lead / Sênior Fullstack",
                "company": "Fintech Nexus",
                "salary": "R$ 14.000 - R$ 18.000 / mês",
                "location": "Remoto (Brasil)",
                "match_score": 95,
                "tags": ["TypeScript", "Next.js", "Liderança Técnica", "Node.js"],
                "badge": "Prioridade Alta"
            },
            {
                "id": "job_02",
                "title": "Engenheiro de Software Sênior",
                "company": "HealthTech SaaS",
                "salary": "R$ 13.000 - R$ 16.000 / mês",
                "location": "Híbrido (São Paulo - SP)",
                "match_score": 89,
                "tags": ["Node.js", "APIs REST", "Arquitetura Distribuída"],
                "badge": "Vaga Verificada"
            },
            {
                "id": "job_03",
                "title": "Especialista em Microsserviços & Cloud",
                "company": "ScaleUp Logistics",
                "salary": "R$ 16.000 - R$ 21.000 / mês",
                "location": "Remoto",
                "match_score": 84,
                "tags": ["Docker", "Kubernetes", "Observabilidade", "GCP"],
                "badge": "Recrutador Ativo"
            }
        ]

    def get_matches(self, candidate_skills: list = None, simulation_score: float = 8.9) -> list:
        # Boost jobs if simulation score is high
        results = []
        for job in self.jobs_database:
            item = dict(job)
            if simulation_score >= 8.5:
                item["verified_eligible"] = True
            results.append(item)
        return results

    def get_talent_pool(self) -> list:
        return [
            {
                "id": "cand_01",
                "name": "Você (Candidato Avaliado)",
                "role": "Tech Lead / Sênior Fullstack",
                "simulation_score": 8.9,
                "top_skills": ["TypeScript", "Next.js", "Node.js", "Liderança"],
                "highlight": "Destaque em Mediação de Conflitos e Resolução de Crises",
                "status": "Disponível para Propostas"
            },
            {
                "id": "cand_02",
                "name": "Mariana Costa",
                "role": "Product Manager Sênior",
                "simulation_score": 8.4,
                "top_skills": ["Product Discovery", "B2B SaaS", "Scrum"],
                "highlight": "Excelente alinhamento de roadmap e métricas de retenção",
                "status": "Em processo seletivo"
            },
            {
                "id": "cand_03",
                "name": "Lucas Ferreira",
                "role": "DevOps & Cloud Engineer",
                "simulation_score": 8.6,
                "top_skills": ["Kubernetes", "Terraform", "CI/CD", "AWS"],
                "highlight": "Liderou simulação de recuperação de desastres com nota máxima",
                "status": "Aberto a propostas"
            }
        ]
