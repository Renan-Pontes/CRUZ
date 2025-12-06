from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import ActivityLog
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Cria logs de atividade dummy para testes."

    def handle(self, *args, **options):
        User = get_user_model()
        user = User.objects.first()
        if not user:
            self.stderr.write("Nenhum usuário encontrado para criar logs.")
            return
        entries = [
            ("login", "Usuário logado", {}),
            ("challenge_completed", "Separação concluída", {"correct": 8, "total": 10}),
            ("challenge_completed", "Atendimento respondido", {"score": 80}),
            ("level_up", "Subiu de nível", {"level": 2}),
        ]
        for act, msg, details in entries:
            ActivityLog.objects.create(
                user=user,
                activity_type=ActivityLog.ActivityType(act),
                message=msg,
                details=details,
                created_at=timezone.now(),
            )
        self.stdout.write(self.style.SUCCESS("Logs de atividade demo criados."))
