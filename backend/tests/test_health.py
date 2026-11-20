import datetime

from django.conf import settings
from django.test import Client


def test_health_check():
    response = Client().get("/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_api_schema():
    assert Client().get("/api/schema/").status_code == 200


def test_as_of_date_is_fixed_project_today():
    assert datetime.date(2026, 11, 16) == settings.AS_OF_DATE
