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
    
    # Session configuration for OAuth state management
    app.config['SECRET_KEY'] = settings.JWT_SECRET_KEY  # Use same secret for sessions
    
    db.init_app(app)
    migrate.init_app(app, db)
    jwt = JWTManager(app)
    
    @app.route('/health', methods=['GET'])
    def health():
        return {"status": "healthy", "service": "auth-server"}
    
    app.register_blueprint(auth_bp)
    
    with app.app_context():
        try:
            # Ensure database directory exists
            import os
            db_uri = app.config['SQLALCHEMY_DATABASE_URI']
            print(f"Database URI: {db_uri}")
            
            db_path = db_uri.replace('sqlite:///', '')
            print(f"Database path: {db_path}")
            
            # Get absolute path
            if not os.path.isabs(db_path):
                db_path = os.path.join(os.getcwd(), db_path)
            print(f"Absolute database path: {db_path}")
            
            db_dir = os.path.dirname(db_path)
            print(f"Database directory: {db_dir}")
            print(f"Current working directory: {os.getcwd()}")
            
            if db_dir and not os.path.exists(db_dir):
                print(f"Creating directory: {db_dir}")
                os.makedirs(db_dir, mode=0o755, exist_ok=True)
            
            # Ensure the database file can be created
            if not os.path.exists(db_path):
                print(f"Creating database file: {db_path}")
                with open(db_path, 'a'):
                    pass
                os.chmod(db_path, 0o664)
            
            print(f"Database file permissions: {oct(os.stat(db_path).st_mode)}")
            print(f"Database file size: {os.path.getsize(db_path)} bytes")
            
            # Create database tables
            print("Creating database tables...")
            db.create_all()
            print("✅ Database initialization successful")
            
        except Exception as e:
            print(f"❌ Database initialization failed: {e}")
            print(f"Working directory: {os.getcwd()}")
            print(f"Directory contents: {os.listdir('.')}")
            if os.path.exists('instance'):
                print(f"Instance directory contents: {os.listdir('instance')}")
            
            # Try to continue without database initialization
            # The database will be created on first actual use
            print("⚠️ Continuing without database initialization - database will be created on first use")
            import traceback
            traceback.print_exc()
    
    logger = setup_logger(__name__)
    
    return app

if __name__ == '__main__':
    app = create_app()
    settings = Settings()
    app.run(host=settings.HOST, port=settings.PORT, debug=settings.DEBUG)