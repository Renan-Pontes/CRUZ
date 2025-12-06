# Backend (Django + DRF)

API para autenticação e minigames (atendimento, separação de medicamentos, 7 erros).

## Requisitos
- Python 3.13
- Pipenv/venv ou similar

## Setup e execução
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
# opcional: popular dados demo
python manage.py seed_demo
python manage.py runserver 0.0.0.0:8000
```

## Endpoints e documentação
- Schema OpenAPI: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`
- Redoc: `GET /api/redoc/`

Autenticação principal: header `Authorization: Session <token>` (ou `X-Session-Token`).

## Principais rotas
- Saúde: `GET /api/health/`
- Auth: register/login/logout/me/sessions
- Perfil/Badges/Leaderboard/Learning Path
- Minigames:
  - Separação: `/api/challenges/separacao/` (+ start/attempt/answer)
  - Atendimento: `/api/challenges/atendimento/` (+ submit)
  - 7 erros: `/api/challenges/find-errors/...` (start/attempt/submit/image)
- Medicamentos:
  - `GET /api/medications/`
  - `POST /api/medications/import/` (admin) com JSON `{ "data": { "A1": ["remédio"], ... }, "replace": false }`

## Seeds e utilitários
- `python manage.py seed_demo` para medicamentos/casos de atendimento (aceita `--meds-json`).
- `python manage.py seed_demo_logs` cria ActivityLogs de teste.

## Imagens (7 erros)
Defina `FIND_ERRORS_IMAGE_ROOT` (default: `<BASE_DIR>/imagens`) com estrutura:
```
imagens/
  A/<Erro>/arquivo.jpg
  B/<Erro>/arquivo.jpg
  C/<Erro>/arquivo.jpg
```
API retorna `image_url` e serve via `/api/challenges/find-errors/image/<path>/`.

## Configuração extra
- CORS: `CORS_ALLOWED_ORIGINS` (default inclui localhost:8081).
- LLM atendimento (opcional): `ATENDIMENTO_LLM_ENDPOINT` (default Ollama), `ATENDIMENTO_LLM_MODEL`.

## XP/nível
XP por minigame combina acerto (50%), tempo (20%, cap 10min) e streak (30%). Level: 100 XP por nível.
