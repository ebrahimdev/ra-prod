import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional, Tuple
import json
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class EmbeddingService:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        """Initialize embedding service with specified model."""
        try:
            self.model = SentenceTransformer(model_name)
            self.model_name = model_name
            self.embedding_dim = self.model.get_sentence_embedding_dimension()
        except Exception as e:
            logger.error(f"Failed to initialize embedding model: {str(e)}")
            raise
    
    def embed_text(self, text: str, chunk_metadata: Optional[Dict] = None) -> List[float]:
        """Generate embeddings for text content."""
        try:
            # Preprocess text for better embeddings
            processed_text = self._preprocess_text(text, chunk_metadata)
            
            # Generate embedding
            embedding = self.model.encode(processed_text, convert_to_tensor=False)
            
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating text embedding: {str(e)}")
            return [0.0] * self.embedding_dim
    
    def embed_multimodal_chunk(self, chunk: Dict[str, Any]) -> List[float]:
        """Generate embeddings for multimodal chunks (text + metadata)."""
        try:
            chunk_type = chunk.get('chunk_type', 'text')
            content = chunk.get('content', '')
            metadata = chunk.get('metadata', {})
            
            if chunk_type == 'text':
                return self._embed_text_chunk(content, metadata, chunk)
            elif chunk_type == 'table':
                return self._embed_table_chunk(chunk)
            elif chunk_type == 'reference':
                return self._embed_reference_chunk(content, metadata)
            else:
                # Fallback to simple text embedding
                return self.embed_text(content)
                
        except Exception as e:
            logger.error(f"Error generating multimodal embedding: {str(e)}")
            return [0.0] * self.embedding_dim
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts efficiently."""
        try:
            embeddings = self.model.encode(texts, convert_to_tensor=False, batch_size=32)
            return [emb.tolist() for emb in embeddings]
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {str(e)}")
            return [[0.0] * self.embedding_dim] * len(texts)
    
    def _embed_text_chunk(self, content: str, metadata: Dict, chunk: Dict) -> List[float]:
        """Enhanced embedding for text chunks with context."""
        # Build enriched text for embedding
        enriched_content = content
        
        # Add section context
        section_title = chunk.get('section_title', '')
        if section_title and section_title not in content:
            enriched_content = f"Section: {section_title}. {enriched_content}"
        
        # Add type information for better semantic understanding
        section_type = chunk.get('section_type', '')
        if section_type in ['abstract', 'introduction', 'conclusion', 'methodology']:
            enriched_content = f"[{section_type.upper()}] {enriched_content}"
        
        # Add formula/citation indicators
        if metadata.get('has_formulas'):
            enriched_content = f"[CONTAINS_FORMULAS] {enriched_content}"
        if metadata.get('has_citations'):
            enriched_content = f"[CONTAINS_CITATIONS] {enriched_content}"
        
        return self.embed_text(enriched_content)
    
    
    def _embed_table_chunk(self, chunk: Dict) -> List[float]:
        """Embedding for table chunks."""
        content_parts = []
        
        # Add table identifier
        content_parts.append("[TABLE]")
        
        # Add table structure info
        metadata = chunk.get('metadata', {})
        rows = metadata.get('rows', 0)
        cols = metadata.get('cols', 0)
        if rows and cols:
            content_parts.append(f"Structure: {rows}x{cols} table")
        
        # Add table content
        content = chunk.get('content', '')
        if content:
            content_parts.append(content)
        
        # Add structured table data if available
        table_data = chunk.get('table_data', [])
        if table_data:
            # Extract headers (first row) for better context
            if len(table_data) > 0 and table_data[0]:
                headers = [str(cell) for cell in table_data[0] if cell]
                if headers:
                    content_parts.append(f"Headers: {', '.join(headers)}")
        
        combined_content = ' '.join(content_parts)
        return self.embed_text(combined_content)
    
    def _embed_reference_chunk(self, content: str, metadata: Dict) -> List[float]:
        """Embedding for reference chunks."""
        # Add reference context
        enriched_content = f"[REFERENCE] {content}"
        return self.embed_text(enriched_content)
    
    def _preprocess_text(self, text: str, metadata: Optional[Dict] = None) -> str:
        """Preprocess text for better embeddings."""
        # Clean up text
        text = text.strip()
        
        # Remove excessive whitespace
        text = ' '.join(text.split())
        
        # Handle special cases based on metadata
        if metadata:
            if metadata.get('has_formulas'):
                # Preserve mathematical notation
                text = self._preserve_math_notation(text)
        
        return text
    
    def _preserve_math_notation(self, text: str) -> str:
        """Preserve mathematical notation in text."""
        # This is a placeholder for more sophisticated math notation handling
        # In a production system, you might want to:
        # 1. Parse LaTeX notation
        # 2. Convert symbols to text descriptions
        # 3. Normalize mathematical expressions
        return text
    
    def compute_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Compute cosine similarity between two embeddings."""
        try:
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            # Compute cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error computing similarity: {str(e)}")
            return 0.0
    
    def find_similar_chunks(self, query_embedding: List[float], 
                           chunk_embeddings: List[List[float]], 
                           top_k: int = 5) -> List[Tuple[int, float]]:
        """Find most similar chunks to query."""
        similarities = []
        
        for i, chunk_embedding in enumerate(chunk_embeddings):
            similarity = self.compute_similarity(query_embedding, chunk_embedding)
            similarities.append((i, similarity))
        
        # Sort by similarity score (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        return similarities[:top_k]