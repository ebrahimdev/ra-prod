from flask import Blueprint, request, jsonify, redirect, session
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from ..models.user import User
from ..models.database import db
from ..core.auth_service import AuthService
from ..core.google_oauth_service import GoogleOAuthService
import os
import time

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
auth_service = AuthService()
google_oauth_service = GoogleOAuthService()

# Simple in-memory state storage (for development)
oauth_states = {}

@auth_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "auth-server"})

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        required_fields = ['email', 'password', 'first_name', 'last_name']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email already registered"}), 400
        
        user = auth_service.create_user(
            email=data['email'],
            password=data['password'],
            first_name=data['first_name'],
            last_name=data['last_name']
        )
        
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        
        return jsonify({
            "message": "User registered successfully",
            "user": user.to_dict(),
            "access_token": access_token,
            "refresh_token": refresh_token
        }), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({"error": "Email and password required"}), 400
        
        user = auth_service.authenticate_user(data['email'], data['password'])
        
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401
        
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        
        return jsonify({
            "message": "Login successful",
            "user": user.to_dict(),
            "access_token": access_token,
            "refresh_token": refresh_token
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    try:
        current_user_id = get_jwt_identity()
        new_token = create_access_token(identity=current_user_id)
        
        return jsonify({
            "access_token": new_token
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(int(current_user_id))
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "user": user.to_dict()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Google OAuth Routes
@auth_bp.route('/google/login', methods=['GET'])
def google_login():
    """Initiate Google OAuth login"""
    try:
        print(f"Google Client ID: {os.getenv('GOOGLE_CLIENT_ID')}")
        print(f"Google Client Secret exists: {bool(os.getenv('GOOGLE_CLIENT_SECRET'))}")
        
        # Get the redirect URI - this should be the callback endpoint
        redirect_uri = request.args.get('redirect_uri') or f"{request.url_root}api/auth/google/callback"
        print(f"Redirect URI: {redirect_uri}")
        
        authorization_url, state = google_oauth_service.create_authorization_url(redirect_uri)
        
        # Store state in memory for security (simple approach)
        oauth_states[state] = {
            'timestamp': time.time(),
            'redirect_uri': redirect_uri
        }
        print(f"Stored state in memory: {state}")
        
        return jsonify({
            "authorization_url": authorization_url,
            "state": state
        })
        
    except Exception as e:
        print(f"Error in google_login: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/google/callback', methods=['GET'])
def google_callback():
    """Handle Google OAuth callback"""
    try:
        code = request.args.get('code')
        state = request.args.get('state')
        error = request.args.get('error')
        
        if error:
            return jsonify({"error": f"OAuth error: {error}"}), 400
        
        if not code or not state:
            return jsonify({"error": "Missing authorization code or state"}), 400
        
        # Verify state for security
        global oauth_states
        if state not in oauth_states:
            return jsonify({"error": "Invalid state parameter"}), 400
        
        # Clean up old states (simple cleanup)
        current_time = time.time()
        oauth_states = {k: v for k, v in oauth_states.items() if current_time - v['timestamp'] < 600}  # 10 min expiry
        
        # Get redirect URI
        redirect_uri = f"{request.url_root}api/auth/google/callback"
        
        # Exchange code for tokens
        token_data = google_oauth_service.exchange_code_for_tokens(code, redirect_uri, state)
        user_info = token_data['user_info']
        
        # Get or create user
        user = google_oauth_service.get_or_create_user(user_info)
        
        # Create JWT tokens
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        
        # Clear stored state
        oauth_states.pop(state, None)
        
        # Redirect back to VS Code with tokens
        vscode_redirect = f"vscode://texgpt.texgpt/auth?access_token={access_token}&refresh_token={refresh_token}&user_email={user.email}&user_first_name={user.first_name}&user_last_name={user.last_name}&user_id={user.id}"
        
        return redirect(vscode_redirect)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/google/verify', methods=['POST'])
def google_verify():
    """Verify Google ID token directly (for extension use)"""
    try:
        data = request.get_json()
        id_token = data.get('id_token')
        
        if not id_token:
            return jsonify({"error": "ID token required"}), 400
        
        # Verify the ID token
        user_info = google_oauth_service.verify_id_token(id_token)
        
        if not user_info:
            return jsonify({"error": "Invalid ID token"}), 401
        
        # Get or create user
        user = google_oauth_service.get_or_create_user(user_info)
        
        # Create JWT tokens
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        
        return jsonify({
            "message": "Google authentication successful",
            "user": user.to_dict(),
            "access_token": access_token,
            "refresh_token": refresh_token
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

