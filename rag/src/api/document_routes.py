import os
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from ..middleware.auth_middleware import require_auth
from ..core.document_service import DocumentService
from ..models.document import Base
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

# Create blueprint
doc_bp = Blueprint('documents', __name__, url_prefix='/api/documents')

# Database setup (in production, this would be configured elsewhere)
engine = create_engine('sqlite:///documents.db')
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)

# File upload configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # Don't close here, will be closed in route handlers

@doc_bp.route('/upload', methods=['POST'])
@require_auth
def upload_document():
    """Upload a PDF document for processing."""
    try:
        user_id = request.current_user['id']
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "Only PDF files are allowed"}), 400
        
        # Check file size
        if len(file.read()) > MAX_FILE_SIZE:
            return jsonify({"error": "File too large. Maximum size is 50MB"}), 400
        file.seek(0)  # Reset file pointer
        
        # Secure filename
        filename = secure_filename(file.filename)
        
        # Create upload directory if it doesn't exist
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        # Save file
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        # Process document
        db = get_db()
        try:
            document_service = DocumentService(db)
            document = document_service.upload_document(user_id, file_path, filename)
            
            result = {
                "message": "Document uploaded successfully",
                "document": {
                    "id": document.id,
                    "title": document.title,
                    "filename": document.filename,
                    "status": document.status,
                    "upload_date": document.upload_date.isoformat(),
                    "file_size": document.file_size
                }
            }
            
            return jsonify(result), 201
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        return jsonify({"error": "Failed to upload document"}), 500

@doc_bp.route('/', methods=['GET'])
@require_auth
def get_documents():
    """Get all documents for the authenticated user."""
    try:
        user_id = request.current_user['id']
        status = request.args.get('status')
        
        db = get_db()
        try:
            document_service = DocumentService(db)
            documents = document_service.get_user_documents(user_id, status)
            
            result = {
                "documents": [
                    {
                        "id": doc.id,
                        "title": doc.title,
                        "filename": doc.filename,
                        "status": doc.status,
                        "upload_date": doc.upload_date.isoformat(),
                        "processed_date": doc.processed_date.isoformat() if doc.processed_date else None,
                        "file_size": doc.file_size,
                        "metadata": doc.doc_metadata
                    }
                    for doc in documents
                ]
            }
            
            return jsonify(result)
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error getting documents: {str(e)}")
        return jsonify({"error": "Failed to retrieve documents"}), 500

@doc_bp.route('/<int:document_id>', methods=['GET'])
@require_auth
def get_document(document_id):
    """Get a specific document with its chunks."""
    try:
        user_id = request.current_user['id']
        
        db = get_db()
        try:
            document_service = DocumentService(db)
            document = document_service.get_document(user_id, document_id)
            
            if not document:
                return jsonify({"error": "Document not found"}), 404
            
            # Get chunks
            chunks = document_service.get_document_chunks(user_id, document_id)
            
            result = {
                "document": {
                    "id": document.id,
                    "title": document.title,
                    "filename": document.filename,
                    "status": document.status,
                    "upload_date": document.upload_date.isoformat(),
                    "processed_date": document.processed_date.isoformat() if document.processed_date else None,
                    "file_size": document.file_size,
                    "metadata": document.doc_metadata
                },
                "chunks": [
                    {
                        "id": chunk.id,
                        "chunk_index": chunk.chunk_index,
                        "chunk_type": chunk.chunk_type,
                        "content": chunk.content[:500] + "..." if len(chunk.content) > 500 else chunk.content,
                        "page_number": chunk.page_number,
                        "section_title": chunk.section_title,
                        "metadata": chunk.chunk_metadata
                    }
                    for chunk in chunks
                ]
            }
            
            return jsonify(result)
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error getting document: {str(e)}")
        return jsonify({"error": "Failed to retrieve document"}), 500

@doc_bp.route('/<int:document_id>', methods=['DELETE'])
@require_auth
def delete_document(document_id):
    """Delete a document and all its chunks."""
    try:
        user_id = request.current_user['id']
        
        db = get_db()
        try:
            document_service = DocumentService(db)
            success = document_service.delete_document(user_id, document_id)
            
            if not success:
                return jsonify({"error": "Document not found"}), 404
            
            return jsonify({"message": "Document deleted successfully"})
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        return jsonify({"error": "Failed to delete document"}), 500

@doc_bp.route('/search', methods=['POST'])
@require_auth
def search_documents():
    """Search through user's documents using semantic similarity."""
    try:
        user_id = request.current_user['id']
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({"error": "Query is required"}), 400
        
        query = data['query']
        top_k = data.get('top_k', 10)
        
        db = get_db()
        try:
            document_service = DocumentService(db)
            results = document_service.search_documents(user_id, query, top_k)
            
            return jsonify({
                "query": query,
                "results": results,
                "count": len(results)
            })
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error searching documents: {str(e)}")
        return jsonify({"error": "Failed to search documents"}), 500