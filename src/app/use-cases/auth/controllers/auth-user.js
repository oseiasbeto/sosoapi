// Importa o modelo de Usuário para interagir com a coleção "users" no banco de dados
const User = require("../../../models/User");

// Importa o modelo de Sessão para armazenar informações de login do usuário
const Session = require("../../../models/Session");

// Importa a biblioteca bcryptjs para comparar a senha fornecida com a armazenada no banco
const bcrypt = require("bcryptjs");

// Importa a biblioteca moment.js para manipulação de datas e horários
const moment = require("moment");

// Importa a função para gerar um token de acesso (JWT)
const generateAccessToken = require("../../../utils/generate-access-token");

// Importa a função para gerar um token de atualização (JWT)
const generateRefreshToken = require("../../../utils/generate-refresh-token");

// Importa a função para criptografar o token de atualização antes de armazená-lo
const encryptRefreshToken = require("../../../utils/encrypt-refresh-token");

// Define a função assíncrona para autenticação do usuário
const authUser = async (req, res) => {
  try {
    // Extrai email e senha do corpo da requisição
    const { email, password } = req.body;

    // Validação do e-mail
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res
        .status(400)
        .json({ message: "Por favor, forneça um e-mail válido" });
    }

    // Validação da senha
    if (!password) {
      return res.status(400).json({ message: "A senha é obrigatória" });
    }

    // Busca o usuário pelo e-mail no banco de dados
    const user = await User.findOne({ email }).select(
      "username name verified account_verification_status activity_status blocked_users gender posts_count subscribers following password following_count followers followers_count bio email website cover_photo profile_image"
    );


    // Se o usuário não for encontrado, retorna erro de credenciais inválidas
    if (!user) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }    
    
    // Verifica se a conta do usuário está verificada
    if (user.account_verification_status !== "verified") {
      return res
        .status(403)
        .json({
          message: "Por favor, verifique seu e-mail antes de fazer login",
        });
    }

    // Compara a senha fornecida com a senha criptografada armazenada no banco
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // Se a senha estiver incorreta, retorna erro de credenciais inválidas
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    // Obtém os tempos de expiração dos tokens das variáveis de ambiente ou define valores padrão
    const expiresAccessToken = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "10m"; // Tempo de expiração do access token (padrão: 10 minutos)
    const expiresRefreshToken =
      process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || "1y"; // Tempo de expiração do refresh token (padrão: 1 ano)

    // Gera um access token (JWT) para autenticação do usuário
    const accessToken = generateAccessToken(user, expiresAccessToken);

    // Gera um refresh token (JWT) para permitir a renovação do access token
    const refreshToken = generateRefreshToken(user, expiresRefreshToken);

    // Criptografa o refresh token antes de armazená-lo no banco de dados
    const encryptedRefreshToken = encryptRefreshToken(refreshToken);

    // Cria uma nova sessão para armazenar informações de login do usuário
    const newSession = new Session({
      ip_address: req.ip, // Captura e armazena o endereço IP do usuário
      user_agent: req.headers["user-agent"] || "Unknown", // Captura e armazena o agente do usuário (navegador/dispositivo)
      crypto: {
        key: encryptedRefreshToken.key, // Chave utilizada na criptografia do refresh token
        iv: encryptedRefreshToken.iv, // Vetor de inicialização usado na criptografia
      },
      authentication_method: "email", // Define o método de autenticação utilizado
      token: encryptedRefreshToken.encrypted_refresh_token, // Armazena o refresh token criptografado
      user: user._id, // Relaciona a sessão ao usuário autenticado
      expires_at: moment().add(1, "y").toDate(), // Define a data de expiração da sessão para 1 ano
    });

    // Salva a nova sessão no banco de dados
    await newSession.save();

    // Retorna uma resposta de sucesso com os tokens e informações do usuário
    return res.status(200).json({
      access_token: accessToken, // Retorna o access token para autenticação
      session_id: newSession.id, // ID da sessão recém-criada
      user,
      message: "Login realizado com sucesso", // Mensagem de sucesso para o usuário
    });
  } catch (err) {
    // Registra o erro no console para depuração
    console.log(err.message);

    // Retorna um erro 500 para indicar falha interna no servidor
    return res.status(500).send({
      message:
        "Erro interno do servidor. Por favor, tente novamente mais tarde.",
    });
  }
};

// Exporta a função para ser utilizada em outras partes do projeto
module.exports = authUser;
