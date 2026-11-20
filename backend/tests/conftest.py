from datetime import date
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="testuser", password="testpass123")


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


AS_OF = date(2026, 11, 16)
DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    """Load the real BlueTide CSVs once per test session; each test still rolls back."""
    from inventory.loader import load_all

    with django_db_blocker.unblock():
        pytest.load_report = load_all(DATA_DIR, AS_OF)


@pytest.fixture
def loaded(db):
    return pytest.load_report
