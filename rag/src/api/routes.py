from flask import Blueprint, request, jsonify
from ..core.rag_service import RagService
from ..middleware.auth_middleware import require_auth

api_bp = Blueprint('api', __name__, url_prefix='/api')
rag_service = RagService()

@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "rag-server"})

@api_bp.route('/query', methods=['POST'])
@require_auth
def handle_query():
    try:
        data = request.get_json()
        query = data.get('query', '')
        
        if not query:
            return jsonify({"error": "Query is required"}), 400
        
        user_id = request.current_user['id']
        response = rag_service.process_query(query, user_id)
        
        return jsonify({
            "query": query,
            "response": response,
            "user_id": user_id,
            "status": "success"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500