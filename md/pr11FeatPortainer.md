# 🐳 PR #11 – Feat-Portainer: Interface Visual para Gerenciamento Docker
### Portainer CE · docker-compose.yml · Volume Persistente

Décima primeira PR do projeto. Adiciona o Portainer CE ao ambiente de desenvolvimento — interface web para gerenciar todos os containers Docker visualmente, sem precisar de comandos no terminal.

> ✅ **Testada:** ambiente subindo com `docker-compose up --build`, Portainer acessível em `http://localhost:9000`

---

# 🧠 1. Decisões Tomadas

### Por quê Portainer?

O projeto já tem várias ferramentas com interface web (`RabbitMQ UI`, `Prisma Studio`) — faz sentido ter o mesmo para o Docker. Com o Portainer você consegue:

- Ver todos os containers rodando em tempo real
- Acompanhar logs de cada container com filtro
- Ver uso de CPU/memória/rede por container
- Reiniciar/parar containers com um clique
- Acessar o terminal de qualquer container pelo browser

### Por quê Portainer CE e não outra ferramenta?

É gratuito, leve, amplamente adotado e funciona com um único serviço no `docker-compose.yml` — sem configuração extra.

### Por quê não configurar senha via env?

O Portainer CE exige a senha em formato **bcrypt hash** quando passada via `--admin-password`, não em texto puro. Para desenvolvimento local isso adiciona complexidade desnecessária. A abordagem adotada foi deixar o Portainer criar o usuário na primeira vez que acessar `http://localhost:9000` — mais simples e sem gambiarras.

### Por quê volume persistente?

Sem o volume `portainer_data`, toda vez que rodar `docker-compose down -v` o usuário e configurações do Portainer seriam apagados — teria que recriar a senha sempre. Com o volume, a configuração persiste entre restarts.

---

# 📁 2. Arquivos Modificados

```
docker-compose.yml  ← serviço portainer + volume portainer_data adicionados
```

---

# ⚙️ 3. O que foi adicionado

### Serviço no `docker-compose.yml`

```yaml
portainer:
  image: portainer/portainer-ce:latest
  container_name: cinema-portainer
  ports:
    - "9000:9000"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock  # acesso ao Docker daemon
    - portainer_data:/data                        # persistência das configs
  networks:
    - cinema_network
  restart: unless-stopped
  logging:
    driver: "none"  # não polui o terminal

volumes:
  portainer_data:
```

### Por quê montar `/var/run/docker.sock`?

É o socket do Docker daemon — sem ele o Portainer não consegue listar nem gerenciar os containers. É o padrão para qualquer ferramenta de gerenciamento Docker local.

---

# 🗺️ 4. Endpoints do Ambiente Completo

| Serviço | URL |
|---|---|
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/api/docs |
| RabbitMQ UI | http://localhost:15672 |
| Prisma Studio | http://localhost:5555 |
| **Portainer** | **http://localhost:9000** |

---

# 🚀 5. Como usar

**Primeira vez:**
1. `docker-compose down -v && docker-compose up --build`
2. Acesse `http://localhost:9000`
3. Crie o usuário `admin` e defina uma senha (mínimo 12 caracteres)
4. Selecione **"Docker"** como ambiente e aponte para `unix:///var/run/docker.sock`
5. Pronto — todos os containers do projeto aparecem no dashboard

**Próximas vezes:**
- As credenciais ficam salvas no volume `portainer_data`
- Só logar com `admin` + senha criada

---

# ✅ 6. Checklist

- [x] Serviço `portainer` adicionado ao `docker-compose.yml`
- [x] Volume `portainer_data` declarado para persistência
- [x] Socket Docker montado via `/var/run/docker.sock`
- [x] `logging: driver: "none"` — não polui o terminal
- [x] `restart: unless-stopped` — reinicia automaticamente se cair
- [x] Porta `9000` exposta e acessível em `http://localhost:9000`
- [x] Ambiente testado com `docker-compose up --build`

---

*PR #11 · @you · status: aguardando revisão*