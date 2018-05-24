const request = require('request');

function Electricity(host, username, password) {
    if (host[host.length - 1] === '/') {
        host = host.substr(0, host.length - 2);
    }

    this.host = host;
    this.username = username;
    this.password = password;
}

Electricity.prototype._request = function(method, url, body, headers) {
    return new Promise((resolve, reject) => {
        request({
            uri: url,
            method: method,
            json: body,
            headers: Object.assign({
                'Content-Type': 'application/json'
            }, headers || {})
        }, function (err, resp, body) {
            if (err) return reject(err);
            if (resp.statusCode < 200 || resp.statusCode >= 300) {
                return reject('statusCode was not 2xx but ' + resp.statusCode);
            }
            resolve(body);
        });
    });
};

Electricity.prototype.authenticate = async function() {
    let body = await this._request('POST', this.host + '/rest/ctcapi/v2/auth/login', {
        username: this.username,
        password: this.password
    });

    if (!body.success) return rej('Request failed ' + JSON.stringify(body));

    this._authToken = body.token;

    return true;
};

Electricity.prototype.getAllDevices = async function() {
    if (!this._authToken) throw 'Not authenticated yet';

    let body = await this._request('GET', this.host + '/api/devices', null, {
        'x-access-token': this._authToken
    });

    body = JSON.parse(body);

    return body.devices.map(this._mapDevice);
};

Electricity.prototype._mapDevice = function(device) {
    let o = {
        name: device.name,
        serviceId: device.serviceId,
        externalId: device.externalId,
        id: device.id,
        deviceType: device.deviceType,
        resources: {}
    };

    for (let so of device.smartObjects) {
        for (let resource of so.resources) {
            if (!resource.value) continue;

            let name = resource.name.toLowerCase();
            name = name.replace(/ /g, '_');

            o.resources[name] = {
                value: resource.value,
                timestamp: new Date(resource.timestamp)
            }
        }
    }

    return o;
};

Electricity.prototype.subscribeToChanges = async function(interval, callback) {
    let self = this;

    let deviceDb = await self.getAllDevices();

    setInterval(async function() {
        let newDevices = await self.getAllDevices();
        for (let d of deviceDb) {
            let newDevice = newDevices.find(nd => nd.externalId === d.externalId);
            if (!newDevice) continue;
            for (let rk of Object.keys(d.resources)) {
                let oldResource = d.resources[rk];
                let newResource = newDevice.resources[rk];

                if (oldResource.value !== newResource.value) {
                    callback(newDevice.externalId, rk, newResource.value, newResource.timestamp);

                    oldResource.value = newResource.value;
                    oldResource.timestamp = newResource.timestamp;
                }
            }
        }
    }, interval);
};

module.exports = Electricity;
