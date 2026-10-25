"""
FlowGrid: AI-Powered Distribution Intelligence & Inventory Optimization Engine
Root entrypoint shim delegating to scripts/pipeline_runner.py.
"""

import sys
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.pipeline_runner import run_full_pipeline

if __name__ == "__main__":
    run_full_pipeline()
