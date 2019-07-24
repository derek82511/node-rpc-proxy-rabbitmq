const os = require('os')
const fs = require('fs')
const logger = require('pino')()
const ConfigProvider = require('./lib/config-provider')
const RPCClient = require('./lib/rpc-client')

const protocols = ['http', 'https', 'http2', 'https2']

if (!protocols.includes(ConfigProvider.protocolConfig.protocol)) {
    logger.error(`Protocol : ${ConfigProvider.protocolConfig.protocol} is not supported.`)
    process.exit(1)
}

const isHttp2 = ConfigProvider.protocolConfig.protocol === 'http2' || ConfigProvider.protocolConfig.protocol === 'https2'
const isHttps = ConfigProvider.protocolConfig.protocol === 'https' || ConfigProvider.protocolConfig.protocol === 'https2'

if (isHttps) {
    if (typeof (ConfigProvider.protocolConfig.ssl) === 'undefined'
        || typeof (ConfigProvider.protocolConfig.ssl.keyPath) === 'undefined'
        || typeof (ConfigProvider.protocolConfig.ssl.certPath) === 'undefined') {
        logger.error('Https required ssl privateKey path & certificate path.')
        process.exit(1)
    }
}

logger.info(`Use protocol [${ConfigProvider.protocolConfig.protocol}] for RPC proxy.`)

const fastifyOptions = {
    http2: isHttp2,
    logger: {
        level: 'info'
    }
}

if (isHttps) {
    fastifyOptions.https = {
        key: fs.readFileSync(ConfigProvider.protocolConfig.ssl.keyPath),
        cert: fs.readFileSync(ConfigProvider.protocolConfig.ssl.certPath)
    }
}

const fastify = require('fastify')(fastifyOptions)

const instanceId = `${os.hostname()}-${(typeof (process.env.pm_id) === 'undefined' ? 'default' : process.env.pm_id)}`

const requestFuncs = ConfigProvider.funcConfig.requestFuncs

const rpcClients = {}

for (let func in requestFuncs) {
    rpcClients[func] = RPCClient({
        host: requestFuncs[func].host,
        port: requestFuncs[func].port,
        logger: fastify.log,
        func: func,
        instanceId: instanceId
    })
    rpcClients[func].start()
}

fastify.get('/', function (request, reply) {
    reply.send(`node-rpc-client-rabbitmq instanceId = ${instanceId}`)
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
    for (var func in rpcClients) {
        if (!rpcClients[func].checkStatus()) {
            return reply.code(503).send({
                status: 'DOWN'
            })
        }
    }

    reply.code(200).send({
        status: 'UP'
    })
})

fastify.get('/health/:func', function (request, reply) {
    if (!request.params.func) {
        return reply.code(400).send({
            error: `func is required`
        })
    }

    if (!request.params.func || !rpcClients[request.params.func]) {
        return reply.code(400).send({
            error: `func ${request.params.func} is not registered`
        })
    }

    let status = rpcClients[request.params.func].checkStatus()

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
