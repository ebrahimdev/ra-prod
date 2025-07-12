from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from ..models.user import User

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            current_user_id = get_jwt_identity()
            
            user = User.query.get(current_user_id)
            if not user or not user.is_active:
                return jsonify({"error": "User not found or inactive"}), 401
            
            request.current_user = user
            return f(*args, **kwargs)
            
        except Exception as e:
            return jsonify({"error": "Invalid or expired token"}), 401
    
    return decorated_function