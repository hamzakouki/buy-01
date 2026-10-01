pipeline {
    agent any

    stages {
        // ==========================================
        // CHECKOUT
        // ==========================================

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // ==========================================
        // SECRETS
        // ==========================================+

        stage('Prepare Secrets') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'cloudinary-url',
                        variable: 'CLOUDINARY_URL'
                    ),

                    file(
                        credentialsId: 'jwt-private-key',
                        variable: 'JWT_PRIVATE_KEY'
                    ),

                    file(
                        credentialsId: 'jwt-public-key',
                        variable: 'JWT_PUBLIC_KEY'
                    )
                ]) {
                    sh './scripts/prepare-secrets.sh'
                }
            }
        }

        // ==========================================
        // BACKEND TESTS
        // ==========================================

        stage('Backend Tests') {
            steps {
                script {
                    def services = [
                        'api-gateway',
                        'discovery-service',
                        'media-service',
                        'product-service',
                        'security-service',
                        'user-service'
                    ]

                    services.each { service ->
                        dir("backend/${service}") {
                            sh './mvnw clean test'
                        }
                    }
                }
            }
        }

        // ==========================================
        // BACKUP
        // ==========================================

        stage('Backup') {
            when {
                branch 'main'
            }

            steps {
                sh './scripts/backup.sh'
            }
        }

        // ==========================================
        // FRONTEND
        // ==========================================

        stage('Frontend Tests & Build') {
            steps {
                dir('frontend') {
                    sh 'npm ci'

                    sh 'npm test -- --watch=false'

                    sh 'npm run build'
                }
            }
        }

        // ==========================================
        // DOCKER BUILD
        // ==========================================

        stage('Docker Build') {
            steps {
                dir('backend') {
                    sh 'docker compose build'
                }
            }
        }

        // ==========================================
        // DEPLOY BACKEND
        // ==========================================

        stage('Deploy Backend') {
            when {
                branch 'main'
            }

            steps {
                script {
                    try {
                        sh './scripts/deploy-backend.sh'
                    // // exit 1
                    } catch (err) {
                        echo '❌ Déploiement Backend échoué'

                        echo '🔍 État des containers:'
                        sh 'docker compose -f backend/compose.yml ps -a || true'

                        echo '🔍 Logs user-service:'
                        sh 'docker compose -f backend/compose.yml logs --no-color user-service || true'

                        echo '🔍 Inspect user-service:'
                        sh 'docker inspect user-service || true'

                        echo '🔄 Rollback Backend...'
                        sh './scripts/rollback-backend.sh'

                        error(
                            '❌ Déploiement Backend échoué — rollback exécuté'
                        )
                    }
                }
            }
        }

        // ==========================================
        // DEPLOY FRONTEND
        // ==========================================

        stage('Deploy Frontend') {
            when {
                branch 'main'
            }

            steps {
                script {
                    try {
                        sh './scripts/deploy-frontend.sh'
                    } catch (err) {
                        echo '❌ Déploiement Frontend échoué'

                        echo '🔄 Rollback Frontend...'

                        sh './scripts/rollback-frontend.sh'

                        error(
                            '❌ Déploiement Frontend échoué — rollback exécuté'
                        )
                    }
                }
            }
        }
    }

    // ==========================================
    // POST ACTIONS
    // ==========================================

    post {
        always {
            junit(
                allowEmptyResults: true,
                testResults:
                    'backend/*/target/surefire-reports/*.xml, frontend/test-results/*.xml'
            )
        }

        success {
            echo '✅ Build réussi'

            emailext(
                subject:
                    "✅ Jenkins SUCCESS - ${env.JOB_NAME} #${env.BUILD_NUMBER}",

                body:
                    """Build réussi.

Job: ${env.JOB_NAME}
Build: #${env.BUILD_NUMBER}
Branch: ${env.BRANCH_NAME}
Commit: ${env.GIT_COMMIT}

URL Jenkins:
${env.BUILD_URL}""",

                to: 'koukihamza469@gmail.com'
            )
        }

        failure {
            echo '❌ Build échoué'

            emailext(
                subject:
                    "❌ Jenkins FAILURE - ${env.JOB_NAME} #${env.BUILD_NUMBER}",

                body:
                    """Build échoué.

Job: ${env.JOB_NAME}
Build: #${env.BUILD_NUMBER}
Branch: ${env.BRANCH_NAME}

Consulte les logs Jenkins:
${env.BUILD_URL}""",

                to: 'koukihamza469@gmail.com'
            )
        }
    }
}
