const path = require('path')
const AutoLoad = require('fastify-autoload')

module.exports = function (fastify, opts, next) {

    fastify.register(AutoLoad, {
        dir: path.join(__dirname, 'services'),
        options: Object.assign({}, opts)
    })

    next()
}
