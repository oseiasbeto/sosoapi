// Importa o modelo User para interagir com os dados de usuários no banco de dados
const User = require("../../../models/User");

// Importa o modelo Session para gerenciar sessões de usuários
const Session = require("../../../models/Session");

// Importa a biblioteca moment para manipulação de datas e horários
const moment = require('moment');

// Importa a biblioteca axios para fazer requisições HTTP
const axios = require('axios');

// Importa a função para gerar um token de acesso (JWT)
const generateAccessToken = require("../../../utils/generate-access-token");

// Importa a função para gerar um token de atualização (JWT)
const generateRefreshToken = require("../../../utils/generate-refresh-token");

// Importa a função para criptografar o token de atualização antes de armazená-lo
const encryptRefreshToken = require("../../../utils/encrypt-refresh-token");

// Importa a função para transformar os dados do usuário antes de enviá-los para o frontend
const userTransformer = require("../../../utils/user-transformer");

// Define a função de autenticação via Google OAuth
const googleAuth = async (req, res) => {
    try {
        // Extrai o token recebido no corpo da requisição
        const { token } = req.body;

        // Verifica o token com a API do Google para obter os dados do usuário
        const response = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
            headers: { Authorization: `Bearer ${token}` } // Envia o token no cabeçalho da requisição
        });

        // Armazena os dados do usuário retornados pelo Google
        const googleUser = response.data;

        // Verifica se o e-mail do Google foi validado
        if (!googleUser.email_verified) {
            return res.status(401).send({ error: 'Email do Google não verificado' });
        }

        // Variável para verificar se o usuário já existia antes da autenticação
        let userHasExisits = false;

        // Procura um usuário no banco de dados com o e-mail e ID do Google
        let user = await User.findOne({
            email: googleUser.email,
            google_id: googleUser.sub,
            account_verification_status: "verified"
        });

        // Se o usuário não for encontrado, tenta verificar se o e-mail já está cadastrado
        if (!user) {
            const email = googleUser.email;
            if (email) {
                // Verifica se já existe um usuário com o mesmo e-mail no banco de dados
                const existingUser = await User.findOne({ email, account_verification_status: "verified" });
                if (existingUser) return res.status(400).json({ message: "Email já está em uso" });
            }

            // Cria um novo usuário com os dados obtidos pelo Google
            user = new User({
                google_id: googleUser.sub, // ID único do Google
                email: googleUser.email, // E-mail do usuário
                profile_image: {
                    low: googleUser.picture, // URL da imagem de perfil em baixa qualidade
                    original: googleUser.picture, // URL da imagem original
                    medium: googleUser.picture, // URL da imagem em qualidade média
                    high: googleUser.picture // URL da imagem em alta qualidade
                },
                username: email.split("@")[0] + '.' + Math.floor(Math.random() * 10000), // Gera um nome de usuário único baseado no e-mail
                name: googleUser.name, // Nome do usuário
                account_verification_status: "verified", // Define que a conta está verificada
                password: null // Usuário autenticado pelo Google não precisa de senha
            });

            // Salva o novo usuário no banco de dados
            await user.save();
        } else {
            // Se o usuário já existia, atualiza a variável de controle
            userHasExisits = true;
        }

        // Obtém os tempos de expiração dos tokens a partir das variáveis de ambiente ou usa valores padrão
        const expiresAccessToken = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '10m'; // Tempo de expiração do access token
        const expiresRefreshToken = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '1y'; // Tempo de expiração do refresh token

        // Gera um access token para autenticação
        const accessToken = generateAccessToken(user, expiresAccessToken);

        // Gera um refresh token para manter a sessão do usuário ativa
        const refreshToken = generateRefreshToken(user, expiresRefreshToken);

        // Criptografa o refresh token antes de armazená-lo
        const encryptedRefreshToken = encryptRefreshToken(refreshToken);

        // Cria uma nova sessão para o usuário autenticado
        const newSession = new Session({
            ip_address: req.ip, // Armazena o endereço IP do usuário
            user_agent: req.headers['user-agent'] || 'Unknown', // Armazena o agente do usuário (navegador/dispositivo)
            crypto: {
                key: encryptedRefreshToken.key, // Chave de criptografia do refresh token
                iv: encryptedRefreshToken.iv // Vetor de inicialização da criptografia
            },
            authentication_method: "google", // Define que o método de autenticação foi pelo Google
            token: encryptedRefreshToken.encrypted_refresh_token, // Armazena o refresh token criptografado
            user: user._id, // Referência ao usuário autenticado
            expires_at: moment().add(1, 'y').toDate() // Define a data de expiração da sessão para 1 ano a partir de agora
        });

        await newSession.save(); // Salva sessão no banco

        // Define o status HTTP e a mensagem de resposta com base na criação do usuário
        const status = !userHasExisits ? 201 : 200; // 201 se o usuário foi criado, 200 se já existia
        const message = !userHasExisits ? "Usuário criado e autenticado com sucesso" : "Autenticação bem-sucedida";

        // Retorna a resposta da autenticação com o token, ID da sessão e dados do usuário transformados
        return res.status(status).json({ 
            access_token: accessToken, // Retorna o access token para o frontend
            session_id: newSession.id, // ID da sessão criada
            user: userTransformer(user), // Transforma os dados do usuário antes de enviar
            message // Mensagem de sucesso
        });
    } catch (err) { 
        // Em caso de erro, registra no console e retorna um erro interno do servidor
        console.error('Erro ao autenticar com google:', err); 
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
}

// Exporta a função googleAuth para ser usada em outros módulos do projeto
module.exports = googleAuth;
