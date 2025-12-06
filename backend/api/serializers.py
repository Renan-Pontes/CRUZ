from django.contrib.auth import get_user_model
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import AuthSession, Badge, Challenge, LeaderboardEntry, LearningPath, PathModule, Profile
from .models import ActivityLog, Medication, AtendimentoChallenge, FindErrorsAttempt
from .models import MedicationCategory

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class AuthSessionResponseSerializer(serializers.Serializer):
    token = serializers.CharField()
    expires_at = serializers.DateTimeField()
    user_id = serializers.IntegerField()
    email = serializers.EmailField()


class LogoutSerializer(serializers.Serializer):
    all_devices = serializers.BooleanField(default=False)


class ProfileSummarySerializer(serializers.ModelSerializer):
    badges = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")

    class Meta:
        model = Profile
        fields = ["experience_points", "level", "streak", "badges"]


class AuthSessionSerializer(serializers.ModelSerializer):
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = AuthSession
        fields = [
            "id",
            "created_at",
            "expires_at",
            "revoked",
            "user_agent",
            "last_ip",
            "last_seen",
            "is_active",
        ]

    @extend_schema_field(serializers.BooleanField())
    def get_is_active(self, obj):
        return obj.is_active()


class UserInfoResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    date_joined = serializers.DateTimeField()
    last_login = serializers.DateTimeField(allow_null=True)
    profile = ProfileSummarySerializer(allow_null=True)
    sessions = AuthSessionSerializer(many=True)


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ["id", "name", "description", "icon", "criteria", "created_at"]


class BadgeWithEarnedSerializer(BadgeSerializer):
    earned = serializers.SerializerMethodField()

    class Meta(BadgeSerializer.Meta):
        fields = BadgeSerializer.Meta.fields + ["earned"]

    @extend_schema_field(serializers.BooleanField())
    def get_earned(self, obj):
        earned_ids = self.context.get("earned_ids", set())
        return obj.id in earned_ids


class ProfileDetailSerializer(serializers.ModelSerializer):
    badges = BadgeSerializer(many=True, read_only=True)

    class Meta:
        model = Profile
        fields = ["experience_points", "level", "streak", "badges"]


class UserSlimSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    user = UserSlimSerializer()

    class Meta:
        model = LeaderboardEntry
        fields = ["user", "position", "score", "trend"]


class PathModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PathModule
        fields = ["id", "title", "challenge_type", "position", "required_exercises"]


class LearningPathSerializer(serializers.ModelSerializer):
    modules = PathModuleSerializer(many=True, read_only=True)

    class Meta:
        model = LearningPath
        fields = ["id", "title", "is_active", "modules"]


class ChallengeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Challenge
        fields = ["id", "challenge_type", "title", "prompt", "difficulty", "is_active"]


class MeResponseSerializer(UserInfoResponseSerializer):
    awarded_badges = BadgeSerializer(many=True)


class ProfileDetailResponseSerializer(serializers.Serializer):
    profile = ProfileDetailSerializer()
    awarded_badges = BadgeSerializer(many=True)


class BadgesListResponseSerializer(serializers.Serializer):
    badges = BadgeWithEarnedSerializer(many=True)
    awarded_badges = BadgeSerializer(many=True)


class LeaderboardResponseSerializer(serializers.Serializer):
    results = LeaderboardEntrySerializer(many=True)
    you = LeaderboardEntrySerializer(allow_null=True)


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    db = serializers.BooleanField()
    media_root = serializers.BooleanField()
    images_root = serializers.BooleanField()


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = ["id", "activity_type", "message", "details", "created_at"]


class SeparacaoAnswerSerializer(serializers.Serializer):
    medication_id = serializers.IntegerField()
    chosen_category = serializers.CharField(max_length=2)


class SeparacaoSubmissionSerializer(serializers.Serializer):
    answers = SeparacaoAnswerSerializer(many=True)


class SeparacaoResultSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    correct = serializers.IntegerField()
    accuracy = serializers.FloatField()
    details = serializers.ListField()


class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = ["id", "name", "category"]


class MedicationImportSerializer(serializers.Serializer):
    data = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()),
        help_text="Mapeamento categoria -> lista de nomes de medicamentos.",
    )
    replace = serializers.BooleanField(
        default=False,
        help_text="Se true, remove medicamentos daquela categoria que não estejam na lista enviada.",
    )

    def validate_data(self, value):
        valid_categories = {choice[0].upper() for choice in MedicationCategory.choices}
        normalized = {}
        for cat, meds in value.items():
            cat_norm = str(cat).upper()
            if cat_norm not in valid_categories:
                raise serializers.ValidationError(f"Categoria inválida: {cat}")
            normalized[cat_norm] = meds
        return normalized


class StoredMedicationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    category = serializers.CharField(max_length=2)


class SeparacaoAttemptSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    medications = StoredMedicationSerializer(many=True)
    current_index = serializers.IntegerField()
    correct_count = serializers.IntegerField()
    completed = serializers.BooleanField()
    total = serializers.IntegerField()
    pending = serializers.IntegerField()


class SeparacaoStepResultSerializer(serializers.Serializer):
    correct = serializers.BooleanField()
    expected = serializers.CharField(max_length=2)
    chosen = serializers.CharField(max_length=2)
    index = serializers.IntegerField()
    total = serializers.IntegerField()
    completed = serializers.BooleanField()
    accuracy = serializers.FloatField()
    next_medication = StoredMedicationSerializer(allow_null=True)


class AtendimentoExerciseSerializer(serializers.ModelSerializer):
    challenge_id = serializers.IntegerField(read_only=True)
    context_type = serializers.CharField()

    class Meta:
        model = AtendimentoChallenge
        fields = ["challenge_id", "customer_scenario", "context_type"]


class AtendimentoSubmitSerializer(serializers.Serializer):
    challenge_id = serializers.IntegerField()
    response_text = serializers.CharField()
    scenario = serializers.CharField(required=False, allow_blank=True)
    context_type = serializers.CharField(required=False, allow_blank=True)


class AtendimentoResultSerializer(serializers.Serializer):
    score = serializers.IntegerField()
    content_score = serializers.IntegerField()
    clarity_score = serializers.IntegerField()
    feedback = serializers.ListField(child=serializers.CharField())


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class FindErrorsExerciseSerializer(serializers.Serializer):
    attempt_id = serializers.IntegerField()
    recipe_type = serializers.CharField()
    image_path = serializers.CharField()
    image_url = serializers.CharField()
    options = serializers.ListField(child=serializers.CharField())


class FindErrorsAttemptSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    recipe_type = serializers.CharField()
    image_path = serializers.CharField()
    image_url = serializers.CharField()
    options = serializers.ListField(child=serializers.CharField())
    completed = serializers.BooleanField()
    found_errors = serializers.ListField(child=serializers.CharField())


class FindErrorsSubmitSerializer(serializers.Serializer):
    found_error = serializers.CharField()


class FindErrorsResultSerializer(serializers.Serializer):
    correct = serializers.BooleanField()
    expected_errors = serializers.ListField(child=serializers.CharField())
    found_errors = serializers.ListField(child=serializers.CharField())
    completed = serializers.BooleanField()
