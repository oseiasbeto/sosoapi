// Importação dos modelos e utilitários necessários
const User = require("../../../models/User"); // Modelo de usuário para interagir com a coleção de usuários no banco de dados
const Session = require("../../../models/Session"); // Modelo de sessão para gerenciar sessões de autenticação dos usuários

// Importação de funções auxiliares para geração e manipulação de tokens
const generateAccessToken = require("../../../utils/generate-access-token"); // Função para gerar access token (JWT)
const generateRefreshToken = require("../../../utils/generate-refresh-token"); // Função para gerar refresh token
const encryptRefreshToken = require("../../../utils/encrypt-refresh-token"); // Função para criptografar o refresh token

// Importação de utilitários para transformar e processar dados do usuário
const userTransformer = require("../../../utils/user-transformer"); // Função para formatar os dados do usuário antes de retornar ao frontend
const generateSlugName = require("../../../utils/generate-slug-name"); // Função para gerar um nome de usuário baseado no nome real

// Biblioteca para manipulação de datas e horários
const moment = require('moment');

// Função principal de autenticação via Facebook
const facebookAuth = async (req, res) => {
    try {
        // Extração de dados do corpo da requisição
        const { facebook_id, picture, name, email } = req.body;

        // Validação do nome (obrigatório e deve ser uma string com pelo menos 1 caractere)
        if (!name || typeof name !== 'string' || name.length < 1) {
            return res.status(400).json({ message: "O nome é obrigatório e deve ter pelo menos 1 caractere" });
        }

        // Validação da imagem de perfil (se fornecida, deve ser uma string)
        if (picture && typeof picture !== 'string') {
            return res.status(400).json({ message: "picture deve ser uma string" });
        }

        // Validação do email (se fornecido, deve ser uma string e conter '@' e '.')
        if (email) {
            if (typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
                return res.status(400).json({ message: "Email deve ser uma string no formato válido" });
            }
        }

        // Variável para verificar se o usuário já existia antes do login
        let userHasExisits = false;

        // Definição dos tempos de expiração dos tokens (acessados a partir das variáveis de ambiente)
        const expiresAccessToken = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '10m'; // Padrão: 10 minutos
        const expiresRefreshToken = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '1y'; // Padrão: 1 ano

        // Verifica se já existe um usuário com o ID do Facebook fornecido
        let user = await User.findOne({ facebook_id });

        // Se o usuário não existir, cria um novo registro
        if (!user) {
            // Verifica se o e-mail já está em uso por um usuário verificado
            if (email) {
                const existingUser = await User.findOne({ email, account_verification_status: "verified" });
                if (existingUser) return res.status(400).json({ message: "Email já está em uso" });
            }

            // Gera um número aleatório para tornar o nome de usuário único
            const numbers = Math.floor(Math.random() * 10000);

            // Criação de um novo usuário
            user = new User({
                facebook_id, // ID do Facebook
                email: email || null, // E-mail (opcional)
                name, // Nome do usuário
                profile_image: { // Definição das imagens de perfil em diferentes resoluções
                    low: picture, 
                    original: picture, 
                    medium: picture, 
                    high: picture
                },
                account_verification_status: email ? 'verified' : "pending", // Status de verificação da conta
                username: email ? email.split("@")[0] + '.' + numbers : `${generateSlugName(fullName)}.${numbers}`, // Geração do nome de usuário
                password: null // Senha nula, pois a autenticação é via Facebook
            });

            await user.save(); // Salva o usuário no banco de dados
        } else {
            userHasExisits = true; // Usuário já existia antes do login
        }

        // Geração de tokens de autenticação
        const accessToken = generateAccessToken(user, expiresAccessToken); // Gera access token
        const refreshToken = generateRefreshToken(user, expiresRefreshToken); // Gera refresh token
        const encryptedRefreshToken = encryptRefreshToken(refreshToken); // Criptografa o refresh token

        // Criação de uma nova sessão para o usuário
        const newSession = new Session({
            ip_address: req.ip, // IP do usuário
            user_agent: req.headers['user-agent'] || 'Unknown', // User-agent do navegador/dispositivo
            crypto: {
                key: encryptedRefreshToken.key, // Chave de criptografia
                iv: encryptedRefreshToken.iv, // Vetor de inicialização
            },
            authentication_method: "facebook", // Método de autenticação
            token: encryptedRefreshToken.encrypted_refresh_token, // Refresh token criptografado
            user: user._id, // Referência ao usuário autenticado
            expires_at: moment().add(1, 'y').toDate() // Data de expiração da sessão (1 ano)
        });

        await newSession.save(); // Salva a sessão no banco de dados

        // Definição da resposta da API
        const status = !userHasExisits ? 201 : 200; // 201 se usuário foi criado, 200 se já existia
        const message = !userHasExisits ? "Usuário criado e autenticado com sucesso" : "Autenticação bem-sucedida"; // Mensagem apropriada

        return res.status(status).json({ // Resposta JSON
            access_token: accessToken, // Retorna o access token
            session_id: newSession.id, // Retorna o ID da sessão
            user: userTransformer(user), // Retorna os dados do usuário transformados
            message // Mensagem de sucesso
        });
    } catch (err) { // Captura e trata erros
        console.error('Erro no facebookAuth:', err); // Loga erro no console
        return res.status(500).json({ message: "Erro interno no servidor" }); // Retorna erro 500
    }
}

// Exporta a função para ser utilizada em outras partes do código
module.exports = facebookAuth;
