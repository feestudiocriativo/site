# Site FE. Estúdio Criativo, com cases sincronizados do Behance

Todo dia, às 6h17 (horário de Brasília), o site lê o seu perfil no Behance.
Cada projeto novo entra sozinho na aba **Cases**, com capa, link e ano.
Nada é apagado: o que já está no site continua lá.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `site/index.html` | O site |
| `site/projects.json` | A lista de cases (atualizada automaticamente) |
| `site/img/` | Imagens dos destaques |
| `scripts/sync-behance.mjs` | A rotina que lê o Behance |
| `.github/workflows/sync-behance.yml` | Agenda a rotina e publica o site |

## Como colocar no ar (uma vez só, uns 10 minutos)

1. Crie uma conta grátis em github.com e um repositório novo (por exemplo `site-fe`).
2. Envie todo o conteúdo desta pasta para o repositório (botão **Add file → Upload files**; arraste tudo, inclusive a pasta `.github`).
3. Em **Settings → Secrets and variables → Actions → aba Variables**, crie a variável
   `BEHANCE_USER` com o seu usuário do Behance (o que vem depois de `behance.net/`).
4. Em **Settings → Pages**, em *Source*, escolha **GitHub Actions**.
5. Em **Actions → Sincronizar Behance e publicar site → Run workflow**. Em 1 minuto o site está no ar.
6. Para usar o domínio `fevieira.com`: em **Settings → Pages → Custom domain**, digite o domínio
   e siga as instruções de DNS. Só faça isso quando quiser sair do Adobe Portfolio.

## Depois de publicado

- **Postou no Behance?** Não precisa fazer nada. No dia seguinte ele aparece nos Cases.
  Para aparecer na hora: **Actions → Run workflow**.
- **O tipo veio errado** (ex.: “Ativação” em vez de “Corporativo”)? Edite o campo `type`
  daquele projeto em `site/projects.json`. A rotina não sobrescreve o que você corrigiu.
- **Quer um projeto no mosaico do topo?** Coloque `"featured": true` nele.
- **Esconder um projeto do site?** Coloque `"hideInIndex": true`.
- Projetos com capa aparecem em cards; os sem capa ficam na lista **Arquivo**.

## Limites do Behance

O feed público do Behance mostra só os projetos mais recentes (cerca de 12).
Por isso a rotina **acumula**: cada projeto que passa pelo feed fica salvo para sempre.
Projetos antigos, que já saíram do feed, continuam no site, mas sem capa até você adicionar
uma (campo `img` com o caminho da imagem).
