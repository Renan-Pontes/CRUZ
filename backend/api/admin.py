from django.contrib import admin

from .models import (
    ActivityLog,
    AssignedChallenge,
    AtendimentoChallenge,
    AuthSession,
    Badge,
    Challenge,
    FindErrorsAttempt,
    FindErrorsChallenge,
    LeaderboardEntry,
    LearningPath,
    Medication,
    PathModule,
    PathModuleChallenge,
    Profile,
    SeparacaoAttempt,
    SeparacaoChallenge,
)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "experience_points", "level", "streak")
    search_fields = ("user__username", "user__email")


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ("name", "criteria", "created_at")
    search_fields = ("name", "criteria")


@admin.register(LeaderboardEntry)
class LeaderboardEntryAdmin(admin.ModelAdmin):
    list_display = ("user", "position", "score", "trend")
    search_fields = ("user__username", "user__email")
    ordering = ("position",)


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("user", "activity_type", "message", "created_at")
    search_fields = ("user__username", "message")
    list_filter = ("activity_type",)


@admin.register(LearningPath)
class LearningPathAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "is_active", "created_at")
    search_fields = ("user__username", "title")
    list_filter = ("is_active",)


@admin.register(PathModule)
class PathModuleAdmin(admin.ModelAdmin):
    list_display = ("path", "title", "challenge_type", "position")
    list_filter = ("challenge_type",)
    ordering = ("path", "position")


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ("title", "challenge_type", "difficulty", "is_active", "created_at")
    list_filter = ("challenge_type", "is_active")
    search_fields = ("title",)


@admin.register(FindErrorsChallenge)
class FindErrorsChallengeAdmin(admin.ModelAdmin):
    list_display = ("challenge",)


@admin.register(AtendimentoChallenge)
class AtendimentoChallengeAdmin(admin.ModelAdmin):
    list_display = ("challenge",)


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display = ("name", "category")
    search_fields = ("name",)
    list_filter = ("category",)


@admin.register(SeparacaoChallenge)
class SeparacaoChallengeAdmin(admin.ModelAdmin):
    list_display = ("challenge",)


@admin.register(PathModuleChallenge)
class PathModuleChallengeAdmin(admin.ModelAdmin):
    list_display = ("module", "challenge", "position")
    ordering = ("module", "position")


@admin.register(AssignedChallenge)
class AssignedChallengeAdmin(admin.ModelAdmin):
    list_display = ("user", "challenge", "module", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("user__username", "challenge__title")


@admin.register(AuthSession)
class AuthSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "revoked", "last_seen")
    list_filter = ("revoked",)
    search_fields = ("user__username", "user__email")


@admin.register(SeparacaoAttempt)
class SeparacaoAttemptAdmin(admin.ModelAdmin):
    list_display = ("user", "current_index", "correct_count", "completed", "created_at")
    list_filter = ("completed",)
    search_fields = ("user__username",)


@admin.register(FindErrorsAttempt)
class FindErrorsAttemptAdmin(admin.ModelAdmin):
    list_display = ("user", "recipe_type", "error_type", "completed", "created_at")
    list_filter = ("recipe_type", "completed")
    search_fields = ("user__username",)
