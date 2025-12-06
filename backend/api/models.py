from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ChallengeType(models.TextChoices):
    FIND_ERRORS = "find_errors", "7 Erros"
    ATENDIMENTO = "atendimento", "Atendimento"
    SEPARACAO = "separacao", "Separação"


class Profile(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    experience_points = models.PositiveIntegerField(default=0)
    level = models.PositiveIntegerField(default=1)
    streak = models.PositiveIntegerField(default=0, help_text="Dias seguidos ativos.")
    badges = models.ManyToManyField("Badge", blank=True, related_name="profiles")

    def __str__(self):
        return f"Perfil de {self.user}"


class Badge(TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    icon = models.ImageField(upload_to="badges/", blank=True, null=True)
    criteria = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.name


class LeaderboardEntry(TimeStampedModel):
    class Trend(models.TextChoices):
        UP = "up", "Subindo"
        DOWN = "down", "Descendo"
        STABLE = "stable", "Estável"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="leaderboard_entry",
    )
    position = models.PositiveIntegerField(help_text="Posição do ranking (1 = topo).")
    score = models.PositiveIntegerField(default=0, help_text="XP total ou outro score.")
    trend = models.CharField(
        max_length=6,
        choices=Trend.choices,
        default=Trend.STABLE,
        help_text="Indica se o aluno subiu ou desceu recentemente.",
    )

    class Meta:
        ordering = ["position"]

    def __str__(self):
        return f"{self.user} - #{self.position} ({self.score} pts)"


class ActivityLog(TimeStampedModel):
    class ActivityType(models.TextChoices):
        LOGIN = "login", "Login"
        CHALLENGE_STARTED = "challenge_started", "Desafio iniciado"
        CHALLENGE_COMPLETED = "challenge_completed", "Desafio concluído"
        BADGE_EARNED = "badge_earned", "Badge conquistada"
        LEVEL_UP = "level_up", "Subiu de nível"
        CUSTOM = "custom", "Custom"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="activity_logs",
    )
    activity_type = models.CharField(
        max_length=32, choices=ActivityType.choices, default=ActivityType.CUSTOM
    )
    message = models.CharField(max_length=255, blank=True)
    details = models.JSONField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} - {self.activity_type}"


class LearningPath(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_path",
    )
    title = models.CharField(max_length=120, default="Trilha personalizada")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Trilha de {self.user}"


class PathModule(TimeStampedModel):
    path = models.ForeignKey(
        LearningPath, on_delete=models.CASCADE, related_name="modules"
    )
    title = models.CharField(max_length=140)
    challenge_type = models.CharField(max_length=20, choices=ChallengeType.choices)
    position = models.PositiveIntegerField(default=1)
    required_exercises = models.PositiveIntegerField(
        default=1,
        help_text="Quantidade de exercícios do módulo para marcar como concluído.",
    )

    class Meta:
        ordering = ["position"]
        unique_together = ("path", "position")

    def __str__(self):
        return f"{self.path} - Módulo {self.position}: {self.title}"


class Challenge(TimeStampedModel):
    challenge_type = models.CharField(max_length=20, choices=ChallengeType.choices)
    title = models.CharField(max_length=140)
    prompt = models.TextField(blank=True)
    difficulty = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.get_challenge_type_display()})"


class FindErrorsChallenge(models.Model):
    challenge = models.OneToOneField(
        Challenge,
        on_delete=models.CASCADE,
        related_name="find_errors",
        limit_choices_to={"challenge_type": ChallengeType.FIND_ERRORS},
    )
    image = models.ImageField(upload_to="challenges/find_errors/")
    errors = models.JSONField(help_text="Lista de erros a serem encontrados.")

    def __str__(self):
        return f"7 erros #{self.challenge_id}"


class AtendimentoChallenge(models.Model):
    challenge = models.OneToOneField(
        Challenge,
        on_delete=models.CASCADE,
        related_name="atendimento",
        limit_choices_to={"challenge_type": ChallengeType.ATENDIMENTO},
    )
    customer_scenario = models.TextField()
    expected_response = models.TextField()

    def __str__(self):
        return f"Atendimento #{self.challenge_id}"


class MedicationCategory(models.TextChoices):
    A1 = "A1", "A1"
    A2 = "A2", "A2"
    B1 = "B1", "B1"
    B2 = "B2", "B2"
    C1 = "C1", "C1"
    C2 = "C2", "C2"
    C3 = "C3", "C3"
    C4 = "C4", "C4"
    C5 = "C5", "C5"


class Medication(models.Model):
    name = models.CharField(max_length=200, unique=True)
    category = models.CharField(max_length=2, choices=MedicationCategory.choices)

    def __str__(self):
        return f"{self.name} ({self.category})"


class SeparacaoChallenge(models.Model):
    challenge = models.OneToOneField(
        Challenge,
        on_delete=models.CASCADE,
        related_name="separacao",
        limit_choices_to={"challenge_type": ChallengeType.SEPARACAO},
    )
    medications = models.ManyToManyField(Medication, related_name="separacao_challenges")

    def __str__(self):
        return f"Separação #{self.challenge_id}"


class PathModuleChallenge(TimeStampedModel):
    module = models.ForeignKey(
        PathModule, on_delete=models.CASCADE, related_name="module_challenges"
    )
    challenge = models.ForeignKey(
        Challenge, on_delete=models.CASCADE, related_name="module_instances"
    )
    position = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["position"]
        unique_together = ("module", "challenge")

    def __str__(self):
        return f"{self.module} -> {self.challenge}"


class AssignedChallenge(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        IN_PROGRESS = "in_progress", "Em progresso"
        COMPLETED = "completed", "Concluído"
        FAILED = "failed", "Falhou"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_challenges",
    )
    module = models.ForeignKey(
        PathModule, on_delete=models.CASCADE, related_name="assignments"
    )
    challenge = models.ForeignKey(
        Challenge, on_delete=models.CASCADE, related_name="assignments"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempt_count = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    last_interaction_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        unique_together = ("user", "module", "challenge")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} - {self.challenge} ({self.status})"


class AuthSession(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="auth_sessions",
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    revoked = models.BooleanField(default=False)
    user_agent = models.CharField(max_length=255, blank=True)
    last_ip = models.GenericIPAddressField(blank=True, null=True)
    last_seen = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Session for {self.user} (expira {self.expires_at})"

    def is_active(self):
        return not self.revoked and self.expires_at > timezone.now()
