import pytest
from rest_framework.test import APIClient

from inventory.models import HandledFlag, Vendor


def test_requires_login(api_client):
    assert api_client.get("/api/dashboard").status_code in (401, 403)


def test_login_logout_me(user):
    client = APIClient()
    assert client.get("/api/auth/me").json()["authenticated"] is False
    bad = client.post(
        "/api/auth/login", {"username": "testuser", "password": "nope"}, format="json"
    )
    assert bad.status_code == 400
    ok = client.post(
        "/api/auth/login", {"username": "testuser", "password": "testpass123"}, format="json"
    )
    assert ok.status_code == 200
    me = client.get("/api/auth/me").json()
    assert me == {"authenticated": True, "username": "testuser"}
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").json()["authenticated"] is False


def test_csrf_endpoint_sets_cookie(api_client):
    response = api_client.get("/api/auth/csrf")
    assert response.status_code == 200
    assert "csrftoken" in response.cookies


def test_demo_user_exists_after_migration(db):
    from django.contrib.auth import get_user_model

    assert get_user_model().objects.filter(username="dana").exists()


def test_dashboard_shape(auth_client, loaded):
    body = auth_client.get("/api/dashboard").json()
    assert body["as_of"] == "2026-11-16"
    assert {
        "order_now",
        "watch",
        "handled",
        "ok_count",
        "stuck",
        "stuck_total_value",
        "data_notes",
    } <= set(body)


def test_item_detail_and_404(auth_client, loaded):
    assert auth_client.get("/api/items/SHR-1620").json()["on_hold"] == 80
    assert auth_client.get("/api/items/NOPE-1").status_code == 404
    assert auth_client.get("/api/items/FR-COD").status_code == 404  # fresh is out of scope


def test_handled_roundtrip_persists(auth_client, loaded):
    r = auth_client.post("/api/items/SHR-1620/handled", {"note": "phoned Tue"}, format="json")
    assert r.status_code == 201
    handled = auth_client.get("/api/dashboard").json()["handled"]
    assert [row["code"] for row in handled] == ["SHR-1620"]
    again = auth_client.get("/api/dashboard").json()["handled"]  # a fresh request still sees it
    assert [row["code"] for row in again] == ["SHR-1620"]
    assert auth_client.delete("/api/items/SHR-1620/handled").status_code == 204
    body = auth_client.get("/api/dashboard").json()
    assert body["handled"] == []
    assert "SHR-1620" in [row["code"] for row in body["order_now"]]


def test_handled_replaces_previous_flag(auth_client, loaded):
    auth_client.post("/api/items/SHR-1620/handled", {"note": "one"}, format="json")
    auth_client.post("/api/items/SHR-1620/handled", {"note": "two"}, format="json")
    assert HandledFlag.objects.filter(item_id="SHR-1620", active=True).count() == 1


def test_handled_validates_input(auth_client, loaded):
    assert (
        auth_client.post("/api/items/SHR-1620/handled", {"qty": -5}, format="json").status_code
        == 400
    )
    assert (
        auth_client.post(
            "/api/items/SHR-1620/handled", {"expected_date": "soon"}, format="json"
        ).status_code
        == 400
    )
    assert auth_client.post("/api/items/NOPE-1/handled", {}, format="json").status_code == 404


def test_vendors_list_only_suppliers(auth_client, loaded):
    codes = {v["code"] for v in auth_client.get("/api/vendors").json()}
    assert codes == {"BXE", "AFS", "MNP", "ASP", "DLC"}


def test_patch_vendor_changes_verdict(auth_client, loaded):
    def order_by():
        rows = auth_client.get("/api/dashboard").json()
        return next(r for g in ("order_now", "watch") for r in rows[g] if r["code"] == "SHR-1620")[
            "order_by_date"
        ]

    before = order_by()
    assert (
        auth_client.patch("/api/vendors/BXE", {"lead_time_days": 28}, format="json").status_code
        == 200
    )
    assert Vendor.objects.get(code="BXE").lead_time_days == 28
    assert order_by() != before


@pytest.mark.parametrize(
    "payload", [{"lead_time_days": -1}, {"safety_days": 999}, {"lead_time_days": "x"}]
)
def test_patch_vendor_validates(auth_client, loaded, payload):
    assert auth_client.patch("/api/vendors/BXE", payload, format="json").status_code == 400


def test_patch_unknown_vendor_404(auth_client, loaded):
    assert (
        auth_client.patch("/api/vendors/NOPE", {"lead_time_days": 5}, format="json").status_code
        == 404
    )
