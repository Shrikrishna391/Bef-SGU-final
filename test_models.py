"""
FlowGrid: Automated Test Suite shim delegating to tests/test_models.py.
"""

import sys
import unittest
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from tests.test_models import TestFlowGridModels

if __name__ == "__main__":
    unittest.main()
