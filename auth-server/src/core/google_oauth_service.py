import os
import json
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
from flask import url_for, current_app
from typing import Optional, Dict, Any
from ..models.user import User
from ..models.database import db


class GoogleOAuthService:
    def __init__(self):
        self.client_secrets = {
            "web": {
                "client_id": os.getenv('GOOGLE_CLIENT_ID'),
                "client_secret": os.getenv('GOOGLE_CLIENT_SECRET'),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
            }
        }
        
        # OAuth scopes - use full URLs for consistency
        self.scopes = [
            'openid',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ]
    
    def create_authorization_url(self, redirect_uri: str) -> str:
        """Create Google OAuth authorization URL"""
        try:
            flow = Flow.from_client_config(
                self.client_secrets,
                scopes=self.scopes
            )
            flow.redirect_uri = redirect_uri
            
            authorization_url, state = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true'
            )
            
            # Store state in session/cache for security
            # For now, we'll return both URL and state
            return authorization_url, state
            
        except Exception as e:
            raise Exception(f"Failed to create authorization URL: {str(e)}")
    
    def exchange_code_for_tokens(self, code: str, redirect_uri: str, state: str) -> Dict[str, Any]:
        """Exchange authorization code for tokens"""
        try:
            print(f"Creating flow with scopes: {self.scopes}")
            flow = Flow.from_client_config(
                self.client_secrets,
                scopes=self.scopes,
                state=state
            )
            flow.redirect_uri = redirect_uri
            
            print(f"Exchanging code: {code[:20]}... for tokens")
            # Fetch tokens
            flow.fetch_token(code=code)
            
            # Get user info from ID token
            credentials = flow.credentials
            print(f"Got credentials with scopes: {credentials.scopes if hasattr(credentials, 'scopes') else 'no scopes'}")
            
            id_info = id_token.verify_oauth2_token(
                credentials.id_token,
                Request(),
                self.client_secrets['web']['client_id']
            )
            
            print(f"ID token verified, user: {id_info.get('email', 'no email')}")
            
            return {
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'id_token': credentials.id_token,
                'user_info': id_info
            }
            
        except Exception as e:
            print(f"Error in exchange_code_for_tokens: {str(e)}")
            raise Exception(f"Failed to exchange code for tokens: {str(e)}")
    
    def get_or_create_user(self, user_info: Dict[str, Any]) -> User:
        """Get existing user or create new one from Google user info"""
        try:
            email = user_info.get('email')
            if not email:
                raise Exception("Email not provided by Google")
            
            # Check if user exists
            user = User.query.filter_by(email=email).first()
            
            if user:
                # Update user info if needed
                user.first_name = user_info.get('given_name', user.first_name)
                user.last_name = user_info.get('family_name', user.last_name)
                user.google_id = user_info.get('sub')
                db.session.commit()
                return user
            
            # Create new user
            user = User(
                email=email,
                first_name=user_info.get('given_name', ''),
                last_name=user_info.get('family_name', ''),
                google_id=user_info.get('sub'),
                # No password for OAuth users
                password_hash=None
            )
            
            db.session.add(user)
            db.session.commit()
            
            return user
            
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to create/update user: {str(e)}")
    
    def verify_id_token(self, id_token_string: str) -> Optional[Dict[str, Any]]:
        """Verify Google ID token"""
        try:
            id_info = id_token.verify_oauth2_token(
                id_token_string,
                Request(),
                self.client_secrets['web']['client_id']
            )
            return id_info
        except Exception as e:
            print(f"Token verification failed: {str(e)}")
            return None