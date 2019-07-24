const os = require('os')
const logger = require('pino')()
const ConfigProvider = require('./lib/config-provider')
const RPCClient = require('./lib/rpc-client')

logger.info(`Use protocol [${ConfigProvider.protocolConfig.protocol}] for RPC proxy.`)

const instanceId = `${os.hostname()}-${(typeof (process.env.pm_id) === 'undefined' ? 'default' : process.env.pm_id)}`

const requestFuncs = ConfigProvider.funcConfig.requestFuncs

const rpcClients = {}

for (let func in requestFuncs) {
    rpcClients[func] = RPCClient({
        host: requestFuncs[func].host,
        port: requestFuncs[func].port,
        logger: logger,
        func: func,
        instanceId: instanceId
    })
    rpcClients[func].start()
}

const grpc = require('grpc')
const protoLoader = require('@grpc/proto-loader')

const rpcPackageDefinition = protoLoader.loadSync('protos/rpc.proto')
const rpcProtoDescriptor = grpc.loadPackageDefinition(rpcPackageDefinition)

const server = new grpc.Server()

server.addService(rpcProtoDescriptor.RPCService.service, {
    index: (call, callback) => {
        callback(null, {
            body: `node-rpc-client-rabbitmq instanceId = ${instanceId}`
        })
    },
    rpc: (call, callback) => {
        if (!call.request.func) {
            return callback(null, {
                error: `func is required`
            })
        }

        if (!call.request.func || !rpcClients[call.request.func]) {
            return callback(null, {
                error: `func ${call.request.func} is not registered`
            })
        }

        rpcClients[call.request.func].call(JSON.parse(call.request.body))
            .then(res => {
                callback(null, {
                    body: JSON.stringify(res.body)
                })
            })
            .catch(err => {
                callback(null, {
                    error: err
                })
            })
    },
    health: (call, callback) => {
        if (call.request.func) {
            if (!call.request.func || !rpcClients[call.request.func]) {
                return callback(null, {
                    error: `func ${call.request.func} is not registered`
                })
            }

            let status = rpcClients[call.request.func].checkStatus()

            if (status) {
                callback(null, {
                    body: JSON.stringify({
                        status: 'UP'
                    })
                })
            } else {
                callback(null, {
                    body: JSON.stringify({
                        status: 'DOWN'
                    })
                })
            }
        } else {
            for (var func in rpcClients) {
                if (!rpcClients[func].checkStatus()) {
                    return callback(null, {
                        body: JSON.stringify({
                            status: 'DOWN'
                        })
                    })
                }
            }

            callback(null, {
                body: JSON.stringify({
                    status: 'UP'
                })
            })
        }
    }
})

const address = '0.0.0.0:3000'

server.bind(address, grpc.ServerCredentials.createInsecure())
server.start()
logger.info(`GRPC server is listening on ${address}`)
