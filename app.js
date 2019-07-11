const ConfigProvider = require('./lib/config-provider')
const RPCClient = require('./lib/rpc-client')

const fastify = require('fastify')({
    logger: {
        level: 'info'
    }
})

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

fastify.get('/', function (request, reply) {
    reply.send('node-rpc-client-rabbitmq')
})

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

fastify.listen(3000, '0.0.0.0', (err, address) => {
    if (err) throw err
    fastify.log.info(`Fastify server is listening on ${address}`)
})
