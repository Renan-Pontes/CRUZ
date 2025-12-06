from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import AuthSession, Profile

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
