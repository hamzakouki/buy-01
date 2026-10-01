FROM jenkins/jenkins:2.568.3-jdk21

ENV CASC_JENKINS_CONFIG=/var/jenkins_home/casc_configs/jenkins-casc.yaml
ENV CHROME_BIN=/usr/bin/chromium



USER root

RUN apt-get update && apt-get install -y lsb-release ca-certificates curl && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce-cli && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs chromium && \
    npm install -g @angular/cli && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY jenkins-casc.yaml /var/jenkins_home/casc_configs/jenkins-casc.yaml
 
USER jenkins

RUN jenkins-plugin-cli --plugins "blueocean docker-workflow json-path-api configuration-as-code email-ext github github-branch-source job-dsl pipeline-stage-view"