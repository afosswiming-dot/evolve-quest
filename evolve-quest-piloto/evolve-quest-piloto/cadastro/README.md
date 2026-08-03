# EVOLVE Quest — Cadastro do Aventureiro

**Módulo:** Cadastro do Aventureiro  
**Versão integrada:** v1.2.1  
**Responsabilidade:** criar a autenticação e o perfil inicial do Aventureiro antes da Escolha da Jornada.

## Integração implementada

- Cadastro real pelo Supabase Auth.
- Senha enviada somente por HTTPS ao Supabase e nunca salva em `localStorage`.
- Criação automática de registro na tabela `public.profiles` por trigger do banco.
- Metadados gravados:
  - nome completo;
  - nome preferido;
  - e-mail;
  - WhatsApp;
  - data de nascimento;
  - aceite dos Termos e Política;
  - data do aceite;
  - papel `adventurer`;
  - status `journey_selection_pending`.
- Sessão persistida localmente apenas quando o Supabase devolve uma sessão autenticada.
- Perfil local mínimo mantido como contingência de navegação, sem senha.
- Redirecionamento preparado para `./escolha-da-jornada.html`.

## Comportamento de confirmação de e-mail

Se a confirmação de e-mail estiver habilitada no Supabase, o cadastro será criado sem sessão imediata. Nesse caso, o Aventureiro receberá a orientação de confirmar o e-mail antes de seguir.

## Pendências obrigatórias antes da publicação

- Substituir os conteúdos provisórios dos Termos de Uso e da Política de Privacidade pelos textos jurídicos definitivos.
- Garantir que `escolha-da-jornada.html` esteja no mesmo projeto ou atualizar a rota em `APP_CONFIG.routes.journeySelection`.
- Configurar no Supabase os URLs permitidos para autenticação e redirecionamento no domínio oficial.
- Integrar o módulo independente de Login à mesma sessão Supabase.

## Segurança

A chave incluída no front-end é a chave **publishable** do Supabase, própria para uso público no navegador. Nenhuma chave administrativa (`service_role` ou secret key) está presente no projeto.
