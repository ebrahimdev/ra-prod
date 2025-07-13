from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

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