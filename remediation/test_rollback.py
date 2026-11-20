import unittest
from docker_rollback import rollback_container

class TestContainerRollback(unittest.TestCase):
    def test_simulated_rollback(self):
        res = rollback_container("payment", stable_tag="v2.0")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["restored_tag"], "v2.0")
        self.assertIn("elapsed_seconds", res)

if __name__ == "__main__":
    unittest.main()
