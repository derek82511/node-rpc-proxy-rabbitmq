const yamlReader = require('./yaml-reader')

module.exports = {
    funcConfig: yamlReader(__dirname + '/../config/config-func.yaml')
}
