from flask import Blueprint, request, jsonify
from ..core.rag_service import RagService

api_bp = Blueprint('api', __name__, url_prefix='/api')
rag_service = RagService()

@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "rag-server"})

@api_bp.route('/query', methods=['POST'])
def handle_query():
    try:
        data = request.get_json()
        query = data.get('query', '')
        
        if not query:
            return jsonify({"error": "Query is required"}), 400
        
        response = rag_service.process_query(query)
        
        return jsonify({
            "query": query,
            "response": response,
            "status": "success"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500