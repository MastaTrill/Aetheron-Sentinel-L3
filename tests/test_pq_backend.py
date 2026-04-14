import unittest
from unittest.mock import patch

from aetheron_sentinel_l3.pq_backend import MockDilithiumBackend, RealDilithiumBackend


class TestPQBackend(unittest.TestCase):
    def test_mock_backend_roundtrip(self) -> None:
        backend = MockDilithiumBackend()
        payload = "bridge:pause"
        signature = backend.sign(payload)

        self.assertTrue(signature.startswith("pqext:"))
        self.assertTrue(backend.verify(payload, signature))
        self.assertFalse(backend.verify("bridge:resume", signature))

    def test_real_backend_requires_optional_dependency(self) -> None:
        with patch("importlib.util.find_spec", return_value=None):
            with self.assertRaises(ModuleNotFoundError) as ctx:
                RealDilithiumBackend()

        self.assertIn("dilithium_py", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
