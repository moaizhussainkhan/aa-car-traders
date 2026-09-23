# AA Car Traders — backend

See the main [README](../README.md).

```bash
pip install -r requirements.txt
cp .env.example .env      # edit SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
python tests/smoke_test.py   # optional: run the API self-test
```

Admin panel: http://localhost:8000/admin/login
