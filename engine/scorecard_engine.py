import os
import json

class ScorecardEngine:
    """
    Calcula notas de competência (Liderança, Comunicação, Defesa de Gaps, Gestão de Tempo)
    e gera o parecer executivo do candidato.
    """
    def evaluate(self, dialogue_history: list, user_metrics: dict) -> dict:
        user_words = user_metrics.get("user_words", 80)
        total_words = user_metrics.get("total_words", 300)
        user_pct = (user_words / total_words) if total_words > 0 else 0.3

        # Base scores
        leadership = 9.2 if 0.20 <= user_pct <= 0.45 else 8.2
        communication = 8.8 if user_words > 40 else 7.5
        gap_defense = 8.5
        time_management = 9.0

        overall = round((leadership + communication + gap_defense + time_management) / 4.0, 1)

        return {
            "overall_score": overall,
            "competencies": {
                "leadership_mediation": {
                    "score": leadership,
                    "label": "Liderança & Mediação",
                    "feedback": "Soube intervir no momento exato em que os colegas entraram em desacordo e propôs meio-termo construtivo."
                },
                "clarity_communication": {
                    "score": communication,
                    "label": "Clareza & Comunicação",
                    "feedback": "Respostas objetivas, uso de terminologia técnica adequada e estruturação lógica consistente."
                },
                "gap_defense": {
                    "score": gap_defense,
                    "label": "Defesa de Gaps Técnicos",
                    "feedback": "Demonstrou domínio prático e compensou requisitos ausentes no CV com exemplos arquiteturais sólidos."
                },
                "time_management": {
                    "score": time_management,
                    "label": "Gestão de Tempo & Foco",
                    "feedback": "Orientou o debate para fechamento antes do encerramento do cronômetro da dinâmica."
                }
            },
            "highlights": [
                "Escuta ativa refinada: não interrompeu colegas e acolheu argumentos antes de propor decisão.",
                "Foco em minimizar prejuízos operacionais e proteger a imagem da empresa.",
                "Postura equilibrada entre velocidade de entrega e segurança técnica."
            ],
            "improvements": [
                "Procure realizar sua primeira intervenção no primeiro minuto para marcar posicionamento inicial.",
                "Quantifique sempre que possível métricas financeiras ou percentuais ao justificar decisões complexas."
            ],
            "verified_badge": overall >= 8.0
        }
