import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, desc
from ..middleware.auth_middleware import require_auth
from ..core.document_service import DocumentService
from ..models.document import Base, ChatSession, ChatMessage, MessageRole
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
        
        logger.info(f"Processing chat message for user {user_id}, session {session_id}")
        
        db = get_db()
        try:
            # Get or create session
            if session_id:
                session = db.query(ChatSession).filter_by(
                    id=session_id,
                    user_id=user_id,
                    deleted_at=None  # Only get non-deleted sessions
                ).first()
                if not session:
                    return jsonify({"error": "Chat session not found"}), 404
            else:
                # Create new session
                session_id = str(uuid.uuid4())
                session_title = user_message[:50] + "..." if len(user_message) > 50 else user_message
                session = ChatSession(
                    id=session_id,
                    user_id=user_id,
                    title=session_title,
                    message_count=0,
                    total_tokens=0
                )
                db.add(session)
                db.flush()  # Get the session ID
            
            # Get chat history from database (excluding deleted messages)
            messages = db.query(ChatMessage).filter_by(
                session_id=session_id,
                deleted_at=None  # Only get non-deleted messages
            ).order_by(ChatMessage.sequence, ChatMessage.timestamp).all()
            chat_history = []
            for msg in messages:
                chat_history.append({
                    "role": msg.role.value,
                    "content": msg.content
                })

            # Calculate next sequence number
            next_sequence = len(messages) + 1
            
            # Save user message to database
            user_msg_id = str(uuid.uuid4())
            user_db_message = ChatMessage(
                id=user_msg_id,
                session_id=session_id,
                role=MessageRole.USER,
                content=user_message,
                timestamp=datetime.utcnow(),
                sequence=next_sequence
            )
            db.add(user_db_message)
            next_sequence += 1
            
            # Generate chat response with document context
            document_service = DocumentService(db)
            chat_response = document_service.generate_chat_response(
                user_id=user_id,
                user_message=user_message,
                chat_history=chat_history,
                session_id=session_id
            )
            
            # Save assistant message to database
            assistant_msg_id = str(uuid.uuid4())
            assistant_timestamp = datetime.utcnow()
            assistant_db_message = ChatMessage(
                id=assistant_msg_id,
                session_id=session_id,
                role=MessageRole.ASSISTANT,
                content=chat_response,
                timestamp=assistant_timestamp,
                sequence=next_sequence,
                model_version="gpt-3.5-turbo"  # Update this based on actual model used
            )
            db.add(assistant_db_message)

            # Update session last activity and message count
            session.last_activity = assistant_timestamp
            session.message_count = (session.message_count or 0) + 2  # User + assistant messages
            
            # Commit all changes
            db.commit()
            
            response_data = {
                "session_id": session_id,
                "message": chat_response,
                "timestamp": assistant_timestamp.isoformat(),
                "user_message": user_message,
                "user_message_id": user_msg_id,
                "assistant_message_id": assistant_msg_id
            }
            
            return jsonify(response_data)
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}")
        import traceback
        logger.error(f"Chat error traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to process chat message"}), 500

@chat_bp.route('/sessions', methods=['GET'])
@require_auth
def get_sessions():
    """Get all chat sessions for the user."""
    try:
        user_id = request.current_user['id']
        
        db = get_db()
        try:
            # Get sessions ordered by last activity (most recent first), excluding deleted
            sessions = db.query(ChatSession).filter_by(
                user_id=user_id,
                deleted_at=None  # Only get non-deleted sessions
            ).order_by(desc(ChatSession.last_activity)).all()
            
            sessions_data = []
            for session in sessions:
                sessions_data.append({
                    "id": session.id,
                    "title": session.title,
                    "created_at": session.created_at.isoformat(),
                    "last_activity": session.last_activity.isoformat(),
                    "message_count": session.message_count or 0
                })
            
            return jsonify({"sessions": sessions_data})
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error retrieving chat sessions: {str(e)}")
        return jsonify({"error": "Failed to retrieve chat sessions"}), 500

@chat_bp.route('/sessions/<session_id>', methods=['GET'])
@require_auth
def get_session(session_id):
    """Get specific chat session with full message history."""
    try:
        user_id = request.current_user['id']

        db = get_db()
        try:
            # Get session and ensure it belongs to the user (and not deleted)
            session = db.query(ChatSession).filter_by(
                id=session_id,
                user_id=user_id,
                deleted_at=None  # Only get non-deleted sessions
            ).first()
            
            if not session:
                return jsonify({"error": "Chat session not found"}), 404
            
            # Get messages for the session (excluding deleted messages)
            messages = db.query(ChatMessage).filter_by(
                session_id=session_id,
                deleted_at=None  # Only get non-deleted messages
            ).order_by(ChatMessage.sequence, ChatMessage.timestamp).all()
            
            messages_data = []
            for message in messages:
                messages_data.append({
                    "id": message.id,
                    "role": message.role.value,
                    "content": message.content,
                    "timestamp": message.timestamp.isoformat()
                })
            
            response_data = {
                "id": session.id,
                "title": session.title,
                "created_at": session.created_at.isoformat(),
                "last_activity": session.last_activity.isoformat(),
                "messages": messages_data
            }
            
            return jsonify(response_data)
            
        finally:
            db.close()
        
    except Exception as e:
        logger.error(f"Error retrieving chat session: {str(e)}")
        return jsonify({"error": "Failed to retrieve chat session"}), 500

@chat_bp.route('/sessions/<session_id>', methods=['DELETE'])
@require_auth
def delete_session(session_id):
    """Delete a chat session."""
    try:
        user_id = request.current_user['id']
        
        db = get_db()
        try:
            # Get session and ensure it belongs to the user
            session = db.query(ChatSession).filter_by(
                id=session_id,
                user_id=user_id,
                deleted_at=None  # Only delete non-deleted sessions
            ).first()

            if not session:
                return jsonify({"error": "Chat session not found"}), 404

            # Soft delete the session
            session.deleted_at = datetime.utcnow()

            # Soft delete all messages in the session
            messages = db.query(ChatMessage).filter_by(session_id=session_id).all()
            for message in messages:
                message.deleted_at = datetime.utcnow()

            db.commit()
            
            return jsonify({"message": "Chat session deleted successfully"})
            
        finally:
            db.close()
        
    except Exception as e:
        logger.error(f"Error deleting chat session: {str(e)}")
        return jsonify({"error": "Failed to delete chat session"}), 500