# PostgreSQL Setup Guide

This guide explains how to migrate from SQLite to PostgreSQL for production scaling.

## When to Switch to PostgreSQL?

Consider switching when:
- You have **>50,000 chat messages** AND heavy concurrent writes
- Running **multiple RAG server instances** (PostgreSQL handles concurrent writes better)
- Need **complex analytics** (PostgreSQL has better JSON querying)
- Need **full-text search** at scale (PostgreSQL FTS is more powerful)

## Prerequisites

- PostgreSQL 13+ installed
- psycopg2 Python package

## Installation

### macOS (Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Docker
```bash
docker run --name rag-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=rag_db \
  -p 5432:5432 \
  -v rag_data:/var/lib/postgresql/data \
  -d postgres:15
```

## Setup Steps

### 1. Install Python PostgreSQL Driver

```bash
cd rag
source venv/bin/activate
pip install psycopg2-binary
```

Update `requirements.txt`:
```bash
echo "psycopg2-binary==2.9.9" >> requirements.txt
```

### 2. Create Database and User

```bash
# Connect to PostgreSQL
psql postgres

# In PostgreSQL shell:
CREATE DATABASE rag_db;
CREATE USER rag_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE rag_db TO rag_user;

# PostgreSQL 15+ requires additional grant
\c rag_db
GRANT ALL ON SCHEMA public TO rag_user;

\q
```

### 3. Update Configuration

Update `rag/.env`:
```bash
# Change from SQLite:
# DB_URL=sqlite:///documents.db

# To PostgreSQL:
DB_URL=postgresql://rag_user:your_secure_password_here@localhost:5432/rag_db
```

### 4. Update Alembic Configuration

Edit `alembic.ini`:
```ini
# Change:
sqlalchemy.url = sqlite:///documents.db

# To:
sqlalchemy.url = postgresql://rag_user:your_secure_password_here@localhost:5432/rag_db
```

Or use environment variable:
```ini
# In alembic.ini, comment out sqlalchemy.url
# sqlalchemy.url =

# In alembic/env.py, add before run_migrations:
from config.settings import Settings
config.set_main_option('sqlalchemy.url', Settings().DB_URL)
```

### 5. Migrate Data from SQLite to PostgreSQL

#### Option A: Fresh Start (Recommended for Development)
```bash
# Run migrations on PostgreSQL
cd rag
source venv/bin/activate
python scripts/db_migrate.py upgrade
```

#### Option B: Migrate Existing Data
```bash
# Install pgloader
brew install pgloader  # macOS
# OR
sudo apt install pgloader  # Ubuntu

# Create migration script
cat > migrate.load << 'EOF'
LOAD DATABASE
  FROM sqlite://documents.db
  INTO postgresql://rag_user:your_secure_password_here@localhost:5432/rag_db

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512 MB';
EOF

# Run migration
pgloader migrate.load
```

### 6. Update Application Code

The `config/database.py` module automatically detects PostgreSQL vs SQLite.

Update `src/api/chat_routes.py` and `src/api/document_routes.py`:

```python
# Replace manual engine creation with:
from config.database import get_db_session

def get_db():
    return get_db_session()
```

### 7. Test the Migration

```bash
# Start the server
python app.py

# Test endpoints
curl http://localhost:5001/health
curl http://localhost:5001/api/chat/sessions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Performance Tuning

### PostgreSQL Configuration

Edit `/var/lib/postgresql/data/postgresql.conf` (or via `ALTER SYSTEM`):

```sql
-- For systems with 4GB+ RAM
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '10MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';

-- Restart PostgreSQL
-- macOS: brew services restart postgresql@15
-- Linux: sudo systemctl restart postgresql
```

### Additional Indexes for PostgreSQL

PostgreSQL-specific optimizations (already in models):
```sql
-- Full-text search on chat messages
CREATE INDEX idx_chat_messages_content_fts
  ON chat_messages USING gin(to_tsvector('english', content));

-- Composite index for common queries
CREATE INDEX idx_chat_sessions_user_activity
  ON chat_sessions(user_id, last_activity DESC)
  WHERE deleted_at IS NULL;
```

## Monitoring

### Check Database Size
```sql
SELECT
  pg_size_pretty(pg_database_size('rag_db')) as db_size,
  pg_size_pretty(pg_total_relation_size('chat_messages')) as messages_size,
  pg_size_pretty(pg_total_relation_size('chat_sessions')) as sessions_size;
```

### Check Active Connections
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'rag_db';
```

### View Slow Queries
```sql
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Backup and Restore

### Backup
```bash
# Full database backup
pg_dump -U rag_user -h localhost rag_db > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -U rag_user -h localhost rag_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Custom format (faster restore)
pg_dump -U rag_user -h localhost -Fc rag_db > backup_$(date +%Y%m%d).dump
```

### Restore
```bash
# From SQL file
psql -U rag_user -h localhost rag_db < backup_20251026.sql

# From compressed
gunzip -c backup_20251026.sql.gz | psql -U rag_user -h localhost rag_db

# From custom format
pg_restore -U rag_user -h localhost -d rag_db backup_20251026.dump
```

## Production Deployment

### Using Environment Variables
```bash
# In production, use environment variable for security
export DB_URL="postgresql://rag_user:password@db-host:5432/rag_db"
python app.py
```

### Docker Compose
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: rag_db
      POSTGRES_USER: rag_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  rag-server:
    build: .
    environment:
      DB_URL: postgresql://rag_user:${DB_PASSWORD}@postgres:5432/rag_db
    depends_on:
      - postgres
    ports:
      - "5001:5001"

volumes:
  postgres_data:
```

## Troubleshooting

### Connection Issues
```bash
# Test connection
psql "postgresql://rag_user:password@localhost:5432/rag_db"

# Check PostgreSQL is running
pg_isready -h localhost -p 5432
```

### Permission Issues
```sql
-- Grant all permissions
GRANT ALL PRIVILEGES ON DATABASE rag_db TO rag_user;
GRANT ALL ON SCHEMA public TO rag_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO rag_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO rag_user;
```

### Migration Issues
```bash
# Reset migrations (DANGER: drops all data)
alembic downgrade base
alembic upgrade head

# Or just recreate tables
python -c "from src.models.document import Base; from config.database import get_database_config; Base.metadata.create_all(get_database_config().engine)"
```

## Rollback to SQLite

If you need to rollback:

1. Backup PostgreSQL data
2. Update `.env`: `DB_URL=sqlite:///documents.db`
3. Update `alembic.ini`: `sqlalchemy.url = sqlite:///documents.db`
4. Restore from SQLite backup if needed
5. Restart server

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [SQLAlchemy PostgreSQL Dialects](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
