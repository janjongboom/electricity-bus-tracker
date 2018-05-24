const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const hbs = require('hbs');
const fs = require('fs');
const Path = require('path');
const Electricity = require('./electricity');

// improved database
const dbFile = Path.join(__dirname, 'db.json');

// Some options for express (node.js web app library)
hbs.registerPartials(__dirname + '/views/partials');
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.engine('html', hbs.__express);

// Store some state about all applications
let applications = {};

// Store some state about all devices
let devices = {};

// Note here what data you're interested in, and how it can be obtained from a payload message
const config = {
    // Replace this with your own key
    mapsApiKey: 'AIzaSyBVHcLKC3ja-ZCsyWQLe0eBB3q28F7V6X0',

    title: 'Gothenburg Bus Tracker',
    dataMapping: {
        cabinTemperature: {
            graphTitle: 'Driver Cabin Temperature',
            yAxisLabel: 'Temperature (°C)',
            minY: 0, // suggested numbers, if numbers out of this range are received the graph will adjust
            maxY: 50,
            numberOfEvents: 30, // no. of events we send to the client
            data: payload => {
                if (!payload.resources['driver_cabin_temperature']) return undefined;

                return Number(payload.resources['driver_cabin_temperature'].value);
            }
        },
        ambientTemperature: {
            graphTitle: 'Ambient Temperature',
            yAxisLabel: 'Temperature (°C)',
            minY: 0, // suggested numbers, if numbers out of this range are received the graph will adjust
            maxY: 50,
            numberOfEvents: 30, // no. of events we send to the client
            data: payload => {
                if (!payload.resources['ambient_temperature']) return undefined;

                return Number(payload.resources['ambient_temperature'].value);
            }
        },
        lat: {
            showGraph: false,
            data: payload => (payload.resources['gps_nmea_latitude'] || { value: null }).value
        },
        lng: {
            showGraph: false,
            data: payload => (payload.resources['gps_nmea_longtitude'] || { value: null }).value
        }
    },
    mapCenter: {
        lat: 57.7089,
        lng: 11.9746
    }
};

const dataMapping = config.dataMapping;
const mapCenter = config.mapCenter;

if (fs.existsSync(dbFile)) {
    console.time('LoadingDB');
    let db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    devices = db.devices;
    console.timeEnd('LoadingDB');
}

// And handle requests
app.get('/', function (req, res, next) {
    let d = devices.map(d => {

        let o = {
            id: d.externalId,
            name: d.name,
        };

        for (let mapKey of Object.keys(dataMapping)) {
            o[mapKey] = [].slice.call(d[mapKey] || []);

            if (o[mapKey].length > (dataMapping[mapKey].numberOfEvents || 30)) {
                o[mapKey] = o[mapKey].slice(o[mapKey].length - 30);
            }
        }

        if (o.lat && o.lat[o.lat.length - 1]) {
            o.lat = o.lat[o.lat.length - 1].value;
        }
        else {
            o.lat = null;
        }

        if (o.lng && o.lng[o.lng.length - 1]) {
            o.lng = o.lng[o.lng.length - 1].value;
        }
        else {
            o.lng = null;
        }

        return o;
    })
    // Render index view, with the devices based on mapToView function
    res.render('index', {
        devices: JSON.stringify(d),
        config: JSON.stringify(config),
        title: config.title,
        mapsApiKey: config.mapsApiKey
    });
});

io.on('connection', socket => {
    socket.on('connect-application', (appId, accessKey) => {
        console.log('Connecting to application', appId, accessKey);
        connectApplication(appId, accessKey)
            .then(() => socket.emit('connected', appId))
            .catch(err => socket.emit('connect-failed', JSON.stringify(err)));
    });
});

server.listen(process.env.PORT || 7270, process.env.HOST || '0.0.0.0', function () {
    console.log('Web server listening on port %s!', process.env.PORT || 7270);
});

(async function() {
    const el = new Electricity('http://40.113.6.77:6060', 'elcity', 'hackaton789');

    let b = await el.authenticate();

    devices = await el.getAllDevices();

    for (let d of devices) {
        for (let mapKey of Object.keys(dataMapping)) {
            d[mapKey] = d[mapKey] || [];
            let v = dataMapping[mapKey].data(d);
            if (v === null || typeof v === 'undefined') continue;
            d[mapKey].push({ ts: Date.now(), value: v });
        }
    }



    await el.subscribeToChanges(2000, (externalId, resourceKey, newValue, timestamp) => {
        let device = devices.find(nd => nd.externalId === externalId);
        if (!device) return;

        device.resources[resourceKey].value = newValue;
        device.resources[resourceKey].timestamp = timestamp;

        for (let mapKey of Object.keys(dataMapping)) {
            device[mapKey] = device[mapKey] || [];
            let v = dataMapping[mapKey].data(device);
            if (v === null || typeof v === 'undefined') continue;

            // now it's a diff...
            device[mapKey].push({ ts: timestamp, value: v });

            if (mapKey === 'lat' || mapKey === 'lng') {
                io.emit('location-change', { id: externalId }, device.lat[device.lat.length - 1].value, device.lng[device.lng.length - 1].value )
            }
            else {
                io.emit('value-change', mapKey, {
                    id: externalId
                }, timestamp, v);
            }
        }

        console.log(externalId, resourceKey, newValue);
    });
})();

// function connectApplication(appId, accessKey) {
//     if (applications[appId]) {
//         if (!applications[appId].client) {
//             throw 'Already connecting to app ' + appId;
//         }
//         applications[appId].client.close();
//         delete applications[appId];
//     }

//     applications[appId] = {
//         accessKey: accessKey
//     }

//     console.log('[%s] Connecting to TTN', appId);
//     return new Promise((resolve, reject) => {

//         return ttn.data(appId, accessKey).then(client => {
//             applications[appId].client = client;

//             client.on('error', (err) => {
//                 if (err.message === 'Connection refused: Not authorized') {
//                     console.error('[%s] Key is not correct', appId);
//                     client.close();
//                     delete applications[appId];
//                 }
//                 reject(err);
//             });

//             client.on('connect', () => {
//                 console.log('[%s] Connected over MQTT', appId);
//                 resolve();
//             });

//             client.on('uplink', (devId, payload) => {
//                 // on device side we did /100, so *100 here to normalize
//                 if (typeof payload.payload_fields.analog_in_1 !== 'undefined') {
//                     payload.payload_fields.analog_in_1 *= 100;
//                 }

//                 console.log('[%s] Received uplink', appId, devId, payload.payload_fields);

//                 let key = appId + ':' + devId;
//                 let d = devices[key] = devices[key] || {};
//                 d.id = payload.hardware_serial;

//                 for (let mapKey of Object.keys(dataMapping)) {
//                     d[mapKey] = d[mapKey] || [];
//                 }

//                 if (!d.lat) {
//                     d.lat = mapCenter.lat + (Math.random() / 10 - 0.05);
//                 }
//                 if (!d.lng) {
//                     d.lng = mapCenter.lng + (Math.random() / 10 - 0.05);
//                 }

//                 for (let mapKey of Object.keys(dataMapping)) {
//                     let v;
//                     try {
//                         v = dataMapping[mapKey].data(payload);
//                     }
//                     catch (ex) {
//                         console.error('dataMapping[' + mapKey + '].data() threw an error', ex);
//                         throw ex;
//                     }

//                     if (typeof v !== 'undefined') {
//                         d[mapKey].push({
//                             ts: new Date(),
//                             value: v
//                         });

//                         io.emit('value-change', mapKey, {
//                             appId: appId,
//                             devId: devId,
//                             eui: d.eui,
//                         }, new Date(), v);
//                     }
//                 }
//             });

//             console.log('[%s] Acquired MQTT client, connecting...', appId);
//         }).catch(err => {
//             console.error('[%s] Could not connect to The Things Network', appId, err);
//             delete applications[appId];
//             reject(err);
//         });
//     });
// }

function exitHandler(options, err) {
    if (err) {
        console.error('Application exiting...', err);
    }

    let db = {
        devices: devices
    }
    fs.writeFileSync(dbFile, JSON.stringify(db), 'utf-8');

    if (options.exit) {
        process.exit();
    }
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
