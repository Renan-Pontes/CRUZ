from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction
from rest_framework import exceptions, permissions, status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .authentication import SessionTokenAuthentication
from .security import ensure_secure_transport, issue_session, revoke_token
from .serializers import (
    AuthSessionResponseSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
)

User = get_user_model()
ALLOWED_EMAIL_DOMAIN = "@cs.cruzeirodosul.edu.br"
SESSION_TTL_HOURS = 24


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _assert_allowed_domain(email: str):
    if not email.lower().endswith(ALLOWED_EMAIL_DOMAIN):
        raise exceptions.ValidationError(
            f"Cadastros apenas com e-mail institucional {ALLOWED_EMAIL_DOMAIN}"
        )


def _build_username(base: str) -> str:
    candidate = base[:150] or "user"
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f"{base[:140]}{suffix}"[:150]
        suffix += 1
    return candidate


def _client_ip(request):
    return request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get(
        "REMOTE_ADDR"
    )


@extend_schema(tags=["health"])
@api_view(["GET"])
def api_health(request):
    """Lightweight health endpoint to verify the API is up."""
    return Response({"status": "ok"})


@extend_schema(
    tags=["auth"],
    description=(
        "Registro de usuário restrito ao domínio @cs.cruzeirodosul.edu.br. "
        "Requer transporte seguro (HTTPS/TLS). Retorna um token de sessão opaco."
    ),
    request=RegisterSerializer,
    responses={201: AuthSessionResponseSerializer},
)
@api_view(["POST"])
def register(request):
    ensure_secure_transport(request)
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = _normalize_email(serializer.validated_data["email"])
    _assert_allowed_domain(email)

    if User.objects.filter(email__iexact=email).exists():
        raise exceptions.ValidationError("E-mail já cadastrado.")

    base_username = (
        serializer.validated_data.get("username") or email.split("@")[0] or "user"
    ).strip()
    username = _build_username(base_username or "user")

    with transaction.atomic():
        user = User.objects.create_user(
            username=username,
            email=email,
            password=serializer.validated_data["password"],
        )

    token, expires_at = issue_session(
        user=user,
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        ip_address=_client_ip(request),
        ttl_hours=SESSION_TTL_HOURS,
    )
    return Response(
        AuthSessionResponseSerializer(
            {
                "token": token,
                "expires_at": expires_at,
                "user_id": user.id,
                "email": user.email,
            }
        ).data,
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    tags=["auth"],
    description=(
        "Login via e-mail institucional e senha. Retorna um token opaco para usar em "
        "Authorization: Session <token> ou X-Session-Token. Transporte deve ser HTTPS/TLS."
    ),
    request=LoginSerializer,
    responses={200: AuthSessionResponseSerializer},
)
@api_view(["POST"])
def login_view(request):
    ensure_secure_transport(request)
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = _normalize_email(serializer.validated_data["email"])
    password = serializer.validated_data["password"]

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        raise exceptions.AuthenticationFailed("Credenciais inválidas.")

    if not user.is_active:
        raise exceptions.PermissionDenied("Conta desativada.")

    user = authenticate(request, username=user.username, password=password)
    if user is None:
        raise exceptions.AuthenticationFailed("Credenciais inválidas.")

    login(request, user)
    token, expires_at = issue_session(
        user=user,
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        ip_address=_client_ip(request),
        ttl_hours=SESSION_TTL_HOURS,
    )
    return Response(
        AuthSessionResponseSerializer(
            {
                "token": token,
                "expires_at": expires_at,
                "user_id": user.id,
                "email": user.email,
            }
        ).data
    )


@extend_schema(
    tags=["auth"],
    description=(
        "Invalidar o token de sessão atual (ou todos com all_devices=true). "
        "Autenticação pelo header Authorization: Session <token>."
    ),
    request=LogoutSerializer,
    responses={200: {"type": "object", "properties": {"detail": {"type": "string"}}}},
)
@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    ensure_secure_transport(request)
    serializer = LogoutSerializer(data=request.data or {})
    serializer.is_valid(raise_exception=True)

    all_devices = serializer.validated_data.get("all_devices", False)
    session = request.auth
    if not session:
        raise exceptions.NotAuthenticated("Token de sessão ausente.")

    if all_devices:
        request.user.auth_sessions.filter(revoked=False).update(revoked=True)
    else:
        session.revoked = True
        session.save(update_fields=["revoked"])

    logout(request)
    return Response({"detail": "Sessão encerrada."})
