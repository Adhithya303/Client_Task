"""
Command-line administrative utility for provisioning admin users.
No public endpoint allows creating admins. Only server operators with CLI access can provision admins.

Usage:
    python -m app.cli create-admin --username <username> [--password <password>]
"""
import argparse
import getpass
import sys

from app.auth import hash_password
from app.database import (
    close_database,
    create_admin_user,
    get_admin_user,
    init_database,
    is_database_initialized,
)


def cmd_create_admin(username: str, password: str | None = None) -> None:
    username = username.strip()
    if len(username) < 3:
        print("Error: Username must be at least 3 characters long.", file=sys.stderr)
        sys.exit(1)

    if not password:
        password = getpass.getpass(f"Enter password for admin '{username}': ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    should_close = False
    if not is_database_initialized():
        init_database()
        should_close = True

    try:
        existing = get_admin_user(username)
        if existing:
            print(f"Error: Admin user '{username}' already exists.", file=sys.stderr)
            raise ValueError(f"Admin user '{username}' already exists.")

        hashed = hash_password(password)
        create_admin_user(username, hashed)
        print(f"Success: Admin user '{username}' successfully provisioned.")
    finally:
        if should_close:
            close_database()


def main() -> None:
    parser = argparse.ArgumentParser(description="FCM Push Notification Admin CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create-admin", help="Provision a new admin user")
    create_parser.add_argument("--username", "-u", required=True, help="Admin username")
    create_parser.add_argument("--password", "-p", default=None, help="Admin password (prompts if omitted)")

    args = parser.parse_args()

    if args.command == "create-admin":
        cmd_create_admin(args.username, args.password)


if __name__ == "__main__":
    main()
