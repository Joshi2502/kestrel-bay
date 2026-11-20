import os

from django.contrib.auth.hashers import make_password
from django.db import migrations

DEFAULT_USERNAME = "dana"
DEFAULT_PASSWORD = "kestrel-monday"  # demo login, documented in the README


def create_demo_user(apps, schema_editor):
    user_model = apps.get_model("auth", "User")
    username = os.environ.get("DANA_USERNAME", DEFAULT_USERNAME)
    password = os.environ.get("DANA_PASSWORD") or DEFAULT_PASSWORD
    user_model.objects.update_or_create(
        username=username, defaults={"password": make_password(password)}
    )


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [migrations.RunPython(create_demo_user, migrations.RunPython.noop)]
