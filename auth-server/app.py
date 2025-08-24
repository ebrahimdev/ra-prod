from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from src.api.auth_routes import auth_bp
from src.models.database import db, migrate
from src.utils.logger import setup_logger
from config.settings import Settings

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    settings = Settings()
    
    app.config['SQLALCHEMY_DATABASE_URI'] = settings.DATABASE_URL
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = settings.JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = settings.JWT_ACCESS_TOKEN_EXPIRES
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = settings.JWT_REFRESH_TOKEN_EXPIRES
    
    db.init_app(app)
    migrate.init_app(app, db)
    jwt = JWTManager(app)
    
    @app.route('/health', methods=['GET'])
    def health():
        return {"status": "healthy", "service": "auth-server"}
    
    app.register_blueprint(auth_bp)
    
    with app.app_context():
        # Ensure database directory exists
        import os
        db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        
        # Create database tables
        db.create_all()
    
    logger = setup_logger(__name__)
    
    return app

if __name__ == '__main__':
    app = create_app()
    settings = Settings()
    app.run(host=settings.HOST, port=settings.PORT, debug=settings.DEBUG)