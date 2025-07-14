from functools import wraps
from flask import request, jsonify
import jwt
import requests
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            auth_header = request.headers.get('Authorization')
            
            if not auth_header or not auth_header.startswith('Bearer '):
                logger.error("Authorization header missing or invalid")
                return jsonify({"error": "Authorization header missing or invalid"}), 401
            
            token = auth_header.split(' ')[1]
            
            auth_server_url = "http://localhost:8001"
            response = requests.get(
                f"{auth_server_url}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            
            if response.status_code != 200:
                logger.error(f"Auth server returned {response.status_code}: {response.text}")
                return jsonify({"error": "Invalid or expired token"}), 401
            
            user_data = response.json()["user"]
            request.current_user = user_data
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"Auth middleware error: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return jsonify({"error": "Authentication failed"}), 401
    
    return decorated_function