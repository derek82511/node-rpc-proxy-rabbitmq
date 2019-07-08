const amqp = require('amqplib')
const uuidv4 = require('uuid/v4')
const moment = require('moment')
const pino = require('pino')

const retryTimeout = 2000

const timeFormat = 'YYYYMMDDhhmmss'

const defaultOptions = {
    host: 'localhost',
    port: 5672,
    logger: pino(),
    func: 'default'
}

function RPCClient(host, port, requestQueueName, logger, func) {
    this.mq = {
        host: host,
        port: port,
        connection: null,
        channel: null
    }

    this.logger = logger

    this.description = `Func-${func}-RPC-Client-${this.mq.host}:${this.mq.port}`

    this.rpcQueues = {
        requestQueueName: requestQueueName,
        replyQueueName: null
    }

    this.requestDefers = {}

    this.isReady = false
}

RPCClient.prototype.start = function () {
    amqp.connect(`amqp://${this.mq.host}:${this.mq.port}`)
        .then(conn => {
            this.mq.connection = conn

            this.mq.connection.on('close', () => {
                this.logger.error(`${this.description} close`)
                this.isReady = false

                setTimeout(this.start.bind(this), retryTimeout)
            })

            this.mq.connection.on('error', err => {
                this.logger.error(`${this.description} error : ${err}`)
                this.isReady = false
            })

            this.mq.connection.createConfirmChannel()
                .then(ch => {
                    this.mq.channel = ch

                    return this.mq.channel.assertQueue('', { exclusive: true })
                })
                .then(q => {
                    this.rpcQueues.replyQueueName = q.queue

                    this.logger.info(`${this.description} replyQueueName : ${this.rpcQueues.replyQueueName}`)

                    this.mq.channel.consume(this.rpcQueues.replyQueueName, msg => {
                        if (this.requestDefers[msg.properties.correlationId]) {
                            this.logger.info(`${this.description} Channel receive reply. correlationId = ${msg.properties.correlationId}`)

                            let content = JSON.parse(msg.content.toString('utf8'))

                            this.requestDefers[msg.properties.correlationId].resolve(content.res)
                        }

                        this.mq.channel.ack(msg)
                    })

                    return Promise.resolve()
                })
                .then(() => this.isReady = true)
                .catch(err => this.logger.error(`${this.description} channel err ${err}`))
        }).catch(err => {
            this.logger.error(`${this.description} connection err ${err}`)

            setTimeout(this.start.bind(this), retryTimeout)
        })
}

RPCClient.prototype.checkStatus = function () {
    return this.isReady
}

RPCClient.prototype.call = function call(body) {
    let now = moment().format(timeFormat)

    let correlationId = `${now}-${uuidv4()}`

    let content = {
        req: {
            body: body
        }
    }

    let requestDefer = {}

    let requestPromise = new Promise((resolve, reject) => {
        requestDefer.resolve = resolve
        requestDefer.reject = reject
    })

    this.requestDefers[correlationId] = requestDefer

    this.logger.info(`${this.description} Channel send request ... correlationId = ${correlationId}`)

    this.mq.channel.sendToQueue(this.rpcQueues.requestQueueName,
        Buffer.from(JSON.stringify(content), 'utf8'), {
            persistent: true,
            correlationId: correlationId,
            replyTo: this.rpcQueues.replyQueueName
        }, err => {
            if (err !== null) {
                this.logger.error(`${this.description} Channel send request failed. correlationId = ${correlationId}`)

                requestDefer.reject(`${this.description} unavailable`)
            } else {
                this.logger.info(`${this.description} Channel send request success. correlationId = ${correlationId}`)
            }
        })

    return requestPromise
}

function build(options) {
    options.host = options.host || 'localhost'
    options.port = options.port || 5672

    if ((typeof options.requestQueueName) !== 'string') {
        throw Error('Options requestQueueName is required.')
    }

    options.logger = options.logger || pino()
    options.func = options.func || 'default'

    return new RPCClient(options.host, options.port, options.requestQueueName, options.logger, options.func)
}

module.exports = build
