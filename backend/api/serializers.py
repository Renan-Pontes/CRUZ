from django.contrib.auth import get_user_model
from rest_framework import serializers


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
