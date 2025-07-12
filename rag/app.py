from flask import Flask
from flask_cors import CORS
from src.api.routes import api_bp
from src.utils.logger import setup_logger
from config.settings import Settings

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    app.register_blueprint(api_bp)
    
    logger = setup_logger(__name__)
    logger.info("RAG server initialized")
    
    return app

if __name__ == '__main__':
    app = create_app()
    settings = Settings()
    app.run(host=settings.HOST, port=settings.PORT, debug=settings.DEBUG)