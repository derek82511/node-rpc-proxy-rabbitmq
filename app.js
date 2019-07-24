const ConfigProvider = require('./lib/config-provider')

if (ConfigProvider.protocolConfig.protocol === 'grpc') {
    require('./grpc-server')
} else {
    require('./http-server')
}
