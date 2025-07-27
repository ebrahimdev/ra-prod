import hashlib
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ..models.document import Document, DocumentChunk
from ..pdf.extractor import PDFExtractor
from ..pdf.chunker import DocumentChunker
from ..vectorization.embeddings import EmbeddingService
from ..llm.client import OpenChatClient
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class DocumentService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.pdf_extractor = PDFExtractor()
        self.chunker = DocumentChunker()
        self.embedding_service = EmbeddingService()
        self.llm_client = OpenChatClient()
    
    def upload_document(self, user_id: int, file_path: str, filename: str) -> Document:
        """Upload and process a new document."""
        
        try:
            # Calculate file hash for deduplication
            file_hash = self._calculate_file_hash(file_path)
            file_size = os.path.getsize(file_path)
            
            # Check if document already exists for this user
            existing_doc = self.db.query(Document).filter_by(
                user_id=user_id, 
                file_hash=file_hash
            ).first()
            
            if existing_doc:
                return existing_doc
            
            # Create document record
            document = Document(
                user_id=user_id,
                title=filename.replace('.pdf', ''),
                filename=filename,
                file_hash=file_hash,
                file_size=file_size,
                status='uploaded'
            )
            
            self.db.add(document)
            self.db.flush()  # Get the document ID
            
            # Process document asynchronously (in production, use a task queue)
            self._process_document(document, file_path)
            
            self.db.commit()
            return document
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error uploading document: {str(e)}")
            raise
    
    def get_user_documents(self, user_id: int, status: Optional[str] = None) -> List[Document]:
        """Get all documents for a user."""
        query = self.db.query(Document).filter_by(user_id=user_id)
        
        if status:
            query = query.filter_by(status=status)
        
        return query.order_by(Document.upload_date.desc()).all()
    
    def get_document(self, user_id: int, document_id: int) -> Optional[Document]:
        """Get a specific document if it belongs to the user."""
        return self.db.query(Document).filter_by(
            id=document_id, 
            user_id=user_id
        ).first()
    
    def delete_document(self, user_id: int, document_id: int) -> bool:
        """Delete a document and all its chunks."""
        document = self.get_document(user_id, document_id)
        if not document:
            return False
        
        try:
            # Delete associated chunks and images (cascade should handle this)
            self.db.delete(document)
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting document: {str(e)}")
            return False
    
    def search_documents(self, user_id: int, query: str, top_k: int = 10) -> Dict[str, Any]:
        """Search through user's documents using semantic similarity and generate LLM response."""
        
        try:
            # Generate query embedding
            query_embedding = self.embedding_service.embed_text(query)
            
            # Get all chunks for the user's documents
            chunks = self.db.query(DocumentChunk).join(Document).filter(
                Document.user_id == user_id,
                Document.status == 'completed'
            ).all()
            
            if not chunks:
                logger.warning(f"No chunks found for user {user_id}")
                return {
                    'results': [],
                    'llm_response': 'No documents found in your library. Please upload some papers first.',
                    'query': query
                }
            
            # Calculate similarities
            results = []
            processed_chunks = 0
            chunks_with_embeddings = 0
            
            for chunk in chunks:
                processed_chunks += 1
                if chunk.embedding_vector:
                    chunks_with_embeddings += 1
                    try:
                        chunk_embedding = chunk.embedding_vector
                        similarity = self.embedding_service.compute_similarity(
                            query_embedding, chunk_embedding
                        )
                        
                        results.append({
                            'chunk_id': chunk.id,
                            'document_id': chunk.document_id,
                            'document_title': chunk.document.title,
                            'content': chunk.content,
                            'chunk_type': chunk.chunk_type,
                            'section_title': chunk.section_title,
                            'page_number': chunk.page_number,
                            'similarity': similarity,
                            'metadata': chunk.chunk_metadata
                        })
                    except Exception as e:
                        logger.warning(f"Error processing chunk {chunk.id}: {str(e)}")
            
            # Sort by similarity and get top results
            results.sort(key=lambda x: x['similarity'], reverse=True)
            top_results = results[:top_k]
            
            if not top_results:
                return {
                    'results': [],
                    'llm_response': 'No relevant content found for your query. Try rephrasing or using different keywords.',
                    'query': query
                }
            
            # Generate LLM response using top results
            llm_response = self._generate_search_response(query, top_results)
            
            return {
                'results': top_results,
                'llm_response': llm_response,
                'query': query
            }
            
        except Exception as e:
            logger.error(f"Error searching documents: {str(e)}")
            import traceback
            logger.error(f"Search error traceback: {traceback.format_exc()}")
            return {
                'results': [],
                'llm_response': 'An error occurred while searching your documents. Please try again.',
                'query': query
            }
    
    def _generate_search_response(self, query: str, search_results: List[Dict[str, Any]]) -> str:
        """Generate an LLM response based on search results and user query."""
        try:
            # Build context from search results
            context_chunks = []
            for i, result in enumerate(search_results[:5]):  # Use top 5 results for context
                chunk_content = result['content'][:500]  # Truncate long chunks
                document_title = result['document_title']
                page_num = result.get('page_number', 'N/A')
                section = result.get('section_title', '')
                
                reference = f"[{document_title}"
                if page_num != 'N/A':
                    reference += f", p.{page_num}"
                if section:
                    reference += f", {section}"
                reference += "]"
                
                context_chunks.append(f"{i+1}. {reference}: {chunk_content}")
            
            context = "\n\n".join(context_chunks)
            
            # Create prompt for LLM
            messages = [
                {
                    "role": "system",
                    "content": """You are a research assistant helping a user search through their academic paper library. 
                    Based on the provided context from their papers, answer their question in 1-3 well-structured paragraphs.
                    Use inline citations referencing the papers by their titles and page numbers where appropriate.
                    Be concise but informative, focusing on directly addressing the user's question.
                    
                    IMPORTANT: Format your response using Markdown. Use **bold** for emphasis, *italics* for terms, 
                    and proper formatting for readability. This helps the frontend display the content properly."""
                },
                {
                    "role": "user",
                    "content": f"""The user is searching their paper library with this query: "{query}"

Here are the most relevant excerpts from their papers:

{context}

Please provide a comprehensive answer to their query based on this information from their library. Use inline references like [Paper Title, p.X] when citing specific information. Format your response in Markdown."""
                }
            ]
            
            # Call LLM
            response = self.llm_client.chat_completion(
                messages=messages,
                max_tokens=800,
                temperature=0.1
            )
            
            return response.content
            
        except Exception as e:
            logger.error(f"Error generating LLM response: {str(e)}")
            return f"Based on your search for '{query}', I found {len(search_results)} relevant excerpts from your papers, but couldn't generate a detailed response. Please check the search results below for relevant information."
    
    def generate_chat_response(self, user_id: int, user_message: str, chat_history: List[Dict[str, Any]], session_id: str) -> str:
        """Generate a chat response with document context and conversation history."""
        try:
            # First, search for relevant documents based on the user's message
            search_response = self.search_documents(user_id, user_message, top_k=5)
            relevant_chunks = search_response.get('results', [])
            
            # Build context from relevant documents
            document_context = ""
            if relevant_chunks:
                context_chunks = []
                for i, result in enumerate(relevant_chunks[:3]):  # Use top 3 for context
                    chunk_content = result['content'][:300]  # Shorter chunks for chat
                    document_title = result['document_title']
                    page_num = result.get('page_number', 'N/A')
                    
                    reference = f"[{document_title}"
                    if page_num != 'N/A':
                        reference += f", p.{page_num}"
                    reference += "]"
                    
                    context_chunks.append(f"{reference}: {chunk_content}")
                
                document_context = "\n\n".join(context_chunks)
            
            # Build conversation history for context
            conversation_context = ""
            if chat_history:
                recent_history = chat_history[-4:]  # Last 4 messages for context
                history_parts = []
                for msg in recent_history:
                    role = msg.get('role', 'unknown')
                    content = msg.get('content', '')
                    if role == 'user':
                        history_parts.append(f"User: {content}")
                    elif role == 'assistant':
                        history_parts.append(f"Assistant: {content}")
                
                if history_parts:
                    conversation_context = "\n".join(history_parts)
            
            # Create chat prompt
            messages = [
                {
                    "role": "system",
                    "content": """You are a research assistant helping a user with their academic paper library. You can:
                    1. Answer questions about their research papers
                    2. Help with brainstorming and research ideas
                    3. Provide insights based on their document collection
                    4. Continue conversations with context from previous messages
                    
                    Always be helpful, concise, and reference specific papers when relevant.
                    Format your response in Markdown for better readability.
                    Use inline citations like [Paper Title, p.X] when referencing specific content."""
                }
            ]
            
            # Add conversation history if available
            if conversation_context:
                messages.append({
                    "role": "system",
                    "content": f"Previous conversation context:\n{conversation_context}"
                })
            
            # Add document context if available
            user_content = f"User message: {user_message}"
            if document_context:
                user_content += f"\n\nRelevant excerpts from their papers:\n{document_context}"
            else:
                user_content += "\n\nNo specific documents found relevant to this message."
            
            messages.append({
                "role": "user",
                "content": user_content
            })
            
            # Call LLM
            response = self.llm_client.chat_completion(
                messages=messages,
                max_tokens=600,
                temperature=0.3  # Slightly higher for more conversational responses
            )
            
            return response.content
            
        except Exception as e:
            logger.error(f"Error generating chat response: {str(e)}")
            import traceback
            logger.error(f"Chat error traceback: {traceback.format_exc()}")
            return "I apologize, but I'm having trouble generating a response right now. Please try again."
    
    def get_document_chunks(self, user_id: int, document_id: int) -> List[DocumentChunk]:
        """Get all chunks for a specific document."""
        document = self.get_document(user_id, document_id)
        if not document:
            return []
        
        return self.db.query(DocumentChunk).filter_by(
            document_id=document_id
        ).order_by(DocumentChunk.chunk_index).all()
    
    def _process_document(self, document: Document, file_path: str):
        """Process document: extract content, create chunks, generate embeddings."""
        try:
            document.status = 'processing'
            self.db.commit()
            
            # Extract content from PDF
            extracted_content = self.pdf_extractor.extract_content(file_path)
            
            # Extract actual title from PDF metadata or content
            pdf_title = self._extract_paper_title(extracted_content)
            if pdf_title and pdf_title.strip():
                # Update document title with actual paper title (truncate to ~60 chars like VSCode)
                if len(pdf_title) > 60:
                    document.title = pdf_title[:57] + "..."
                else:
                    document.title = pdf_title
            
            # Update document metadata
            document.doc_metadata = {
                'page_count': extracted_content['page_count'],
                'pdf_metadata': extracted_content['metadata'],
                'structure': extracted_content['structure'],
                'original_title': pdf_title
            }
            
            # Create chunks
            chunks = self.chunker.chunk_document(extracted_content)
            
            # Generate embeddings and store chunks
            for chunk_data in chunks:
                try:
                    # Generate embedding for the chunk
                    embedding = self.embedding_service.embed_multimodal_chunk(chunk_data)
                    
                    # Create chunk record
                    chunk = DocumentChunk(
                        document_id=document.id,
                        chunk_index=chunk_data['chunk_index'],
                        chunk_type=chunk_data['chunk_type'],
                        content=chunk_data['content'],
                        page_number=chunk_data.get('page_number'),
                        section_title=chunk_data.get('section_title'),
                        bbox=chunk_data.get('bbox'),
                        embedding_vector=embedding,
                        chunk_metadata=chunk_data.get('metadata', {})
                    )
                    
                    self.db.add(chunk)
                    
                except Exception as e:
                    logger.error(f"Error processing chunk: {str(e)}")
            
            # Mark document as completed
            document.status = 'completed'
            document.processed_date = datetime.utcnow()
            
            # Clean up uploaded file after successful processing
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up uploaded file {file_path}: {str(cleanup_error)}")
            
            self.db.commit()
            
        except Exception as e:
            document.status = 'failed'
            
            # Clean up uploaded file on failure too
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up uploaded file {file_path}: {str(cleanup_error)}")
            
            self.db.commit()
            logger.error(f"Error processing document {document.id}: {str(e)}")
            raise
    
    
    def _extract_paper_title(self, extracted_content: Dict[str, Any]) -> Optional[str]:
        """Extract the actual paper title from PDF content."""
        try:
            # First try PDF metadata title
            metadata = extracted_content.get('metadata', {})
            if metadata.get('title') and metadata['title'].strip():
                return metadata['title'].strip()
            
            # Then try to find title from text content (usually in first few pages)
            text_content = extracted_content.get('text_content', [])
            
            # Look for title patterns in the first few pages
            for content_block in text_content[:20]:  # Check first 20 text blocks
                text = content_block.get('text', '').strip()
                if not text:
                    continue
                
                # Skip very short text (likely not a title)
                if len(text) < 10:
                    continue
                
                # Skip text that looks like headers, footers, or page numbers
                if any(pattern in text.lower() for pattern in ['abstract', 'introduction', 'page', 'figure', 'table']):
                    continue
                
                # Skip if it's all uppercase (likely a header/section)
                if text.isupper():
                    continue
                
                # Skip if it has too many special characters
                special_char_ratio = sum(1 for c in text if not c.isalnum() and c != ' ') / len(text)
                if special_char_ratio > 0.3:
                    continue
                
                # Check if this looks like a title (reasonable length, proper formatting)
                words = text.split()
                if 3 <= len(words) <= 20 and content_block.get('page_number', 1) <= 2:
                    # This could be the title
                    return text
            
            return None
            
        except Exception as e:
            logger.warning(f"Error extracting paper title: {str(e)}")
            return None
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()