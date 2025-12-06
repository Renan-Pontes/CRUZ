from django.conf import settings
from django.http import HttpResponse


def cors_allow_localhost(get_response):
    """
    Minimal CORS middleware to allow the Expo/React dev server (e.g., localhost:8081)
    to call the API during development without adding extra dependencies.
    """

    allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
    allowed_headers = "Authorization, Content-Type, X-Session-Token"
    allowed_methods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"

    def middleware(request):
        origin = request.META.get("HTTP_ORIGIN")
        allow_origin = origin if origin in allowed_origins else ""

        if request.method == "OPTIONS" and allow_origin:
            response = HttpResponse(status=200)
        else:
            response = get_response(request)

        if allow_origin:
            response["Access-Control-Allow-Origin"] = allow_origin
            response["Access-Control-Allow-Methods"] = allowed_methods
            response["Access-Control-Allow-Headers"] = allowed_headers
            response["Access-Control-Allow-Credentials"] = "true"

        return response

    return middleware
