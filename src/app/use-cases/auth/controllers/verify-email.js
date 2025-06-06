// Importa o modelo do usuário para interagir com a coleção "users" no banco de dados
const User = require("../../../models/User");

// Importa o modelo de sessão para armazenar informações de autenticação do usuário
const Session = require("../../../models/Session");

// Importa a biblioteca moment.js para manipulação de datas e horários
const moment = require("moment");

// Importa a função para gerar um token de acesso (JWT)
const generateAccessToken = require("../../../utils/generate-access-token");

// Importa a função para gerar um token de atualização (JWT)
const generateRefreshToken = require("../../../utils/generate-refresh-token");

// Importa a função para criptografar o token de atualização antes de armazená-lo
const encryptRefreshToken = require("../../../utils/encrypt-refresh-token");

// Importa a função para transformar os dados do usuário antes de enviá-los para o frontend
const userTransformer = require("../../../utils/user-transformer");

// Define a função assíncrona para verificar o e-mail do usuário
const verifyEmail = async (req, res) => {
    try {
        // Extrai o token do corpo da requisição
        const { token } = req.body;

        // Verifica se o token foi enviado na requisição
        if (!token) {
            return res.status(400).json({ message: "Token de verificação é obrigatório" });
        }

        // Busca um usuário no banco de dados que tenha o token fornecido
        // e que ainda não tenha sido verificado
        const user = await User.findOne({ account_verification_token: token });

        // Se o usuário não for encontrado, retorna erro
        if (!user) {
            return res.status(400).json({ message: "Token inválido ou usuário já verificado" });
        }

        // Verifica se o token de verificação já expirou
        if (moment().isAfter(user.account_verification_token_expires)) {
            return res.status(400).json({ message: "Token expirado. Solicite um novo e-mail de verificação" });
        }

        // Atualiza o status da conta para "verified" (verificado)
        // Remove o token de verificação e sua data de expiração
        user.account_verification_status = "verified";
        user.account_verification_token = null;
        user.account_verification_token_expires = null;

        // Salva as alterações no banco de dados
        await user.save();

        if (user) {
            // Obtém o tempo de expiração dos tokens a partir das variáveis de ambiente
            // ou define valores padrão
            const expiresAccessToken = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '10m'; // Tempo de expiração do access token (padrão: 10 minutos)
            const expiresRefreshToken = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '1y'; // Tempo de expiração do refresh token (padrão: 1 ano)

            // Gera um access token (JWT) para autenticação do usuário
            const accessToken = generateAccessToken(user, expiresAccessToken);

            // Gera um refresh token (JWT) para permitir a renovação do access token
            const refreshToken = generateRefreshToken(user, expiresRefreshToken);

            // Criptografa o refresh token antes de armazená-lo no banco de dados
            const encryptedRefreshToken = encryptRefreshToken(refreshToken);

            // Cria uma nova sessão para armazenar informações de login do usuário
            const newSession = new Session({
                ip_address: req.ip, // IP do usuário que fez a solicitação
                user_agent: req.headers['user-agent'] || 'Unknown', // Agente de usuário do navegador/dispositivo
                crypto: {
                    key: encryptedRefreshToken.key, // Chave usada na criptografia do refresh token
                    iv: encryptedRefreshToken.iv // Vetor de inicialização da criptografia
                },
                authentication_method: "email", // Método de autenticação usado
                token: encryptedRefreshToken.encrypted_refresh_token, // Refresh token criptografado
                user: user._id, // ID do usuário autenticado
                expires_at: moment().add(1, 'y').toDate() // Define a data de expiração da sessão (1 ano)
            });

            // Salva a nova sessão no banco de dados
            await newSession.save(); 
            
            // Retorna uma resposta de sucesso com os tokens e informações do usuário
            return res.status(200).json({
                access_token: accessToken, // Token de acesso para autenticação
                session_id: newSession.id, // ID da sessão recém-criada
                user: userTransformer(user), // Transforma os dados do usuário antes de enviar ao frontend
                message: "E-mail verificado com sucesso"
            });
        }
    } catch (err) {
        // Em caso de erro, exibe no console e retorna uma resposta de erro ao cliente
        console.error("Erro ao verificar e-mail:", err);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
}

// Exporta a função para que possa ser usada em outras partes do projeto
module.exports = verifyEmail;
