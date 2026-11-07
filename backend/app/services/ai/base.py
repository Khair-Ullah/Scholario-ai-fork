from abc import ABC, abstractmethod


class AIProviderError(RuntimeError):
    pass


class AIProvider(ABC):
    name = "unknown"

    @abstractmethod
    def chat(self, message: str, scholarships: list[dict]) -> str:
        raise NotImplementedError

    @abstractmethod
    def review_sop(self, text: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    def improve_text(self, text: str, instruction: str) -> str:
        raise NotImplementedError
