"""
Database configuration module for RAG server.
Supports both SQLite (development) and PostgreSQL (production).
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.models.document import Base

class DatabaseConfig:
    """Database configuration and session management."""

    def __init__(self, database_url=None):
        """
        Initialize database configuration.

        Args:
            database_url: Database URL (SQLite or PostgreSQL)
                         If None, uses environment variable DB_URL or defaults to SQLite
        """
        if database_url is None:
            database_url = os.getenv('DB_URL', 'sqlite:///documents.db')

        self.database_url = database_url
        self.engine = None
        self.SessionLocal = None

    def initialize(self):
        """Initialize database engine and session maker."""
        # PostgreSQL-specific settings
        if self.database_url.startswith('postgresql'):
            self.engine = create_engine(
                self.database_url,
                pool_size=10,  # Connection pool size
                max_overflow=20,  # Max connections beyond pool_size
                pool_pre_ping=True,  # Verify connections before using
                pool_recycle=3600,  # Recycle connections after 1 hour
                echo=False  # Set to True for SQL query logging
            )
        # SQLite settings
        else:
            self.engine = create_engine(
                self.database_url,
                connect_args={"check_same_thread": False},  # SQLite specific
                echo=False
            )

        # Create all tables
        Base.metadata.create_all(self.engine)

        # Create session maker
        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autocommit=False,
            autoflush=False
        )

        return self.engine

    def get_session(self):
        """Get a new database session."""
        if self.SessionLocal is None:
            raise RuntimeError("Database not initialized. Call initialize() first.")
        return self.SessionLocal()

    def close(self):
        """Close database engine."""
        if self.engine:
            self.engine.dispose()


# Singleton instance
_db_config = None

def get_database_config(database_url=None):
    """
    Get or create the database configuration singleton.

    Args:
        database_url: Database URL (only used on first call)

    Returns:
        DatabaseConfig instance
    """
    global _db_config
    if _db_config is None:
        _db_config = DatabaseConfig(database_url)
        _db_config.initialize()
    return _db_config


def get_db_session():
    """
    Get a new database session.

    Usage:
        db = get_db_session()
        try:
            # Use db
            pass
        finally:
            db.close()
    """
    config = get_database_config()
    return config.get_session()
