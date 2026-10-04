import re

from app.services.ai.base import AIProvider


class MockProvider(AIProvider):
    def chat(self, message: str, scholarships: list[dict]) -> str:
        question = message.lower()
        if not scholarships:
            return "I couldn't find a matching record in the current scholarship data. Try a scholarship title or university name. (Demo AI — connect a provider in backend/.env)"
        record = scholarships[0]
        title = record.get("title", "This scholarship")
        if "deadline" in question:
            answer = f"{title}: deadline is {record.get('deadline') or record.get('deadline_kind') or 'not specified in the source record'}. Confirm it with the official scholarship source."
        elif "ielts" in question or "english" in question:
            answer = f"{title}: IELTS requirement is {record.get('IELTS_band_recommendation') or 'not specified'} (required: {record.get('IELTS_required', 'unknown')}). Check the official page for current language rules."
        elif "document" in question or "apply" in question:
            answer = f"{title}: the listed application documents are {', '.join(record.get('documents_list_parsed', [])) or 'not specified in this record'}. Verify the current checklist with the provider."
        elif "fund" in question or "stipend" in question:
            answer = f"{title}: funding is listed as {record.get('funding') or record.get('scholarship_type') or 'not specified'}; stipend information is {record.get('stipend_monthly_amount') or 'not provided'}. These are source-record details, not a guarantee."
        else:
            answer = f"I found {title} at {record.get('university_name', 'the listed institution')} in {record.get('host_country', 'an unspecified country')}. Ask me about its deadline, IELTS, funding, or documents."
        return f"{answer}\n\n(Demo AI — connect a provider in backend/.env)"

    def review_sop(self, text: str) -> dict:
        words = re.findall(r"\b[\w'-]+\b", text)
        lower = text.lower()
        criteria = {
            "structure": 75 if len(words) > 100 else 35,
            "clarity": 75 if len(words) > 150 and len(set(words)) > 60 else 55,
            "goals": 80 if any(term in lower for term in ("goal", "career", "plan")) else 40,
            "evidence": 80 if any(term in lower for term in ("project", "research", "led", "built")) else 40,
            "grammar": 75 if text.count(".") >= 3 else 55,
            "fit": 75 if any(term in lower for term in ("program", "university", "course", "faculty")) else 40,
        }
        score = round(sum(criteria.values()) / len(criteria))
        issues = []
        if len(words) < 150:
            issues.append(
                {
                    "quote": "",
                    "problem": "The draft is quite short to assess fully.",
                    "suggestion": "Add one specific example that demonstrates your preparation and goals.",
                }
            )
        if not any(term in lower for term in ("program", "university", "course", "faculty")):
            issues.append(
                {
                    "quote": "",
                    "problem": "Program fit is not yet clear.",
                    "suggestion": "Name a real course, research area, or feature of the program that supports your plans.",
                }
            )
        return {
            "score": score,
            "sub_scores": criteria,
            "strengths": ["The draft is saved for review."],
            "issues": issues,
            "rewritten_intro": "Use a specific academic moment to introduce your interest; keep all claims grounded in your own experience.",
        }

    def improve_text(self, text: str, instruction: str) -> str:
        cleaned = " ".join(text.split())
        if cleaned and cleaned[-1] not in ".!?":
            cleaned += "."
        return f"{cleaned}\n\n(Demo AI suggestion: {instruction or 'clarity and grammar'}; review before using.)"
