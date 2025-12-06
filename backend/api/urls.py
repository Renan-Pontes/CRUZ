from django.urls import path

from .views import api_health, current_session, login_view, logout_view, me, register

urlpatterns = [
    path("health/", api_health, name="api-health"),
    path("auth/register/", register, name="auth-register"),
    path("auth/login/", login_view, name="auth-login"),
    path("auth/logout/", logout_view, name="auth-logout"),
    path("auth/me/", me, name="auth-me"),
    path("auth/session/", current_session, name="auth-session"),
]
