from abc import ABC, abstractmethod


class AIProvider(ABC):
    @abstractmethod
    def chat(self, message: str, scholarships: list[dict]) -> str:
        raise NotImplementedError

    @abstractmethod
    def review_sop(self, text: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    def improve_text(self, text: str, instruction: str) -> str:
        raise NotImplementedError
