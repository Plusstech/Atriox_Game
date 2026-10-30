# Deploy na Hostinger

O jogo é **100% estático**. Ele não precisa de Node.js, banco de dados, WebSocket ou credenciais no servidor. Tudo o que vai para a hospedagem é o conteúdo de `dist/`.

## Como funciona

```
push na main  ──►  GitHub Actions (.github/workflows/deploy.yml)
                    npm ci → npm test → npm run build
                    └─► publica dist/ no branch  `deploy`
                                   │
Hostinger (Git)  ◄─────────────────┘  puxa o branch `deploy` para public_html
```

O branch `deploy` contém **somente o site pronto** (`index.html`, `bundle/`, `assets/`, `.htaccess`). A Hostinger não executa build, por isso o build é feito no GitHub.

## Opção A — Git da Hostinger (recomendado)

1. hPanel → **Sites** → seu domínio → **Avançado → Git**.
2. **Repositório:** `https://github.com/Plusstech/Atriox_Game.git`
   - Se o repositório for **privado**, use o endereço SSH `git@github.com:Plusstech/Atriox_Game.git`. Copie a chave SSH que a Hostinger mostra nessa tela e adicione-a no GitHub em *Settings → Deploy keys* (somente leitura).
3. **Branch:** `deploy`
4. **Diretório:** deixe vazio para publicar em `public_html`, ou informe uma subpasta, por exemplo `atriox`, para servir em `seudominio.com/atriox/`.
   - A Hostinger exige que o diretório de destino esteja **vazio** no primeiro deploy. Apague o `default.php` / `index.html` padrão antes.
5. Clique em **Criar** e depois em **Deploy**.
6. **Deploy automático:** na mesma tela, ative *Auto Deployment* e copie a **Webhook URL**. No GitHub, vá em *Settings → Webhooks → Add webhook*, cole a URL, use *Content type: application/json* e o evento *Just the push event*. A partir daí, cada push na `main` gera o build e a Hostinger puxa o resultado sozinha.

> O branch `deploy` só é atualizado depois que o workflow termina, em cerca de 1–2 minutos. Se a Hostinger puxar antes disso, clique em **Deploy** de novo.

## Opção B — Envio manual

```bash
npm install
npm run build
```

Envie **o conteúdo** da pasta `dist/`, não a pasta em si, para `public_html` pelo Gerenciador de Arquivos ou por FTP. Inclua o arquivo oculto `.htaccess`.

## Subdiretórios e caminhos

- O build usa `base: './'` (caminhos relativos), então funciona tanto na raiz quanto em qualquer subpasta sem reconfigurar.
- Para forçar um caminho absoluto: `VITE_BASE=/jogos/atriox/ npm run build`.
- Não há rotas no cliente, portanto não é preciso regra de reescrita para SPA.

## Checagem pós-deploy

1. Abra o site: o menu "ATRIOX CINDER" deve aparecer.
2. Se a tela ficar preta, o próprio jogo mostra uma mensagem de erro. Abra o console do navegador (F12) para ver o asset que falhou.
3. Uma partida completa leva de 5 a 10 minutos. O recorde fica salvo no `localStorage` do navegador.

## O que NÃO é necessário

- Node.js no servidor, PM2 ou "Aplicação Node" do hPanel.
- Banco de dados ou variáveis de ambiente secretas.
- Domínio especial ou HTTPS obrigatório (HTTPS é recomendado, mas o jogo não depende dele).
