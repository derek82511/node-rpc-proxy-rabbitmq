module.exports = function (fastify, opts, next) {

    fastify.get('/', function (request, reply) {
        reply.send('node-rpc-client-rabbitmq')
    })

    next()
}
