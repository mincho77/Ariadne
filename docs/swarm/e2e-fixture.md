# Fixture E2E del adapter (AH-E-49)

Prueba automatizada del loop **Queued → run → handoff → Done** sin Hub HTTP.

```bash
node --test tests/swarm-fase2-3.test.js
# incluido en npm test
```

El caso `swarm E2E fixture` crea un sandbox en `/tmp`, mueve la tarea a Doing, registra handoff (+ jsonl) y completa con evidencia (AC marcados).

No escribe el ledger E2E real (`ledger: false`).
