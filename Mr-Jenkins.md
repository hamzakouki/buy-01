# 🚀 MR-Jenk — Pipeline CI/CD (Jenkins + Docker DinD)

Pipeline CI/CD local reliant GitHub à Jenkins, qui build, teste et déploie les microservices e-commerce via Docker-in-Docker (DinD).

```
GitHub → Webhook → Ngrok → Jenkins → Maven/Angular → Tests → Docker → Microservices
```

---

## 📦 Architecture — les 4 concepts Docker

| Concept | Rôle |
|---|---|
| **IMAGE** | Le modèle (ex: `jenkins/jenkins:2.568.3-jdk21`) |
| **CONTAINER** | L'instance créée depuis l'image (ex: `jenkins-blueocean`) |
| **VOLUME** | Le stockage persistant (`jenkins-data`, `jenkins-docker-certs`) |
| **DAEMON** | Le processus qui gère/exécute les containers (`dockerd`) |

```
image ──docker run──► container ──utilise──► volume
```

---

## 🧱 Les deux containers du projet

### `jenkins-blueocean` (le cerveau)
- Basé sur `jenkins/jenkins:2.568.3-jdk21`
- Contient : Jenkins, **Docker CLI** (pas le daemon), Node.js, Angular CLI, Chromium, plugins Jenkins
- Ne contient **pas** les microservices (api-gateway, product-service, mongodb...)
- Envoie des commandes Docker via le réseau (pas de socket local)

### `jenkins-docker` (le moteur)
- Basé sur `docker:dind` (Docker-in-Docker)
- Contient le **deuxième Docker daemon** (`dockerd #2`)
- C'est lui qui crée et exécute réellement les containers de l'application (api-gateway, services, mongodb, kafka...)

```
                    HOST
                     │
             Docker daemon #1
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
jenkins-blueocean        jenkins-docker
  (Jenkins + CLI)          (dockerd #2)
          │                     │
          └──── TCP/TLS :2376──►│
                                 ▼
                    api-gateway, product-service,
                    user-service, mongodb, kafka...
```

**Règle d'or :** Jenkins = commande, Docker CLI = outil, `dockerd` = moteur, container = résultat.
Jenkins **n'est pas** dans le chemin HTTP des requêtes vers l'application — c'est le réseau Docker qui route directement `client → jenkins-docker → api-gateway`.

---

## 🔌 Communication Docker CLI ↔ Docker Engine

Les deux containers étant séparés, la communication passe par **HTTP/TLS sur le réseau**, pas par un socket local.

- **Réseau Docker dédié** : `docker network create jenkins`
- **DNS interne** : `--network-alias docker` fait pointer le nom `docker` vers l'IP de `jenkins-docker` → d'où `DOCKER_HOST=tcp://docker:2376`
- **Port 2376** : API Docker exposée en TCP par `docker:dind`. Chaque commande (`docker build`, `docker run`...) devient un appel HTTP reçu par le Engine distant
- **mTLS obligatoire** : le serveur prouve son identité au client ET le client au serveur. Sans certificat valide → connexion refusée même si le port est ouvert

Variables clés côté Jenkins :
```
DOCKER_HOST=tcp://docker:2376
DOCKER_CERT_PATH=/certs/client
DOCKER_TLS_VERIFY=1
```

---

## 🌐 Chaîne Webhook → Ngrok → Jenkins

```
Developer → git push → GitHub → Webhook → Ngrok → localhost:8080 → Jenkins
```

- **GitHub** : stocke le code + envoie un `POST` HTTP au push/PR
- **Ngrok** : ne fait que **transporter** le trafic (tunnel Internet → `localhost:8080`), il ne lance rien
- **Jenkins** : expose `/github-webhook/`, parse le JSON, déclenche le job

---

## 📥 Installation & lancement de Ngrok

```bash
cd ~
curl -O https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
mkdir -p ~/.local/bin
mv ngrok ~/.local/bin/
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
ngrok config add-authtoken 3JPijVZkUwHS3JaWcjE0wbEYIqn_36YRWhS4D3nujmTXTRwLu
```

```bash
ngrok http 8080
```

---

## 📂 Volumes

| Volume | Chemin monté | Rôle |
|---|---|---|
| `jenkins-data` | `/var/jenkins_home` | Jobs, plugins, configs, credentials, workspaces |
| `jenkins-docker-certs` | `/certs/client` | Certificats TLS pour parler au Docker Engine distant |

---

## 🔄 Flow complet d'une Pull Request

```
Developer
   │ git push
   ▼
GitHub ──Webhook──► Ngrok ──► Jenkins (Checkout → Build → Tests)
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
              Tests ❌ → STOP                 Tests ✅ → Docker Build
                                                     │
                                                     ▼
                                          Docker Compose → Microservices
```

---

## 🌿 Best practice — Tester PR + `main` (avant ET après merge)

| Phase | Configuration Jenkins | Résultat |
|---|---|---|
| **Avant merge** | Discover pull requests → `Merging the pull request with the current target branch revision` | Simule le merge et le teste avant la fusion réelle |
| **Après merge** | Discover branches → `All branches` + Webhook sur l'event `push` | Rebuild automatique de `main` dès que la PR est mergée |

⚠️ Éviter `Both` pour "Discover PR" sauf besoin réel — ça double les builds inutilement.

Dans le Jenkinsfile, distinguer PR vs `main` avec `env.CHANGE_ID` (non-null seulement pour les PR) :
```groovy
stage('Deploy') {
    when {
        expression { env.CHANGE_ID == null } // seulement sur main
    }
    steps {
        sh 'docker compose up -d'
    }
}
```

---

## ⚡ Points essentiels à ne jamais oublier

1. **Docker CLI ≠ Docker Engine** — le CLI est un client, l'Engine exécute réellement, ils communiquent en HTTP/TLS.
2. **`--network-alias docker`** crée l'entrée DNS qui rend `tcp://docker:2376` valide.
3. **mTLS** : authentification dans les deux sens avant toute communication.
4. **Ngrok ne lance rien** : simple tunnel HTTP.
5. **Les tests sont une barrière** : en cas d'échec, le pipeline s'arrête avant le Docker Build.
6. **Isolation Jenkins / Docker Engine** dans deux containers séparés = sécurité (éviter qu'un pipeline compromis contrôle directement l'hôte).

---

## 🛠️ Commandes utiles (setup & nettoyage)

```bash
# Créer le réseau
docker network create jenkins

# Nettoyage complet
docker rm -f jenkins-blueocean jenkins-docker
docker volume rm jenkins-data jenkins-docker-certs
docker network rm jenkins

# Vérifications
docker volume ls | grep jenkins
docker network ls | grep jenkins
docker images | grep -E 'jenkins|myjenkins'
docker exec jenkins-docker docker ps
docker exec jenkins-docker docker info
```

---

## 🧠 Résumé en une phrase

> Une **image** est le modèle, un **container** est l'instance qui s'exécute, un **volume** conserve les données, et le **Docker daemon** est le moteur qui crée et gère tout cela.
>
> `jenkins-blueocean` contient Jenkins + Docker CLI, tandis que `jenkins-docker` contient le deuxième Docker daemon qui crée et exécute réellement les containers de l'application.