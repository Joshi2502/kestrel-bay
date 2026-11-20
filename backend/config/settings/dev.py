from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

DATABASES = {
    "default": env.db(  # noqa: F405
        "DATABASE_URL",
        default="postgres://kestrel_bay:kestrel_bay_dev@localhost:5432/kestrel_bay",
    )
}

CORS_ALLOW_ALL_ORIGINS = True
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
