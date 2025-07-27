import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from ..middleware.auth_middleware import require_auth
from ..core.document_service import DocumentService
from ..models.document import Base
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

# Create blueprint
chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

# Database setup (using same setup as document_routes)
engine = create_engine('sqlite:///documents.db')
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # Don't close here, will be closed in route handlers

@chat_bp.route('/message', methods=['POST'])
@require_auth
def send_message():
    """Send a message to the chat assistant with document context."""
    try:
        user_id = request.current_user['id']
        
        data = request.get_json()
        
        if not data or 'message' not in data:
            logger.warning("Chat request missing message parameter")
            return jsonify({"error": "Message is required"}), 400
        
        user_message = data['message']
        session_id = data.get('session_id')
        chat_history = data.get('chat_history', [])
        
        # Generate session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())
        
        logger.info(f"Processing chat message for user {user_id}, session {session_id}")
        
        db = get_db()
        try:
            document_service = DocumentService(db)
            
            # Generate chat response with document context
            chat_response = document_service.generate_chat_response(
                user_id=user_id,
                user_message=user_message,
                chat_history=chat_history,
                session_id=session_id
            )
            
            response_data = {
                "session_id": session_id,
                "message": chat_response,
                "timestamp": datetime.utcnow().isoformat(),
                "user_message": user_message
            }
            
            return jsonify(response_data)
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}")
        import traceback
        logger.error(f"Chat error traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to process chat message"}), 500

@chat_bp.route('/sessions/<session_id>', methods=['GET'])
@require_auth
def get_session(session_id):
    """Get chat session history (if we implement session storage later)."""
    try:
        user_id = request.current_user['id']
        
        # For now, return empty session - this can be extended later
        # with actual session storage in database
        
        response_data = {
            "session_id": session_id,
            "messages": [],
            "created_at": datetime.utcnow().isoformat()
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error retrieving chat session: {str(e)}")
        return jsonify({"error": "Failed to retrieve chat session"}), 500