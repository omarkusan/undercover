import pytest
from fastapi.testclient import TestClient

from agent import main
from backend import db
from backend.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    """The backend with its own freshly seeded database, which the agent calls."""
    monkeypatch.setenv("UNDERCOVER_DB", str(tmp_path / "undercover.db"))
    db.setup()
    monkeypatch.setattr(main, "backend", lambda: TestClient(app))
    return TestClient(app)
