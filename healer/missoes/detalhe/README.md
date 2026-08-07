# Pré-visualização editorial da Missão

Rota sugerida:

```text
/healer/missoes/detalhe/?mission_id=UUID
```

A página usa `get_mission_editor_detail(p_mission_id uuid)` e é somente leitura.

Ela não cria:

- `mission_execution`;
- progresso;
- Registro da Missão;
- conclusão de exercícios;
- atribuições.
