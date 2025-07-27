from flask import Flask, jsonify
from flask_cors import CORS
from src.api.routes import api_bp
from src.api.document_routes import doc_bp
from src.api.chat_routes import chat_bp
from src.utils.logger import setup_logger
from config.settings import Settings

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({"status": "healthy", "service": "rag-server"})
    
    app.register_blueprint(api_bp)
    app.register_blueprint(doc_bp)
    app.register_blueprint(chat_bp)
    
    logger = setup_logger(__name__)
    
    return app

if __name__ == '__main__':
    app = create_app()
    settings = Settings()
    app.run(host=settings.HOST, port=settings.PORT, debug=settings.DEBUG)