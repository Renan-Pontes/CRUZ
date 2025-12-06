import json
from pathlib import Path
from django.core.management.base import BaseCommand
from api.models import Medication, MedicationCategory, Challenge, ChallengeType, AtendimentoChallenge


DEFAULT_MEDS = {
    "A1": ["Morfina", "Fentanil", "Metadona"],
    "A2": ["Diazepam", "Lorazepam"],
    "B1": ["Ritalina", "Venvanse"],
    "B2": ["Frontal", "Lexotan"],
    "C1": ["Paracetamol", "Dipirona", "Ibuprofeno"],
    "C2": ["Amoxicilina", "Azitromicina"],
}

DEFAULT_ATENDIMENTOS = [
    {
        "title": "Venda de psicotrópico sem receita",
        "customer_scenario": "Cliente pede psicotrópico controlado sem receita.",
        "expected_response": "Explicar que só com receita válida, orientar procurar médico.",
    },
    {
        "title": "Antibiótico sem receita",
        "customer_scenario": "Cliente quer antibiótico apresentando foto da receita.",
        "expected_response": "Orientar que é preciso receita física ou eletrônica válida, não vender sem.",
    },
    {
        "title": "Analgesia leve",
        "customer_scenario": "Cliente com dor de cabeça leve, sem outros sintomas.",
        "expected_response": "Orientar analgésico OTC adequado, posologia, sinais de alerta.",
    },
]


class Command(BaseCommand):
    help = "Cria dados iniciais de demo (medicamentos e casos de atendimento)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--meds-json",
            type=str,
            help="Caminho para JSON no formato {\"A1\": [\"nome\"], ...}. Se não informado, usa defaults.",
        )

    def handle(self, *args, **options):
        meds_json = options.get("meds_json")
        if meds_json:
            path = Path(meds_json)
            if not path.exists():
                self.stderr.write(f"Arquivo não encontrado: {meds_json}")
                return
            data = json.loads(path.read_text())
            meds_data = {k.upper(): v for k, v in data.items()}
        else:
            meds_data = DEFAULT_MEDS

        self.stdout.write("Importando medicamentos...")
        for category, names in meds_data.items():
            if category not in {c[0] for c in MedicationCategory.choices}:
                self.stderr.write(f"Categoria inválida ignorada: {category}")
                continue
            for name in names:
                Medication.objects.get_or_create(name=name.strip(), category=category)
        self.stdout.write("Medicamentos importados.")

        self.stdout.write("Criando casos de atendimento demo...")
        for caso in DEFAULT_ATENDIMENTOS:
            challenge, _ = Challenge.objects.get_or_create(
                title=caso["title"],
                challenge_type=ChallengeType.ATENDIMENTO,
                defaults={"prompt": caso["customer_scenario"], "difficulty": 1},
            )
            AtendimentoChallenge.objects.get_or_create(
                challenge=challenge,
                defaults={
                    "customer_scenario": caso["customer_scenario"],
                    "expected_response": caso["expected_response"],
                },
            )
        self.stdout.write(self.style.SUCCESS("Seed concluído."))
