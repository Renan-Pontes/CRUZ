from django.utils import timezone
from rest_framework import authentication, exceptions

from .models import AuthSession
from .security import hash_token


class SessionTokenAuthentication(authentication.BaseAuthentication):
    """
    Autenticação baseada em token opaco enviado em:
    - Header Authorization: Session <token>
    - ou Header X-Session-Token: <token>
    """

    keyword = "Session"

    def authenticate(self, request):
        raw_token = self._get_token_from_headers(request)
        if not raw_token:
            return None

        session = (
            AuthSession.objects.select_related("user")
            .filter(token_hash=hash_token(raw_token), revoked=False)
            .first()
        )
        if not session or session.expires_at <= timezone.now():
            raise exceptions.AuthenticationFailed("Sessão inválida ou expirada.")

        # Atualiza atividade
        session.last_seen = timezone.now()
        session.save(update_fields=["last_seen"])
        return (session.user, session)

    def _get_token_from_headers(self, request):
        auth = authentication.get_authorization_header(request).decode("utf-8")
        if auth and auth.lower().startswith(f"{self.keyword.lower()} "):
            return auth.split(" ", 1)[1].strip()
        return request.META.get("HTTP_X_SESSION_TOKEN")
