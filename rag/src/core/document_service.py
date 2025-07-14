import hashlib
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ..models.document import Document, DocumentChunk
from ..pdf.extractor import PDFExtractor
from ..pdf.chunker import DocumentChunker
from ..vectorization.embeddings import EmbeddingService
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class DocumentService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.pdf_extractor = PDFExtractor()
        self.chunker = DocumentChunker()
        self.embedding_service = EmbeddingService()
    
    def upload_document(self, user_id: int, file_path: str, filename: str) -> Document:
        """Upload and process a new document."""
        logger.info(f"Starting document upload for user {user_id}: {filename}")
        
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
                logger.info(f"Document already exists: {existing_doc.id}")
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
            logger.info(f"Document uploaded successfully: {document.id}")
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
            logger.info(f"Document deleted: {document_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting document: {str(e)}")
            return False
    
    def search_documents(self, user_id: int, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """Search through user's documents using semantic similarity."""
        logger.info(f"Searching documents for user {user_id}: '{query}' (top_k: {top_k})")
        
        try:
            # Generate query embedding
            logger.info("Generating query embedding")
            query_embedding = self.embedding_service.embed_text(query)
            logger.info(f"Query embedding generated, shape: {len(query_embedding) if query_embedding else 'None'}")
            
            # Get all chunks for the user's documents
            logger.info("Querying database for user's document chunks")
            chunks = self.db.query(DocumentChunk).join(Document).filter(
                Document.user_id == user_id,
                Document.status == 'completed'
            ).all()
            
            logger.info(f"Found {len(chunks)} chunks for user {user_id}")
            
            if not chunks:
                logger.warning(f"No chunks found for user {user_id}")
                return []
            
            # Log document count and status
            documents = self.db.query(Document).filter_by(user_id=user_id).all()
            logger.info(f"User has {len(documents)} total documents")
            completed_docs = [d for d in documents if d.status == 'completed']
            logger.info(f"User has {len(completed_docs)} completed documents")
            
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
                        
                        logger.debug(f"Chunk {chunk.id} similarity: {similarity:.4f}")
                        
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
                else:
                    logger.debug(f"Chunk {chunk.id} has no embedding vector")
            
            logger.info(f"Processed {processed_chunks} chunks, {chunks_with_embeddings} had embeddings")
            logger.info(f"Generated {len(results)} similarity results")
            
            # Sort by similarity and return top results
            results.sort(key=lambda x: x['similarity'], reverse=True)
            top_results = results[:top_k]
            
            if top_results:
                logger.info(f"Top result similarity: {top_results[0]['similarity']:.4f}")
                logger.info(f"Returning top {len(top_results)} results")
            else:
                logger.warning("No results to return")
            
            return top_results
            
        except Exception as e:
            logger.error(f"Error searching documents: {str(e)}")
            import traceback
            logger.error(f"Search error traceback: {traceback.format_exc()}")
            return []
    
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
            logger.info(f"Extracting content from document {document.id}")
            extracted_content = self.pdf_extractor.extract_content(file_path)
            
            # Extract actual title from PDF metadata or content
            pdf_title = self._extract_paper_title(extracted_content)
            if pdf_title and pdf_title.strip():
                # Update document title with actual paper title (truncate to ~60 chars like VSCode)
                if len(pdf_title) > 60:
                    document.title = pdf_title[:57] + "..."
                else:
                    document.title = pdf_title
                logger.info(f"Updated document title to: {document.title}")
            
            # Update document metadata
            document.doc_metadata = {
                'page_count': extracted_content['page_count'],
                'pdf_metadata': extracted_content['metadata'],
                'structure': extracted_content['structure'],
                'original_title': pdf_title
            }
            
            # Create chunks
            logger.info(f"Creating chunks for document {document.id}")
            chunks = self.chunker.chunk_document(extracted_content)
            
            # Generate embeddings and store chunks
            logger.info(f"Generating embeddings for {len(chunks)} chunks")
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
                    logger.info(f"Cleaned up uploaded file: {file_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up uploaded file {file_path}: {str(cleanup_error)}")
            
            self.db.commit()
            logger.info(f"Document processing completed: {document.id}")
            
        except Exception as e:
            document.status = 'failed'
            
            # Clean up uploaded file on failure too
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Cleaned up uploaded file after failure: {file_path}")
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