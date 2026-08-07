# EVOLVE Quest — Configurações Administrativas e Estrutura da Jornada v0.1

Módulo exclusivo para `profiles.role = 'admin'`.

## Áreas
- Visão geral
- Classes
- Níveis
- Capítulos
- Healers e permissões
- Auditoria

## Configuração
Substitua em `app.js`:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY';
```

## RPCs esperadas
- `is_admin()`
- `get_admin_settings_summary()`
- `create_adventurer_class(...)`
- `update_adventurer_class(...)`
- `archive_adventurer_class(...)`
- `create_adventurer_level(...)`
- `update_adventurer_level(...)`
- `archive_adventurer_level(...)`
- `create_chapter(...)`
- `update_chapter(...)`
- `activate_chapter(...)`
- `archive_chapter(...)`
- `get_admin_healers(...)`
- `promote_user_to_healer(...)`
- `change_administrative_role(...)`
- `update_healer_status(...)`
- `assign_adventurer_to_healer(...)`
- `update_platform_setting(...)`
- `get_admin_audit_logs(...)`

## Regras
- Nunca usar Service Role no navegador.
- Validar `auth.uid()` e `is_admin()` em todas as funções seguras.
- Classes, Níveis e Capítulos em uso devem ser arquivados, não excluídos.
- Alterações de catálogo não atualizam Aventureiros automaticamente.
- Auditoria é somente leitura no frontend.
- Promoções que exigirem Auth Admin API devem ocorrer em backend/Edge Function.
- Não alterar históricos, Avaliações, Registros, Checkpoints respondidos, XP ou Progressões concluídas.

## Estrutura sugerida de integração
```text
admin/
├── configuracoes/
├── classes/
├── niveis/
├── capitulos/
├── healers/
└── auditoria/
```

A v0.1 usa uma única página com abas internas, preparada para futura separação física das rotas.
