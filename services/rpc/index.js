const ConfigProvider = require('../../lib/config-provider')
const RPCClient = require('./rpc-client')

module.exports = function (fastify, opts, next) {
    const requestFuncs = ConfigProvider.funcConfig.requestFuncs

    const rpcClients = {}

    for (let func in requestFuncs) {
        rpcClients[func] = RPCClient({
            host: requestFuncs[func].host,
            port: requestFuncs[func].port,
            requestQueueName: requestFuncs[func].requestQueueName,
            logger: fastify.log,
            func: func
        })
        rpcClients[func].start()
    }

    fastify.post('/rpc', function (request, reply) {
        if (!request.query.func) {
            return reply.code(400).send({
                error: `func is required`
            })
        }

        if (!request.query.func || !rpcClients[request.query.func]) {
            return reply.code(400).send({
                error: `func ${request.query.func} is not registered`
            })
        }

        rpcClients[request.query.func].call(request.body)
            .then(res => {
                reply.code(res.code).send(res.body)
            })
            .catch(err => {
                reply.code(503).send({
                    error: err
                })
            })
    })

    fastify.get('/health', function (request, reply) {
        if (!request.query.func) {
            return reply.code(400).send({
                error: `func is required`
            })
        }

        if (!request.query.func || !rpcClients[request.query.func]) {
            return reply.code(400).send({
                error: `func ${request.query.func} is not registered`
            })
        }

        let status = rpcClients[request.query.func].checkStatus()

        if (status) {
            reply.code(200).send({
                status: 'UP'
            })
        } else {
            reply.code(503).send({
                status: 'DOWN'
            })
        }
    })

    next()
}
