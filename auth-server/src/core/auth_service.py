from ..models.user import User
from ..models.database import db

class AuthService:
    def create_user(self, email: str, password: str, first_name: str, last_name: str) -> User:
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        return user
    
    def authenticate_user(self, email: str, password: str) -> User:
        user = User.query.filter_by(email=email, is_active=True).first()
        
        if user and user.check_password(password):
            return user
        
        return None