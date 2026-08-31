import os
import json

class SimulationEngine:
    """
    Orquestrador Multi-Agentes para Simulação de Dinâmicas de Grupo e Entrevistas 1:1.
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
                print(f"[SimulationEngine] Erro ao inicializar Gemini: {e}")

    def process_turn(self, mode: str, dialogue_history: list, user_message: str = "", context: dict = None) -> dict:
        if self.client:
            try:
                return self._process_with_llm(mode, dialogue_history, user_message, context)
            except Exception as e:
                print(f"[SimulationEngine] Fallback para simulador heurístico: {e}")

        return self._process_heuristic(mode, dialogue_history, user_message, context)

    def _process_with_llm(self, mode: str, dialogue_history: list, user_message: str, context: dict) -> dict:
        gaps = context.get("missing_keywords", ["Liderança", "Microsserviços"]) if context else ["Liderança", "Microsserviços"]
        gaps_str = ", ".join(gaps)

        prompt = (
            f"Você é o orquestrador de uma simulação de processo seletivo.\n"
            f"Modo: {mode}. Gaps do candidato: {gaps_str}.\n"
            f"Histórico: {json.dumps(dialogue_history, ensure_ascii=False)}\n"
            f"Última fala do candidato: {user_message}\n\n"
            "Gere o JSON da próxima fala:\n"
            "{\n"
            '  "speaker_id": "carlos",\n'
            '  "speaker_name": "Carlos Mendes",\n'
            '  "avatar": "👨‍💻",\n'
            '  "role": "Perfil Cético / Dados",\n'
            '  "color": "amber",\n'
            '  "text": "Fala do bot em até 2 frases.",\n'
            '  "tokens_estimated": 45,\n'
            '  "cost_usd": 0.00007\n'
            "}"
        )
        response = self.client.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)

    def _process_heuristic(self, mode: str, dialogue_history: list, user_message: str, context: dict) -> dict:
        step = len(dialogue_history)
        msg_lower = user_message.lower() if user_message else ""

        if mode == "group":
            if step == 0:
                return {
                    "speaker_id": "sofia",
                    "speaker_name": "Sofia Valente",
                    "avatar": "👩‍💼",
                    "role": "Facilitadora RH",
                    "color": "pink",
                    "text": "Olá time! O case de hoje é crítico: nosso servidor de pagamentos caiu no pico da Black Friday. Vocês têm 5 minutos juntos para decidir: comunicamos os clientes agora nas redes sociais ou subimos o backup em silêncio primeiro? O tempo está valendo.",
                    "tokens_estimated": 65,
                    "cost_usd": 0.00009
                }
            elif step == 1:
                return {
                    "speaker_id": "carlos",
                    "speaker_name": "Carlos Mendes",
                    "avatar": "👨‍💻",
                    "role": "Perfil Cético / Dados",
                    "color": "amber",
                    "text": "Eu sou contra comunicar agora. Se avisarmos no Twitter imediatamente, vai gerar cancelamento em massa. O time de infraestrutura disse que precisa de 10 minutos.",
                    "tokens_estimated": 42,
                    "cost_usd": 0.00006
                }
            elif step == 2:
                return {
                    "speaker_id": "beatriz",
                    "speaker_name": "Beatriz Lima",
                    "avatar": "👩‍🔬",
                    "role": "Perfil Ágil / Ação",
                    "color": "emerald",
                    "text": "Discordo totalmente, Carlos! Transparência é tudo. Se um cliente postar que o cartão passou duas vezes antes da gente se pronunciar, o estrago é 10x pior. O que você acha, candidato?",
                    "tokens_estimated": 48,
                    "cost_usd": 0.00007
                }
            else:
                if "meio-termo" in msg_lower or "backup" in msg_lower or "equilíbrio" in msg_lower:
                    return {
                        "speaker_id": "carlos",
                        "speaker_name": "Carlos Mendes",
                        "avatar": "👨‍💻",
                        "role": "Perfil Cético / Dados",
                        "color": "amber",
                        "text": "Concordo com a sua ponderação. Se avisarmos que há instabilidade técnica sem alarde, ganhamos a janela necessária para restaurar os dados com segurança.",
                        "tokens_estimated": 44,
                        "cost_usd": 0.00006
                    }
                elif "tempo" in msg_lower or "votar" in msg_lower or "fechar" in msg_lower:
                    return {
                        "speaker_id": "beatriz",
                        "speaker_name": "Beatriz Lima",
                        "avatar": "👩‍🔬",
                        "role": "Perfil Ágil / Ação",
                        "color": "emerald",
                        "text": "Muito bem puxado! Excelente liderança de tempo. Eu voto no plano com a ressalva que você propôs para fecharmos a entrega.",
                        "tokens_estimated": 38,
                        "cost_usd": 0.00005
                    }
                else:
                    return {
                        "speaker_id": "sofia",
                        "speaker_name": "Sofia Valente",
                        "avatar": "👩‍💼",
                        "role": "Facilitadora RH",
                        "color": "pink",
                        "text": "Excelente direcionamento do candidato. Como o time se organizará para documentar o post-mortem e prevenir novas falhas?",
                        "tokens_estimated": 40,
                        "cost_usd": 0.00006
                    }
        else:
            # 1:1 Mode
            if step == 0:
                return {
                    "speaker_id": "rodrigo",
                    "speaker_name": "Rodrigo Silva",
                    "avatar": "👨‍💻",
                    "role": "Tech Lead Sênior",
                    "color": "blue",
                    "text": "Olá! Analisei seu currículo e vi sólida experiência em aplicações web. Como a vaga exige arquitetura escalável e liderança, me conte: qual foi a decisão técnica mais complexa que você liderou e como lidou com divergências no time?",
                    "tokens_estimated": 58,
                    "cost_usd": 0.00008
                }
            else:
                return {
                    "speaker_id": "rodrigo",
                    "speaker_name": "Rodrigo Silva",
                    "avatar": "👨‍💻",
                    "role": "Tech Lead Sênior",
                    "color": "blue",
                    "text": "Muito boa argumentação. E se o time de infraestrutura tivesse restrições severas de orçamento para essa solução, qual seria o seu plano B para manter a resiliência?",
                    "tokens_estimated": 46,
                    "cost_usd": 0.00007
                }
