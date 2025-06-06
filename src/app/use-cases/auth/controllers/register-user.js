// Importa o modelo User para interagir com os dados de usuários no banco de dados
const User = require("../../../models/User");

// Importa a biblioteca bcryptjs para criptografar senhas
const bcrypt = require("bcryptjs");

// Importa a biblioteca moment para manipular datas e horários
const moment = require("moment");

// Importa a função sendMail, responsável por enviar e-mails
const sendMail = require("../../../mail/send-mail");

// Importa a função randomUUID da biblioteca crypto para gerar um identificador único
const { randomUUID } = require("crypto");

// Define a função de registro de usuário
const registerUser = async (req, res) => {
    try {
        // Extrai os dados enviados pelo cliente no corpo da requisição
        const { name, email, password } = req.body;

        // Validação do nome: verifica se foi fornecido e tem pelo menos 3 caracteres
        if (!name || name.trim().length < 3) {
            return res.status(400).json({ message: "O nome deve ter pelo menos 3 caracteres" });
        }

        // Validação do e-mail: verifica se o formato é válido usando uma expressão regular
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({ message: "Por favor, forneça um e-mail válido" });
        }

        // Validação da senha: verifica se foi fornecida e se tem pelo menos 6 caracteres
        if (!password || password.length < 6) {
            return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
        }

        // Verifica se já existe um usuário com este e-mail e se a conta está verificada
        const existingUser = await User.findOne({ email, account_verification_status: "verified" });
        if (existingUser) {
            return res.status(400).json({ message: "Este e-mail já está em uso" });
        }

        // Gera um salt (valor aleatório) para aumentar a segurança do hash da senha
        const salt = await bcrypt.genSalt(10);

        // Gera o hash da senha utilizando o salt gerado
        const hashedPassword = await bcrypt.hash(password, salt);

        // Gera um token único para a verificação de e-mail
        const accountVerificationToken = randomUUID();

        // Define a data de expiração do token (1 dia a partir do momento da criação)
        const accountVerificationTokenExpires = moment().add(1, 'd');

        // Cria um novo usuário com os dados fornecidos
        const newUser = new User({
            // Gera um nome de usuário baseado no e-mail + um número aleatório
            username: email.split("@")[0] + '.' + Math.floor(Math.random() * 10000),
            name, // Nome do usuário
            email, // E-mail do usuário
            password: hashedPassword, // Senha criptografada
            account_verification_token: accountVerificationToken, // Token para verificação do e-mail
            account_verification_token_expires: accountVerificationTokenExpires // Data de expiração do token
        });

        // Salva o novo usuário no banco de dados
        await newUser.save();

        // Se o usuário foi salvo com sucesso, envia um e-mail de verificação
        if (newUser) {
            // Define o título e a mensagem do e-mail de confirmação
            const title = "Confirme seu cadastro";
            const message = "Para concluir seu cadastro no 1kole, clique no botão abaixo para confirmar seu e-mail:";

            // Cria o link de confirmação de e-mail
            const confirmLink = process.env.CLIENT_URL + 'account/verify-email?token=' + newUser.account_verification_token;

            // Envia o e-mail de confirmação usando a função sendMail
            sendMail(newUser.email, "confirm-email", title, { confirmLink, title, message });

            // Retorna uma resposta de sucesso para o cliente
            res.status(201).json({ message: "Usuário registrado com sucesso" });
        }
    } catch (err) {
        // Captura e exibe erros no console
        console.error('Erro ao registrar usuario:', err);

        // Retorna um erro interno do servidor
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
}

// Exporta a função registerUser para ser usada em outras partes do projeto
module.exports = registerUser;
