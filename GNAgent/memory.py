from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings

from config import settings


class VectorMemory:
    """
    In-memory FAISS-backed vector store used for semantic recall of past
    conversation turns. Ephemeral: contents are lost when the process exits.
    """

    def __init__(self):
        self._embeddings = OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            api_key=settings.OPENAI_API_KEY,
        )
        self._store: FAISS | None = None

    def add(self, text: str, metadata: dict | None = None) -> None:
        if not text:
            return
        doc = Document(page_content=text, metadata=metadata or {})
        if self._store is None:
            self._store = FAISS.from_documents([doc], self._embeddings)
        else:
            self._store.add_documents([doc])

    def search(self, query: str, k: int | None = None) -> list[str]:
        if self._store is None:
            return []
        results = self._store.similarity_search(query, k=k or settings.MEMORY_TOP_K)
        return [doc.page_content for doc in results]
