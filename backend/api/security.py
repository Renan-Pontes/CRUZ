import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import exceptions

from .models import AuthSession


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _generate_unique_token() -> str:
    # token_urlsafe(32) ~ 43 chars, 256 bits of entropy.
    return secrets.token_urlsafe(32)


def issue_session(user, user_agent: str = "", ip_address: str | None = None, ttl_hours: int = 24):
    """Gera um token opaco, salva o hash e retorna o token em texto puro uma única vez."""
    expires_at = timezone.now() + timedelta(hours=ttl_hours)
    for _ in range(3):  # chances ínfimas de colisão, mas tentamos novamente se acontecer.
        token = _generate_unique_token()
        token_hash = hash_token(token)
        try:
            session = AuthSession.objects.create(
                user=user,
                token_hash=token_hash,
                expires_at=expires_at,
                user_agent=user_agent[:255],
                last_ip=ip_address,
                last_seen=timezone.now(),
            )
            return token, session.expires_at
        except Exception:
            continue
    raise exceptions.APIException("Não foi possível gerar sessão segura, tente novamente.")


def revoke_token(token: str):
    token_hash = hash_token(token)
    AuthSession.objects.filter(token_hash=token_hash).update(revoked=True)


def ensure_secure_transport(request):
    """Exige HTTPS quando DEBUG=False para garantir tráfego cifrado."""
    if settings.DEBUG:
        return
    if not request.is_secure():
        raise exceptions.NotAcceptable("Use HTTPS/TLS. Conexões sem criptografia são bloqueadas.")
