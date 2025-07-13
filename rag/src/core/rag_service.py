from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from .document_service import DocumentService
from ..models.document import Base

class RagService:
    def __init__(self):
        # Database setup (in production, this would be configured elsewhere)
        engine = create_engine('sqlite:///documents.db')
        Base.metadata.create_all(engine)
        SessionLocal = sessionmaker(bind=engine)
        self.SessionLocal = SessionLocal
    
    def process_query(self, query: str, user_id: int) -> str:
        """Process RAG query using user's document library."""
        db = self.SessionLocal()
        try:
            document_service = DocumentService(db)
            
            # Search through user's documents
            search_results = document_service.search_documents(user_id, query, top_k=3)
            
            if not search_results:
                return f"No relevant documents found for your query: {query}"
            
            # Build context from top results
            context_parts = []
            for result in search_results:
                context_parts.append(
                    f"From '{result['document_title']}' (Page {result['page_number']}, "
                    f"Section: {result['section_title']}):\n{result['content'][:300]}..."
                )
            
            context = "\n\n".join(context_parts)
            
            # For now, return a simple response with context
            # In production, you'd use an LLM to generate a proper answer
            response = f"Based on your documents, here are the most relevant excerpts:\n\n{context}"
            
            return response
            
        finally:
            db.close()