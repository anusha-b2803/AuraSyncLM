import os
import sys
from main import organize_files, get_all_drives

# Add backend to path if needed
sys.path.append(os.getcwd())

drives = get_all_drives()
print(f"Drives found: {drives}")

def progress(msg, done, total):
    print(f"Progress: {msg} ({done}/{total})")

result = organize_files(drives, user_id="debug_user", force=True, progress_callback=progress)
print(f"Result: {result}")
