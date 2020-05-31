let config_data = null;

module.exports = function() {
    if(config_data != null && config_data != undefined) {
        return config_data;
    }

    // load JSON
    config_data = require('./credentials/dev.config.json');

    return config_data;
}