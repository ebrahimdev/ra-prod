import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 8000))
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    
    # Auth Server
    AUTH_SERVER_URL = os.getenv('AUTH_SERVER_URL', 'http://localhost:8001')