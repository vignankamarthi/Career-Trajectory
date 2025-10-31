#!/usr/bin/env python3
"""
Logging Toggle Script

Usage:
    python toggle_logs.py --enable   # Enable logging (restore from backups)
    python toggle_logs.py --disable  # Disable logging (comment out Logger calls)
    python toggle_logs.py --status   # Check current logging status

Purpose: Toggle logging statements to measure performance impact.
Logging adds latency - this script allows A/B testing with/without logs.
"""

import argparse
import re
import os
import shutil
from pathlib import Path
from typing import List, Tuple

# Agent files to process
AGENT_FILES = [
    '../src/agents/configuration-agent.ts',
    '../src/agents/conversational-assistant.ts',
    '../src/agents/internal-agent.ts',
    '../src/services/anthropic.ts',
    '../src/services/parallel.ts',
]

BACKUP_SUFFIX = '.backup'


def get_script_dir() -> Path:
    """Get the directory where this script is located."""
    return Path(__file__).parent.absolute()


def get_file_paths() -> List[Path]:
    """Convert relative paths to absolute paths."""
    script_dir = get_script_dir()
    return [script_dir / file_path for file_path in AGENT_FILES]


def backup_files() -> List[Path]:
    """Create backups of all agent files."""
    backed_up = []
    for file_path in get_file_paths():
        if not file_path.exists():
            print(f"  Warning: File not found: {file_path}")
            continue

        backup_path = Path(str(file_path) + BACKUP_SUFFIX)
        shutil.copy2(file_path, backup_path)
        backed_up.append(backup_path)
        print(f" Backed up: {file_path.name}")

    return backed_up


def restore_from_backups() -> int:
    """Restore all files from backups."""
    restored = 0
    for file_path in get_file_paths():
        backup_path = Path(str(file_path) + BACKUP_SUFFIX)

        if not backup_path.exists():
            print(f"  No backup found for: {file_path.name}")
            continue

        shutil.copy2(backup_path, file_path)
        restored += 1
        print(f" Restored: {file_path.name}")

    return restored


def disable_logging() -> Tuple[int, int]:
    """Comment out all Logger calls in agent files."""
    total_files = 0
    total_lines = 0

    # Pattern to match Logger calls (entry, exit, info, warn, error, debug)
    logger_pattern = re.compile(r'^(\s*)(Logger\.(entry|exit|info|warn|error|debug)\(.+\);?)$', re.MULTILINE)

    for file_path in get_file_paths():
        if not file_path.exists():
            continue

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Count matches before replacement
        matches_before = len(logger_pattern.findall(content))

        # Comment out Logger calls
        modified_content = logger_pattern.sub(r'\1// \2', content)

        # Count changes
        if content != modified_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(modified_content)

            total_files += 1
            total_lines += matches_before
            print(f" Disabled {matches_before} log statements in: {file_path.name}")

    return total_files, total_lines


def enable_logging() -> Tuple[int, int]:
    """Restore logging by restoring from backups."""
    print(" Enabling logging (restoring from backups)...")

    restored = restore_from_backups()

    # Count total Logger calls in restored files
    total_lines = 0
    logger_pattern = re.compile(r'Logger\.(entry|exit|info|warn|error|debug)\(')

    for file_path in get_file_paths():
        if not file_path.exists():
            continue

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        total_lines += len(logger_pattern.findall(content))

    return restored, total_lines


def check_status() -> None:
    """Check current logging status."""
    enabled_pattern = re.compile(r'^\s*Logger\.(entry|exit|info|warn|error|debug)\(', re.MULTILINE)
    disabled_pattern = re.compile(r'^\s*// Logger\.(entry|exit|info|warn|error|debug)\(', re.MULTILINE)

    print("\n Logging Status:\n")

    total_enabled = 0
    total_disabled = 0

    for file_path in get_file_paths():
        if not file_path.exists():
            print(f"  File not found: {file_path.name}")
            continue

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        enabled = len(enabled_pattern.findall(content))
        disabled = len(disabled_pattern.findall(content))

        total_enabled += enabled
        total_disabled += disabled

        status = " ENABLED" if enabled > disabled else " DISABLED" if disabled > 0 else " NO LOGS"
        print(f"{status}  {file_path.name}")
        print(f"         Enabled: {enabled}, Disabled: {disabled}")

    print(f"\n Total: {total_enabled} enabled, {total_disabled} disabled")

    if total_enabled > 0 and total_disabled == 0:
        print("\n Logging is ENABLED")
    elif total_disabled > 0:
        print("\n Logging is DISABLED")
    else:
        print("\n No logging statements found")


def main():
    parser = argparse.ArgumentParser(
        description="Toggle logging in agent files for performance testing"
    )
    parser.add_argument(
        '--enable',
        action='store_true',
        help='Enable logging (restore from backups)'
    )
    parser.add_argument(
        '--disable',
        action='store_true',
        help='Disable logging (comment out Logger calls)'
    )
    parser.add_argument(
        '--status',
        action='store_true',
        help='Check current logging status'
    )

    args = parser.parse_args()

    # Check that script is run from backend/scripts directory or backend directory
    script_dir = get_script_dir()
    if not (script_dir.name == 'scripts' or script_dir.name == 'backend'):
        print("  Warning: Script should be run from backend/scripts/ or backend/ directory")

    if args.status:
        check_status()
        return

    if args.enable and args.disable:
        print(" Error: Cannot use --enable and --disable together")
        return

    if args.enable:
        print(" Enabling logging...\n")
        files, lines = enable_logging()
        print(f"\n Enabled logging in {files} files ({lines} statements)")
        print(" Performance: Logging is now active (may reduce speed)")

    elif args.disable:
        print(" Disabling logging...\n")
        # Create backups first
        print(" Creating backups...")
        backup_files()
        print()

        # Disable logging
        files, lines = disable_logging()
        print(f"\n Disabled logging in {files} files ({lines} statements)")
        print(" Performance: Logging is now disabled (should be faster)")
        print(" Backups created - use --enable to restore")

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
