#!/usr/bin/env python3
"""
Database migration and management script.

Usage:
    python scripts/db_migrate.py upgrade    # Upgrade to latest migration
    python scripts/db_migrate.py downgrade  # Downgrade one migration
    python scripts/db_migrate.py current    # Show current migration
    python scripts/db_migrate.py history    # Show migration history
    python scripts/db_migrate.py backup     # Backup database (SQLite only)
    python scripts/db_migrate.py restore    # Restore from backup (SQLite only)
"""
import os
import sys
import shutil
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from alembic.config import Config
from alembic import command


def get_alembic_config():
    """Get Alembic configuration."""
    # Get the project root directory
    project_root = Path(__file__).resolve().parent.parent
    alembic_ini = project_root / "alembic.ini"

    if not alembic_ini.exists():
        print(f"Error: alembic.ini not found at {alembic_ini}")
        sys.exit(1)

    config = Config(str(alembic_ini))
    return config


def upgrade():
    """Upgrade database to latest migration."""
    print("Upgrading database to latest migration...")
    config = get_alembic_config()
    command.upgrade(config, "head")
    print("✓ Database upgraded successfully!")


def downgrade():
    """Downgrade database by one migration."""
    print("Downgrading database by one migration...")
    config = get_alembic_config()
    command.downgrade(config, "-1")
    print("✓ Database downgraded successfully!")


def current():
    """Show current migration."""
    print("Current database migration:")
    config = get_alembic_config()
    command.current(config)


def history():
    """Show migration history."""
    print("Migration history:")
    config = get_alembic_config()
    command.history(config)


def backup():
    """Backup SQLite database."""
    project_root = Path(__file__).resolve().parent.parent
    db_path = project_root / "documents.db"

    if not db_path.exists():
        print(f"Error: Database not found at {db_path}")
        sys.exit(1)

    # Check if it's SQLite
    if not str(db_path).endswith('.db'):
        print("Error: Backup only supported for SQLite databases")
        sys.exit(1)

    # Create backups directory
    backup_dir = project_root / "backups"
    backup_dir.mkdir(exist_ok=True)

    # Create backup with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"documents_backup_{timestamp}.db"

    print(f"Backing up database to {backup_path}...")
    shutil.copy2(db_path, backup_path)
    print(f"✓ Database backed up successfully!")

    # Show backup info
    size_mb = backup_path.stat().st_size / (1024 * 1024)
    print(f"  Backup size: {size_mb:.2f} MB")


def restore():
    """Restore SQLite database from backup."""
    project_root = Path(__file__).resolve().parent.parent
    backup_dir = project_root / "backups"

    if not backup_dir.exists():
        print("Error: No backups directory found")
        sys.exit(1)

    # List available backups
    backups = sorted(backup_dir.glob("documents_backup_*.db"), reverse=True)

    if not backups:
        print("Error: No backups found")
        sys.exit(1)

    print("Available backups:")
    for i, backup in enumerate(backups, 1):
        size_mb = backup.stat().st_size / (1024 * 1024)
        mtime = datetime.fromtimestamp(backup.stat().st_mtime)
        print(f"  {i}. {backup.name} ({size_mb:.2f} MB, {mtime.strftime('%Y-%m-%d %H:%M:%S')})")

    # Get user selection
    try:
        selection = int(input("\nSelect backup to restore (number): "))
        if selection < 1 or selection > len(backups):
            print("Error: Invalid selection")
            sys.exit(1)
    except (ValueError, KeyboardInterrupt):
        print("\nRestore cancelled")
        sys.exit(0)

    selected_backup = backups[selection - 1]

    # Confirm
    confirm = input(f"\nThis will overwrite the current database. Continue? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Restore cancelled")
        sys.exit(0)

    # Restore
    db_path = project_root / "documents.db"
    print(f"Restoring from {selected_backup}...")

    # Backup current database first
    if db_path.exists():
        current_backup = project_root / "backups" / f"documents_before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        shutil.copy2(db_path, current_backup)
        print(f"  Current database backed up to {current_backup.name}")

    # Restore
    shutil.copy2(selected_backup, db_path)
    print("✓ Database restored successfully!")


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command_name = sys.argv[1].lower()

    commands = {
        'upgrade': upgrade,
        'downgrade': downgrade,
        'current': current,
        'history': history,
        'backup': backup,
        'restore': restore,
    }

    if command_name not in commands:
        print(f"Error: Unknown command '{command_name}'")
        print(__doc__)
        sys.exit(1)

    commands[command_name]()


if __name__ == '__main__':
    main()
