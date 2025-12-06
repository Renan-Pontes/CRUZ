from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SessionTokenScheme(OpenApiAuthenticationExtension):
    target_class = "api.authentication.SessionTokenAuthentication"
    name = "SessionTokenAuth"
    match_subclasses = True
    priority = -1

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "Envie `Session <token>` no header Authorization ou `X-Session-Token`.",
        }
