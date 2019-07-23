const amqp = require('amqplib')
const uuidv4 = require('uuid/v4')
const moment = require('moment')
const pino = require('pino')

const retryTimeout = 2000

const timeFormat = 'YYYYMMDDhhmmss'

const defaultOptions = {
    host: 'localhost',
    port: 5672,
    logger: pino()
}

function RPCClient(host, port, logger, func, instanceId) {
    this.mq = {
        host: host,
        port: port,
        connection: null,
        channel: null
    }

    this.logger = logger

    this.description = `Func-${func}-RPC-Client-${this.mq.host}:${this.mq.port}`

    this.rpcQueues = {
        requestQueueName: `${func}-request-queue`,
        replyQueueName: `${func}-reply-queue-${instanceId}`
    }

    this.requestDefers = new Map();

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
                this.logger.error(`${this.description} error = ${err}`)
                this.isReady = false
            })

            this.mq.connection.createConfirmChannel()
                .then(ch => {
                    this.mq.channel = ch

                    return this.mq.channel.assertQueue(this.rpcQueues.replyQueueName, { durable: true })
                })
                .then(q => {
                    this.logger.info(`${this.description} replyQueueName = ${this.rpcQueues.replyQueueName}`)

                    this.mq.channel.consume(this.rpcQueues.replyQueueName, msg => {
                        let message = msg.content.toString('utf8');

                        this.logger.info(`${this.description} Channel receive reply. replyQueueName = ${this.rpcQueues.replyQueueName}, correlationId = ${msg.properties.correlationId}, message = ${message}`)

                        if (this.requestDefers.has(msg.properties.correlationId)) {
                            this.logger.info(`${this.description} Channel reply correlationId map success. replyQueueName = ${this.rpcQueues.replyQueueName}, correlationId = ${msg.properties.correlationId}`)

                            let content = JSON.parse(msg.content.toString('utf8'))

                            this.requestDefers.get(msg.properties.correlationId).resolve(content.res)

                            this.requestDefers.delete(msg.properties.correlationId);
                        }

                        this.mq.channel.ack(msg)
                    })

                    return Promise.resolve()
                })
                .then(() => this.isReady = true)
                .catch(err => this.logger.error(`${this.description} channel error = ${err}`))
        }).catch(err => {
            this.logger.error(`${this.description} connection error = ${err}`)

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

    this.requestDefers.set(correlationId, requestDefer)

    let message = JSON.stringify(content);

    this.logger.info(`${this.description} Channel send request ... requestQueueName = ${this.rpcQueues.requestQueueName}, correlationId = ${correlationId}, message = ${message}`)

    this.mq.channel.sendToQueue(this.rpcQueues.requestQueueName,
        Buffer.from(message, 'utf8'), {
            persistent: true,
            correlationId: correlationId,
            replyTo: this.rpcQueues.replyQueueName
        }, err => {
            if (err !== null) {
                this.logger.error(`${this.description} Channel send request failed. requestQueueName = ${this.rpcQueues.requestQueueName}, correlationId = ${correlationId}, error = ${err}`)

                requestDefer.reject(`${this.description} unavailable. ${err}`)
            } else {
                this.logger.info(`${this.description} Channel send request success. requestQueueName = ${this.rpcQueues.requestQueueName}, correlationId = ${correlationId}`)
            }
        })

    return requestPromise
}

function build(options) {
    if ((typeof options.func) !== 'string') {
        throw Error('Options func is required.')
    }

    if ((typeof options.instanceId) !== 'string') {
        throw Error('Options instanceId is required.')
    }

    options.host = options.host || defaultOptions.host
    options.port = options.port || defaultOptions.port
    options.logger = options.logger || defaultOptions.logger

    return new RPCClient(options.host, options.port, options.logger, options.func, options.instanceId)
}

module.exports = build
