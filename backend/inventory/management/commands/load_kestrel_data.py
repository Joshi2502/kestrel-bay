from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from inventory.loader import load_all
from inventory.models import HandledFlag


class Command(BaseCommand):
    help = "Load the BlueTide CSV exports into the database (replaces previous load)."

    def add_arguments(self, parser):
        parser.add_argument("--dir", required=True, help="Directory containing the CSV exports")
        parser.add_argument(
            "--reset-handled", action="store_true", help="Also delete Dana's 'handled' flags"
        )

    def handle(self, *args, **options):
        if options["reset_handled"]:
            HandledFlag.objects.all().delete()
        report = load_all(Path(options["dir"]), settings.AS_OF_DATE)
        for name, count in report.counts.items():
            self.stdout.write(f"{name}: {count}")
        for note in report.notes:
            self.stdout.write(f"note[{note.kind}]: {note.count} — {note.message}")
