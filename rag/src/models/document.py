from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()

class Document(Base):
    __tablename__ = 'documents'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    title = Column(String(500), nullable=False)
    authors = Column(Text)
    filename = Column(String(255), nullable=False)
    file_hash = Column(String(64), unique=True, nullable=False)
    file_size = Column(Integer)
    upload_date = Column(DateTime, default=datetime.utcnow)
    processed_date = Column(DateTime)
    status = Column(String(50), default='uploaded')  # uploaded, processing, completed, failed
    doc_metadata = Column(JSON)  # Store paper metadata (journal, year, etc.)
    
    # Relationship to chunks
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = 'document_chunks'
    
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey('documents.id'), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_type = Column(String(50), nullable=False)  # text, image, formula, table, reference
    content = Column(Text, nullable=False)
    page_number = Column(Integer)
    section_title = Column(String(200))
    bbox = Column(JSON)  # Bounding box coordinates
    embedding_vector = Column(JSON)  # Store as JSON array
    chunk_metadata = Column(JSON)  # Additional chunk metadata
    
    # Relationship back to document
    document = relationship("Document", back_populates="chunks")

class DocumentImage(Base):
    __tablename__ = 'document_images'
    
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey('documents.id'), nullable=False)
    chunk_id = Column(Integer, ForeignKey('document_chunks.id'))
    image_path = Column(String(500), nullable=False)
    image_type = Column(String(50))  # figure, chart, diagram, formula
    caption = Column(Text)
    page_number = Column(Integer)
    bbox = Column(JSON)
    ocr_text = Column(Text)  # Extracted text from image
    
    # Relationships
    document = relationship("Document")
    chunk = relationship("DocumentChunk")

class MessageRole(enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"

class ChatSession(Base):
    __tablename__ = 'chat_sessions'

    id = Column(String(36), primary_key=True)  # UUID
    user_id = Column(Integer, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow, index=True)
    message_count = Column(Integer, default=0)  # Track total messages in session
    total_tokens = Column(Integer, default=0)  # Track token usage
    session_metadata = Column(JSON)  # Store tags, categories, settings, etc.
    deleted_at = Column(DateTime, nullable=True)  # Soft delete support

    # Relationship to messages
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = 'chat_messages'

    id = Column(String(36), primary_key=True)  # UUID
    session_id = Column(String(36), ForeignKey('chat_sessions.id'), nullable=False, index=True)
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    sequence = Column(Integer)  # Explicit message ordering within session
    tokens_used = Column(Integer)  # Track tokens for this message
    model_version = Column(String(50))  # Track which model generated response
    context_documents = Column(JSON)  # Store document IDs used for context
    message_metadata = Column(JSON)  # Store additional data (latency, confidence, etc.)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete support

    # Relationship back to session
    session = relationship("ChatSession", back_populates="messages")