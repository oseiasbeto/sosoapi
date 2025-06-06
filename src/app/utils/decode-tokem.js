const { verify } = require("jsonwebtoken");

const decodeTokem = (token, secreetKey) => {
    try {
        const decoded = verify(token, secreetKey)
        return decoded
    } catch (error) {
        throw new Error('Token invalid.')
    }
}

module.exports = decodeTokem