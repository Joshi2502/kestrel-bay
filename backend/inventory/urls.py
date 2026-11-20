from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf", views.csrf),
    path("auth/login", views.login_view),
    path("auth/logout", views.logout_view),
    path("auth/me", views.me),
    path("dashboard", views.dashboard),
    path("items/<str:code>", views.item_detail),
    path("items/<str:code>/handled", views.handled),
    path("vendors", views.vendors),
    path("vendors/<str:code>", views.vendor_detail),
]
