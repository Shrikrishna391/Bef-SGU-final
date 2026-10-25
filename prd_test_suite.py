"""
FlowGrid: Acceptance Test Suite shim delegating to scripts/prd_test_suite.py.
"""

from scripts.prd_test_suite import PRDTestSuite, safe_json_default

__all__ = ["PRDTestSuite", "safe_json_default"]

if __name__ == "__main__":
    suite = PRDTestSuite()
    suite.run_all()
