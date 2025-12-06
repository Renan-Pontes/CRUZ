import json
import os
import random
import re
import logging
from difflib import SequenceMatcher
from urllib import request as urlrequest, error as urlerror
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction, connection
from django.http import FileResponse, Http404
from django.urls import reverse
from django.utils import timezone
from rest_framework import exceptions, permissions, status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
logger = logging.getLogger(__name__)

from .authentication import SessionTokenAuthentication
from .models import (
    ActivityLog,
    AssignedChallenge,
    Badge,
    Challenge,
    LeaderboardEntry,
    LearningPath,
    Medication,
    Profile,
    SeparacaoAttempt,
    AtendimentoChallenge,
    FindErrorsAttempt,
    MedicationCategory,
)
from .security import ensure_secure_transport, issue_session, revoke_token
from .serializers import (
    AuthSessionResponseSerializer,
    AuthSessionSerializer,
    BadgeSerializer,
    BadgeWithEarnedSerializer,
    ChallengeSerializer,
    HealthSerializer,
    ActivityLogSerializer,
    LeaderboardResponseSerializer,
    LeaderboardEntrySerializer,
    LoginSerializer,
    LogoutSerializer,
    MeResponseSerializer,
    ProfileSummarySerializer,
    ProfileDetailSerializer,
    ProfileDetailResponseSerializer,
    RegisterSerializer,
    UserInfoResponseSerializer,
    LearningPathSerializer,
    BadgesListResponseSerializer,
    MedicationSerializer,
    SeparacaoSubmissionSerializer,
    SeparacaoResultSerializer,
    SeparacaoAttemptSerializer,
    SeparacaoStepResultSerializer,
    StoredMedicationSerializer,
    SeparacaoAnswerSerializer,
    AtendimentoExerciseSerializer,
    AtendimentoSubmitSerializer,
    AtendimentoResultSerializer,
    DetailSerializer,
    FindErrorsExerciseSerializer,
    FindErrorsAttemptSerializer,
    FindErrorsSubmitSerializer,
    FindErrorsResultSerializer,
    MedicationImportSerializer,
)

User = get_user_model()
ALLOWED_EMAIL_DOMAIN = "@cs.cruzeirodosul.edu.br"
SESSION_TTL_HOURS = 24
SEPARACAO_DEFAULT_COUNT = 10
ATENDIMENTO_CONTENT_WEIGHT = 0.8
ATENDIMENTO_CLARITY_WEIGHT = 0.2
ATENDIMENTO_LLM_ENDPOINT = getattr(settings, "ATENDIMENTO_LLM_ENDPOINT", "")
ATENDIMENTO_LLM_API_KEY = getattr(settings, "ATENDIMENTO_LLM_API_KEY", "")
ATENDIMENTO_LLM_MODEL = getattr(settings, "ATENDIMENTO_LLM_MODEL", "llama3.1")
FIND_ERRORS_IMAGE_ROOT = getattr(settings, "FIND_ERRORS_IMAGE_ROOT", "")

RECIPE_ERRORS = {
    "A": [
        "Assinatura do Emitente",
        "Nome do Paciente",
        "Identificação do Comprador",
        "Identificação do emitente",
        "Identificação do Fornecedor",
    ],
    "B": [
        "Carimbo do Fornecedor",
        "Quantidade Forma Farmaceutica",
        "Posologia",
        "Identificação do Emitente",
        "Identificação Fornecedor",
    ],
    "C": [
        "Carimbo do fornecedor",
        "Quantidade Forma Farmaceutica",
        "Identificação do comprador",
        "2 via paciente",
        "1 via farmaceutica",
    ],
}
XP_BASE = 100

_NOMES = [
    "Pedro", "Mariana", "Lucas", "Carla", "João", "Ana", "Bruno", "Isabela", "Felipe", "Camila",
]
_GENEROS = ["masculino", "feminino", "não-binário"]
_SINTOMAS = [
    "dor de cabeça forte",
    "insônia recorrente",
    "ansiedade",
    "hiperatividade",
    "cólica abdominal",
    "rinite alérgica",
]
_IDADE = list(range(18, 71))

_ATENDIMENTO_CONTEXTS = [
    {
        "extra": "Está sem receita e o médico só retorna na próxima semana.",
        "context_type": "needs_prescription",
    },
    {
        "extra": "Apresenta sintomas leves e quer algo para amenizar até a consulta já marcada.",
        "context_type": "otc_possible_with_alert",
    },
    {
        "extra": "Sintomas intensos (dor no peito, falta de ar). Precisa de avaliação médica imediata.",
        "context_type": "needs_doctor",
    },
    {
        "extra": "Trouxe receita válida, mas com dúvidas sobre uso e efeitos adversos.",
        "context_type": "prescription_with_guidance",
    },
    {
        "extra": "Paciente relata que perdeu a receita e insiste em comprar mesmo assim.",
        "context_type": "needs_prescription",
    },
    {
        "extra": "Quer comprar antibiótico sem receita e pergunta se pode apresentar foto.",
        "context_type": "needs_prescription",
    },
    {
        "extra": "Procura algo para ansiedade, mas diz que nunca passou em psiquiatra.",
        "context_type": "needs_doctor",
    },
    {
        "extra": "Chegou com criança com febre, quer orientação rápida e encaminhamento.",
        "context_type": "otc_possible_with_alert",
    },
]


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


def _ensure_profile(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile


def _ensure_learning_path(user):
    path, _ = LearningPath.objects.get_or_create(
        user=user, defaults={"title": "Trilha personalizada"}
    )
    return path


def _sample_medications(count: int):
    meds = list(Medication.objects.values("id", "name", "category"))
    if not meds:
        return []
    if len(meds) <= count:
        return meds
    return random.sample(meds, count)


def _xp_from_components(correct_ratio: float, duration_secs: float, profile: Profile):
    correct_ratio = max(0.0, min(correct_ratio, 1.0))
    time_factor = max(0.0, min(1.0, 1 - (duration_secs or 0) / 600))  # 10 min cap
    streak_factor = 0.0
    if profile and profile.streak:
        streak_factor = min(1.0, profile.streak / 7)

    score = 0.5 * correct_ratio + 0.2 * time_factor + 0.3 * streak_factor
    xp = max(1, int(round(score * XP_BASE)))
    return xp


def _badge_matches(badge: Badge, user, profile: Profile, completed_assignments: int, badges_count: int) -> bool:
    """
    Avalia badge.criteria em formato simples: "<metric>>=<valor>" ou "<metric>==<valor>".
    Métricas suportadas: xp, level, streak, assignments_completed, badges_count.
    """
    criteria = (badge.criteria or "").strip()
    if not criteria:
        return False

    operator = ">=" if ">=" in criteria else "=="
    parts = criteria.split(operator)
    if len(parts) != 2:
        return False
    metric, raw_value = parts[0].strip().lower(), parts[1].strip()
    try:
        target = int(raw_value)
    except ValueError:
        return False

    metric_value = None
    if metric in ("xp", "experience_points"):
        metric_value = profile.experience_points
    elif metric == "level":
        metric_value = profile.level
    elif metric == "streak":
        metric_value = profile.streak
    elif metric == "assignments_completed":
        metric_value = completed_assignments
    elif metric == "badges_count":
        metric_value = badges_count
    else:
        return False

    if operator == ">=":
        return metric_value >= target
    return metric_value == target


def _award_badges(user):
    profile = _ensure_profile(user)
    completed_assignments = user.assigned_challenges.filter(
        status=AssignedChallenge.Status.COMPLETED
    ).count()
    badges_count = profile.badges.count()
    newly_awarded = []

    for badge in Badge.objects.all():
        if profile.badges.filter(pk=badge.pk).exists():
            continue
        if _badge_matches(badge, user, profile, completed_assignments, badges_count):
            profile.badges.add(badge)
            badges_count += 1
            newly_awarded.append(badge)

    return profile, newly_awarded


def _serialize_attempt(attempt: SeparacaoAttempt):
    meds = attempt.medications or []
    total = len(meds)
    return SeparacaoAttemptSerializer(
        {
            "id": attempt.id,
            "medications": meds,
            "current_index": attempt.current_index,
            "correct_count": attempt.correct_count,
            "completed": attempt.completed,
            "total": total,
            "pending": max(total - attempt.current_index, 0),
        }
    ).data


def _add_xp(user, amount: int, reason: str = ""):
    if amount <= 0:
        return
    profile = _ensure_profile(user)
    profile.experience_points += amount
    # Level progression: 100 XP per level as simples regra.
    new_level = max(1, profile.experience_points // 100 + 1)
    if new_level != profile.level:
        profile.level = new_level
    profile.save(update_fields=["experience_points", "level", "updated_at"])
    if reason:
        ActivityLog.objects.create(
            user=user,
            activity_type=ActivityLog.ActivityType.CUSTOM,
            message=reason,
            details={"xp_added": amount, "level": profile.level},
        )


def _list_images_for_error(recipe_type: str, error_type: str):
    if not FIND_ERRORS_IMAGE_ROOT:
        return []
    folder = os.path.join(FIND_ERRORS_IMAGE_ROOT, recipe_type, error_type)
    if not os.path.isdir(folder):
        return []
    files = []
    for name in os.listdir(folder):
        if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            rel_path = os.path.relpath(os.path.join(folder, name), FIND_ERRORS_IMAGE_ROOT)
            files.append(rel_path.replace("\\", "/"))
    return files


def _build_image_url(request, image_path: str) -> str:
    return request.build_absolute_uri(
        reverse("find-errors-image", kwargs={"image_path": image_path})
    )


def _random_atendimento_context(base_text: str) -> str:
    nome = random.choice(_NOMES)
    idade = random.choice(_IDADE)
    genero = random.choice(_GENEROS)
    sintoma = random.choice(_SINTOMAS)
    return f"{nome}, {idade} anos ({genero}), relata {sintoma}. Pedido: {base_text}"


def _clean_text(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())


_JARGON = {
    "psicotropico",
    "benzodiazepinico",
    "tarja",
    "tarjapreta",
    "metilfenidato",
    "amoxicilina",
    "cloridrato",
    "anorexigeno",
    "ansiolitico",
    "antidepressivo",
}


def _evaluate_atendimento(user_text: str, expected: str) -> tuple[int, int, list[str]]:
    tokens_user = _clean_text(user_text)
    tokens_expected = _clean_text(expected)

    content_score = SequenceMatcher(None, " ".join(tokens_user), " ".join(tokens_expected)).ratio()
    content_score = max(0.0, min(content_score, 1.0))

    total_tokens = len(tokens_user) or 1
    long_words = sum(1 for t in tokens_user if len(t) > 12)
    jargon = sum(1 for t in tokens_user if t in _JARGON)
    clarity_penalty = (long_words + jargon) / total_tokens
    clarity_score = max(0.0, 1.0 - clarity_penalty)

    final_score = (
        content_score * ATENDIMENTO_CONTENT_WEIGHT + clarity_score * ATENDIMENTO_CLARITY_WEIGHT
    )
    final_score = int(round(final_score * 100))
    feedback = []
    if content_score < 0.6:
        feedback.append("Aborde diretamente a situação do cliente e deixe claro o que pode ou não pode.")
    if clarity_score < 0.7:
        feedback.append("Simplifique a linguagem para o cliente entender facilmente.")
    if not feedback:
        feedback.append("Boa resposta: clara e alinhada ao procedimento.")
    return final_score, int(round(content_score * 100)), int(round(clarity_score * 100)), feedback


def _call_llm_atendimento(user_text: str, expected: str):
    if not ATENDIMENTO_LLM_ENDPOINT:
        return None
    payload = {
        "model": ATENDIMENTO_LLM_MODEL,
        "stream": False,
        "options": {"temperature": 0.4, "num_predict": 256},
        "prompt": (
            "Avalie a resposta de atendimento de um farmacêutico.\n"
            "Contexto (situação do cliente):\n"
            f"{expected}\n\n"
            "Resposta do farmacêutico:\n"
            f"{user_text}\n\n"
            "Regras:\n"
            "- Avalie conteúdo (80%): se abordou corretamente o que pode ou não pode vender, legislação/receita, orientações essenciais.\n"
            "- Avalie clareza (20%): linguagem simples para leigo, evita jargões técnicos, tom cordial.\n"
            "Retorne APENAS JSON no formato: {\"score\": int, \"content_score\": int, \"clarity_score\": int, \"feedback\": [\"dica1\", \"dica2\"]}\n"
            "Não adicione texto fora do JSON."
        ),
    }
    headers = {"Content-Type": "application/json"}
    if ATENDIMENTO_LLM_API_KEY:
        headers["Authorization"] = f"Bearer {ATENDIMENTO_LLM_API_KEY}"

    req = urlrequest.Request(
        ATENDIMENTO_LLM_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urlrequest.urlopen(req, timeout=10) as resp:
            data = resp.read()
            parsed = json.loads(data.decode("utf-8"))
    except (urlerror.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None

    try:
        response_text = parsed.get("response", "")
        inner = json.loads(response_text)
    except Exception:
        return None

    try:
        score = int(inner.get("score", 0))
        content_score = int(inner.get("content_score", score))
        clarity_score = int(inner.get("clarity_score", score))
        feedback = inner.get("feedback", [])
        if not isinstance(feedback, list):
            feedback = [str(feedback)]
        return {
            "score": max(0, min(score, 100)),
            "content_score": max(0, min(content_score, 100)),
            "clarity_score": max(0, min(clarity_score, 100)),
            "feedback": [str(f) for f in feedback],
        }
    except Exception:
        return None


@extend_schema(tags=["health"], responses={200: HealthSerializer})
@api_view(["GET"])
def api_health(request):
    """Lightweight health endpoint to verify the API is up."""
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
    except Exception:
        db_ok = False

    media_ok = bool(getattr(settings, "MEDIA_ROOT", None)) and os.path.isdir(
        getattr(settings, "MEDIA_ROOT", "")
    )
    images_ok = bool(FIND_ERRORS_IMAGE_ROOT) and os.path.isdir(FIND_ERRORS_IMAGE_ROOT)

    return Response(
        HealthSerializer(
            {"status": "ok", "db": db_ok, "media_root": media_ok, "images_root": images_ok}
        ).data
    )


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
        _ensure_profile(user)
        _ensure_learning_path(user)

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


@extend_schema(
    tags=["auth"],
    description="Retorna informações básicas do usuário autenticado e das sessões ativas, aplicando badges automáticas.",
    responses={200: MeResponseSerializer},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    ensure_secure_transport(request)
    user = request.user
    profile, newly_awarded = _award_badges(user)
    sessions = (
        user.auth_sessions.filter(revoked=False, expires_at__gt=timezone.now())
        .order_by("-last_seen", "-created_at")
    )

    serializer = UserInfoResponseSerializer(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "date_joined": user.date_joined,
            "last_login": user.last_login,
            "profile": profile,
            "sessions": sessions,
        }
    )
    return Response(
        {
            **serializer.data,
            "awarded_badges": BadgeSerializer(newly_awarded, many=True).data,
        }
    )


@extend_schema(
    tags=["auth"],
    description="Detalhes da sessão associada ao token enviado no header.",
    responses={200: AuthSessionSerializer},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def current_session(request):
    ensure_secure_transport(request)
    session = request.auth
    if not session:
        raise exceptions.NotAuthenticated("Token de sessão ausente.")
    return Response(AuthSessionSerializer(session).data)


@extend_schema(
    tags=["auth"],
    description="Lista todas as sessões do usuário (ativas e revogadas).",
    responses={200: AuthSessionSerializer(many=True)},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def sessions_list(request):
    ensure_secure_transport(request)
    sessions = request.user.auth_sessions.all().order_by("-created_at")
    return Response(AuthSessionSerializer(sessions, many=True).data)


@extend_schema(
    tags=["auth"],
    description="Revoga uma sessão específica do usuário (não precisa ser a atual).",
    request=None,
    responses={200: DetailSerializer},
)
@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def revoke_session(request, session_id: int):
    ensure_secure_transport(request)
    try:
        session = request.user.auth_sessions.get(pk=session_id)
    except AuthSession.DoesNotExist:
        raise exceptions.NotFound("Sessão não encontrada.")
    session.revoked = True
    session.save(update_fields=["revoked"])
    return Response({"detail": "Sessão revogada."})


@extend_schema(
    tags=["profile"],
    description="Retorna detalhes do perfil (XP, nível, streak) e badges. Aplica badges automáticas conforme critérios.",
    responses={200: ProfileDetailResponseSerializer},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def profile_detail(request):
    ensure_secure_transport(request)
    profile, newly_awarded = _award_badges(request.user)
    return Response(
        {
            "profile": ProfileDetailSerializer(profile).data,
            "awarded_badges": BadgeSerializer(newly_awarded, many=True).data,
        }
    )


@extend_schema(
    tags=["profile"],
    description="Lista todas as badges e indica quais o usuário já conquistou. Aplica badges automáticas antes de retornar.",
    responses={200: BadgesListResponseSerializer},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def badges_list(request):
    ensure_secure_transport(request)
    profile, newly_awarded = _award_badges(request.user)
    earned_ids = set(profile.badges.values_list("id", flat=True))
    badges = Badge.objects.all().order_by("name")
    return Response(
        {
            "badges": BadgeWithEarnedSerializer(
                badges, many=True, context={"earned_ids": earned_ids}
            ).data,
            "awarded_badges": BadgeSerializer(newly_awarded, many=True).data,
        }
    )


@extend_schema(
    tags=["leaderboard"],
    description="Ranking de usuários. Inclui posição do usuário autenticado, mesmo fora do top N.",
    responses={200: LeaderboardResponseSerializer},
    parameters=[
        OpenApiParameter("limit", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    ],
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def leaderboard_view(request):
    ensure_secure_transport(request)
    try:
        limit = int(request.query_params.get("limit", 20))
    except ValueError:
        limit = 20
    limit = max(1, min(limit, 100))

    top_entries = (
        LeaderboardEntry.objects.select_related("user")
        .order_by("position")[:limit]
    )
    you_entry = None
    try:
        you_entry_obj = LeaderboardEntry.objects.select_related("user").get(user=request.user)
        if you_entry_obj.position > limit:
            you_entry = LeaderboardEntrySerializer(you_entry_obj).data
    except LeaderboardEntry.DoesNotExist:
        you_entry = None

    return Response(
        {
            "results": LeaderboardEntrySerializer(top_entries, many=True).data,
            "you": you_entry,
        }
    )


@extend_schema(
    tags=["learning-path"],
    description="Retorna a trilha ativa do usuário e seus módulos.",
    responses={200: LearningPathSerializer},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def learning_path_view(request):
    ensure_secure_transport(request)
    try:
        learning_path = request.user.learning_path
    except LearningPath.DoesNotExist:
        raise exceptions.NotFound("Trilha não encontrada para este usuário.")
    return Response(LearningPathSerializer(learning_path).data)


@extend_schema(
    tags=["challenges"],
    description="Lista desafios disponíveis (somente metadados, sem conteúdo dos minigames).",
    parameters=[
        OpenApiParameter("challenge_type", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
    ],
    responses={200: ChallengeSerializer},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def challenges_list(request):
    ensure_secure_transport(request)
    qs = Challenge.objects.filter(is_active=True).order_by("-created_at")
    challenge_type = request.query_params.get("challenge_type")
    if challenge_type:
        qs = qs.filter(challenge_type=challenge_type)
    return Response(ChallengeSerializer(qs, many=True).data)


@extend_schema(
    tags=["activity"],
    description="Histórico recente de atividades do usuário.",
    responses={200: ActivityLogSerializer(many=True)},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def activity_logs(request):
    ensure_secure_transport(request)
    limit = request.query_params.get("limit")
    qs = request.user.activity_logs.all().order_by("-created_at")
    if limit:
        try:
            qs = qs[: max(1, min(int(limit), 100))]
        except ValueError:
            qs = qs[:50]
    else:
        qs = qs[:50]
    return Response(ActivityLogSerializer(qs, many=True).data)


@extend_schema(
    tags=["challenges-separacao"],
    description="Retorna uma lista aleatória de medicamentos para o minigame de separação.",
    parameters=[
        OpenApiParameter("count", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    ],
    responses={200: MedicationSerializer(many=True)},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def separacao_exercises(request):
    ensure_secure_transport(request)
    try:
        count = int(request.query_params.get("count", SEPARACAO_DEFAULT_COUNT))
    except ValueError:
        count = SEPARACAO_DEFAULT_COUNT
    count = max(1, min(count, 50))

    meds = _sample_medications(count)
    if not meds:
        raise exceptions.NotFound("Nenhum medicamento cadastrado.")
    return Response(MedicationSerializer(meds, many=True).data)


@extend_schema(
    tags=["challenges-separacao"],
    description="Recebe as respostas do minigame de separação e retorna acertos/erros.",
    request=SeparacaoSubmissionSerializer,
    responses={200: SeparacaoResultSerializer},
)
@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def separacao_submit(request):
    ensure_secure_transport(request)
    serializer = SeparacaoSubmissionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    answers = serializer.validated_data["answers"]
    if not answers:
        raise exceptions.ValidationError("Nenhuma resposta enviada.")

    med_ids = [a["medication_id"] for a in answers]
    meds = {m.id: m for m in Medication.objects.filter(id__in=med_ids)}

    details = []
    correct = 0
    total = len(answers)
    for item in answers:
        med = meds.get(item["medication_id"])
        if not med:
            details.append(
                {
                    "medication_id": item["medication_id"],
                    "status": "unknown_medication",
                }
            )
            continue
        is_correct = med.category == item["chosen_category"]
        if is_correct:
            correct += 1
        details.append(
            {
                "medication_id": med.id,
                "medication_name": med.name,
                "expected": med.category,
                "chosen": item["chosen_category"],
                "correct": is_correct,
            }
        )

    accuracy = correct / total if total else 0

    # Log de atividade simples
    ActivityLog.objects.create(
        user=request.user,
        activity_type=ActivityLog.ActivityType.CHALLENGE_COMPLETED,
        message="Separação de medicamentos concluída",
        details={"correct": correct, "total": total, "accuracy": accuracy},
    )

    profile = _ensure_profile(request.user)
    xp_gain = _xp_from_components(accuracy, 0, profile)
    _add_xp(request.user, xp_gain, reason="Separação concluída")
    logger.info("Separacao concluída", extra={"user_id": request.user.id, "xp_gain": xp_gain})

    return Response(
        SeparacaoResultSerializer(
            {
                "total": total,
                "correct": correct,
                "accuracy": accuracy,
                "details": details,
            }
        ).data
    )


@extend_schema(
    tags=["challenges-separacao"],
    description=(
        "Inicia (ou retoma) um attempt de separação. Retorna medicamentos na ordem, "
        "índice atual e progresso. Use `reset=true` para começar do zero."
    ),
    parameters=[
        OpenApiParameter("count", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("reset", OpenApiTypes.BOOL, OpenApiParameter.QUERY, required=False),
    ],
    request=None,
    responses={200: SeparacaoAttemptSerializer},
)
@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def separacao_start(request):
    ensure_secure_transport(request)
    reset = str(request.query_params.get("reset", "")).lower() in ("1", "true", "yes", "sim")
    active = (
        request.user.separacao_attempts.filter(completed=False)
        .order_by("-created_at")
        .first()
    )
    if active and not reset:
        return Response(_serialize_attempt(active))

    if active and reset:
        active.completed = True
        active.save(update_fields=["completed", "updated_at"])

    try:
        count = int(request.query_params.get("count", SEPARACAO_DEFAULT_COUNT))
    except ValueError:
        count = SEPARACAO_DEFAULT_COUNT
    count = max(1, min(count, 50))

    meds = _sample_medications(count)
    if not meds:
        raise exceptions.NotFound("Nenhum medicamento cadastrado.")

    attempt = SeparacaoAttempt.objects.create(
        user=request.user,
        medications=meds,
        answers=[],
        current_index=0,
        correct_count=0,
        completed=False,
    )
    return Response(_serialize_attempt(attempt))


@extend_schema(
    tags=["challenges-separacao"],
    description="Retorna o attempt em andamento para retomar o jogo.",
    responses={200: SeparacaoAttemptSerializer},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def separacao_attempt_current(request):
    ensure_secure_transport(request)
    attempt = (
        request.user.separacao_attempts.filter(completed=False)
        .order_by("-created_at")
        .first()
    )
    if not attempt:
        raise exceptions.NotFound("Nenhum attempt em andamento.")
    return Response(_serialize_attempt(attempt))


@extend_schema(
    tags=["challenges-separacao"],
    description="Submete uma resposta para o próximo item do attempt em andamento.",
    request=SeparacaoAnswerSerializer,
    responses={200: SeparacaoStepResultSerializer},
)
@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def separacao_answer(request, attempt_id: int):
    ensure_secure_transport(request)
    try:
        attempt = request.user.separacao_attempts.get(pk=attempt_id)
    except SeparacaoAttempt.DoesNotExist:
        raise exceptions.NotFound("Attempt não encontrado.")

    if attempt.completed:
        raise exceptions.ValidationError("Attempt já foi concluído.")

    meds = attempt.medications or []
    total = len(meds)
    if total == 0:
        raise exceptions.APIException("Attempt inválido (sem medicamentos).")

    if attempt.current_index >= total:
        attempt.completed = True
        attempt.save(update_fields=["completed", "updated_at"])
        raise exceptions.ValidationError("Attempt já foi concluído.")

    payload = SeparacaoAnswerSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    med_input = payload.validated_data

    expected_med = meds[attempt.current_index]
    if med_input["medication_id"] != expected_med["id"]:
        raise exceptions.ValidationError("Resposta não corresponde ao próximo medicamento da fila.")

    is_correct = expected_med["category"] == med_input["chosen_category"]
    answers = list(attempt.answers or [])
    answers.append(
        {
            "index": attempt.current_index,
            "medication_id": expected_med["id"],
            "chosen": med_input["chosen_category"],
            "expected": expected_med["category"],
            "correct": is_correct,
        }
    )

    attempt.answers = answers
    if is_correct:
        attempt.correct_count += 1
    attempt.current_index += 1
    if attempt.current_index >= total:
        attempt.completed = True

    attempt.save(
        update_fields=["answers", "correct_count", "current_index", "completed", "updated_at"]
    )

    if attempt.completed:
        ActivityLog.objects.create(
            user=request.user,
            activity_type=ActivityLog.ActivityType.CHALLENGE_COMPLETED,
            message="Separação de medicamentos concluída",
            details={
                "correct": attempt.correct_count,
                "total": total,
                "accuracy": attempt.correct_count / total if total else 0,
            },
        )
        duration = (timezone.now() - attempt.created_at).total_seconds()
        profile = _ensure_profile(request.user)
        xp_gain = _xp_from_components(
            attempt.correct_count / total if total else 0,
            duration,
            profile,
        )
        _add_xp(request.user, xp_gain, reason="Separação concluída")
        logger.info(
            "Separacao attempt concluída",
            extra={"user_id": request.user.id, "attempt_id": attempt.id, "xp_gain": xp_gain},
        )

    next_med = meds[attempt.current_index] if not attempt.completed else None
    resp = SeparacaoStepResultSerializer(
        {
            "correct": is_correct,
            "expected": expected_med["category"],
            "chosen": med_input["chosen_category"],
            "index": attempt.current_index,
            "total": total,
            "completed": attempt.completed,
            "accuracy": attempt.correct_count / attempt.current_index
            if attempt.current_index
            else 0,
            "next_medication": next_med,
        }
    ).data
    return Response(resp)


@extend_schema(
    tags=["challenges-atendimento"],
    description="Retorna um caso aleatório de atendimento (texto do cliente).",
    responses={200: AtendimentoExerciseSerializer},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def atendimento_exercise(request):
    ensure_secure_transport(request)
    challenge = (
        AtendimentoChallenge.objects.select_related("challenge")
        .filter(challenge__is_active=True)
        .order_by("?")
        .first()
    )
    if not challenge:
        raise exceptions.NotFound("Nenhum caso de atendimento cadastrado.")
    base_context = _random_atendimento_context(challenge.customer_scenario)
    context_choice = random.choice(_ATENDIMENTO_CONTEXTS)
    scenario = f"{base_context} {context_choice['extra']}".strip()
    return Response(
        AtendimentoExerciseSerializer(
            {
                "challenge_id": challenge.challenge_id,
                "customer_scenario": scenario,
                "context_type": context_choice["context_type"],
            }
        ).data
    )


@extend_schema(
    tags=["challenges-atendimento"],
    description="Submete a resposta de atendimento, calcula score (80% conteúdo, 20% clareza).",
    request=AtendimentoSubmitSerializer,
    responses={200: AtendimentoResultSerializer},
)
@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def atendimento_submit(request):
    ensure_secure_transport(request)
    payload = AtendimentoSubmitSerializer(data=request.data)
    payload.is_valid(raise_exception=True)

    challenge_id = payload.validated_data["challenge_id"]
    response_text = payload.validated_data["response_text"]

    try:
        case = AtendimentoChallenge.objects.select_related("challenge").get(
            challenge_id=challenge_id, challenge__is_active=True
        )
    except AtendimentoChallenge.DoesNotExist:
        raise exceptions.NotFound("Caso de atendimento não encontrado ou inativo.")

    llm_result = _call_llm_atendimento(response_text, case.expected_response)
    if llm_result:
        score = llm_result["score"]
        content_score = llm_result["content_score"]
        clarity_score = llm_result["clarity_score"]
        feedback = llm_result["feedback"]
    else:
        score, content_score, clarity_score, feedback = _evaluate_atendimento(
            response_text, case.expected_response
        )

    ActivityLog.objects.create(
        user=request.user,
        activity_type=ActivityLog.ActivityType.CHALLENGE_COMPLETED,
        message="Caso de atendimento respondido",
        details={
            "challenge_id": challenge_id,
            "score": score,
            "content_score": content_score,
            "clarity_score": clarity_score,
        },
    )

    profile = _ensure_profile(request.user)
    duration = 0  # não temos início, então tratamos como resposta imediata (time_factor=1)
    xp_gain = _xp_from_components(score / 100, duration, profile)
    _add_xp(request.user, xp_gain, reason="Atendimento concluído")
    logger.info(
        "Atendimento concluído",
        extra={"user_id": request.user.id, "challenge_id": challenge_id, "score": score, "xp_gain": xp_gain},
    )

    return Response(
        AtendimentoResultSerializer(
            {
                "score": score,
                "content_score": content_score,
                "clarity_score": clarity_score,
                "feedback": feedback,
            }
        ).data
    )


@extend_schema(
    tags=["medications"],
    description="Lista medicamentos cadastrados (nome + categoria).",
    responses={200: MedicationSerializer(many=True)},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def medications_list(request):
    ensure_secure_transport(request)
    meds = Medication.objects.all().order_by("name")
    return Response(MedicationSerializer(meds, many=True).data)


@extend_schema(
    tags=["medications"],
    description=(
        "Importa medicamentos via JSON por categoria. Formato: {\"A1\": [\"remédio\"], \"B2\": [...]}. "
        "Se replace=true, remove os não enviados daquela categoria."
    ),
    request=MedicationImportSerializer,
    responses={200: DetailSerializer},
)
@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAdminUser])
def medications_import(request):
    ensure_secure_transport(request)
    serializer = MedicationImportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data["data"]
    replace = serializer.validated_data["replace"]

    with transaction.atomic():
        for category, med_names in data.items():
            normalized_names = {name.strip() for name in med_names if name.strip()}
            if replace:
                Medication.objects.filter(category=category).exclude(name__in=normalized_names).delete()
            for name in normalized_names:
                Medication.objects.get_or_create(name=name, category=category)

    return Response({"detail": "Medicamentos importados com sucesso."})


@extend_schema(
    tags=["challenges-find-errors"],
    description=(
        "Cria um exercício de '7 erros' selecionando imagem aleatória por tipo de receita (A/B/C) "
        "e por tipo de erro. Retorna attempt_id para retomar."
    ),
    parameters=[
        OpenApiParameter(
            "recipe_type",
            OpenApiTypes.STR,
            OpenApiParameter.QUERY,
            required=False,
            enum=["A", "B", "C"],
            description="Se omitido, escolhe aleatoriamente A/B/C.",
        ),
        OpenApiParameter("reset", OpenApiTypes.BOOL, OpenApiParameter.QUERY, required=False),
    ],
    request=None,
    responses={200: FindErrorsExerciseSerializer},
)
@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def find_errors_start(request):
    ensure_secure_transport(request)
    recipe_type = (request.query_params.get("recipe_type") or "").upper()
    reset = str(request.query_params.get("reset", "")).lower() in ("1", "true", "yes", "sim")
    if recipe_type not in ("A", "B", "C"):
        recipe_type = random.choice(list(RECIPE_ERRORS.keys()))

    active = (
        request.user.find_errors_attempts.filter(completed=False, recipe_type=recipe_type)
        .order_by("-created_at")
        .first()
    )
    if active and not reset:
        return Response(
            FindErrorsExerciseSerializer(
                {
                    "attempt_id": active.id,
                    "recipe_type": active.recipe_type,
                    "image_path": active.image_path,
                    "image_url": _build_image_url(request, active.image_path),
                    "options": RECIPE_ERRORS.get(active.recipe_type, []),
                }
            ).data
        )

    # Pick an error type and image file
    error_type = random.choice(RECIPE_ERRORS[recipe_type])
    images = _list_images_for_error(recipe_type, error_type)
    if not images:
        raise exceptions.NotFound("Nenhuma imagem encontrada para este tipo/erro.")
    image_path = random.choice(images)

    attempt = FindErrorsAttempt.objects.create(
        user=request.user,
        recipe_type=recipe_type,
        error_type=error_type,
        image_path=image_path,
        expected_errors=[error_type],
        found_errors=[],
        completed=False,
    )

    return Response(
        FindErrorsExerciseSerializer(
            {
                "attempt_id": attempt.id,
                "recipe_type": attempt.recipe_type,
                "image_path": attempt.image_path,
                "image_url": _build_image_url(request, attempt.image_path),
                "options": RECIPE_ERRORS.get(attempt.recipe_type, []),
            }
        ).data
    )


@extend_schema(
    tags=["challenges-find-errors"],
    description="Retorna um attempt em andamento pelo ID (para retomar o mesmo exercício).",
    responses={200: FindErrorsAttemptSerializer},
)
@api_view(["GET"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def find_errors_attempt(request, attempt_id: int):
    ensure_secure_transport(request)
    try:
        attempt = request.user.find_errors_attempts.get(pk=attempt_id)
    except FindErrorsAttempt.DoesNotExist:
        raise exceptions.NotFound("Attempt não encontrado.")

    return Response(
        FindErrorsAttemptSerializer(
            {
                "id": attempt.id,
                "recipe_type": attempt.recipe_type,
                "image_path": attempt.image_path,
                "image_url": _build_image_url(request, attempt.image_path),
                "options": RECIPE_ERRORS.get(attempt.recipe_type, []),
                "completed": attempt.completed,
                "found_errors": attempt.found_errors,
            }
        ).data
    )


@extend_schema(
    tags=["challenges-find-errors"],
    description="Submete a identificação de um erro para o attempt atual.",
    request=FindErrorsSubmitSerializer,
    responses={200: FindErrorsResultSerializer},
)
@api_view(["POST"])
@authentication_classes([SessionTokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def find_errors_submit(request, attempt_id: int):
    ensure_secure_transport(request)
    try:
        attempt = request.user.find_errors_attempts.get(pk=attempt_id)
    except FindErrorsAttempt.DoesNotExist:
        raise exceptions.NotFound("Attempt não encontrado.")

    payload = FindErrorsSubmitSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    found_error = payload.validated_data["found_error"]

    found = list(attempt.found_errors or [])
    if found_error not in found:
        found.append(found_error)
    attempt.found_errors = found

    expected = attempt.expected_errors or []
    correct = found_error in expected

    # Mark complete if all expected errors found (or repeated submission)
    if all(err in found for err in expected):
        attempt.completed = True

    attempt.save(update_fields=["found_errors", "completed", "updated_at"])

    if attempt.completed:
        ActivityLog.objects.create(
            user=request.user,
            activity_type=ActivityLog.ActivityType.CHALLENGE_COMPLETED,
            message="Desafio de 7 erros concluído",
            details={
                "recipe_type": attempt.recipe_type,
                "found_errors": attempt.found_errors,
                "expected_errors": attempt.expected_errors,
            },
        )
        duration = (timezone.now() - attempt.created_at).total_seconds()
        profile = _ensure_profile(request.user)
        xp_gain = _xp_from_components(
            1.0 if attempt.expected_errors else 0.0,
            duration,
            profile,
        )
        _add_xp(request.user, xp_gain, reason="7 erros concluído")
        logger.info(
            "7 erros concluído",
            extra={"user_id": request.user.id, "attempt_id": attempt.id, "xp_gain": xp_gain},
        )

    return Response(
        FindErrorsResultSerializer(
            {
                "correct": correct,
                "expected_errors": expected,
                "found_errors": found,
                "completed": attempt.completed,
            }
        ).data
    )


@extend_schema(
    tags=["challenges-find-errors"],
    description="Serve a imagem de um exercício de 7 erros. Caminho relativo vem no campo image_path.",
    request=None,
    responses={200: {"content": {"image/*": {}}}},
)
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def find_errors_image(request, image_path: str):
    if not FIND_ERRORS_IMAGE_ROOT:
        raise Http404("Imagens não configuradas.")
    safe_root = os.path.abspath(FIND_ERRORS_IMAGE_ROOT)
    target = os.path.abspath(os.path.normpath(os.path.join(safe_root, image_path)))
    if not target.startswith(safe_root) or not os.path.isfile(target):
        raise Http404("Imagem não encontrada.")
    return FileResponse(open(target, "rb"))
