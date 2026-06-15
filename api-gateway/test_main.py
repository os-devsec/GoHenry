import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import main


class GatewayFallbackTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.frontend_dir = Path(self.temp_dir.name)
        (self.frontend_dir / "index.html").write_text(
            "<html>frontend</html>",
            encoding="utf-8",
        )
        self.frontend_patch = patch.object(main, "FRONTEND_DIR", self.frontend_dir)
        self.frontend_patch.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        self.frontend_patch.stop()
        self.temp_dir.cleanup()

    def test_unknown_api_route_returns_json_404(self):
        response = self.client.get("/api/v1/not-real")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Ruta de API no encontrada"})

    def test_unknown_frontend_route_returns_spa_entrypoint(self):
        response = self.client.get("/restaurant/7")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, "<html>frontend</html>")


if __name__ == "__main__":
    unittest.main()
