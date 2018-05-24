const Electricity = require('./electricity');

const el = new Electricity('http://40.113.6.77:6060', 'elcity', 'hackaton789');

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

(async function() {
    try {
        let deviceDb = {};

        let b = await el.authenticate();

        await el.subscribeToChanges(2000, (externalId, resourceKey, newValue, timestamp) => {
            console.log(externalId, resourceKey, newValue);
        });
    }
    catch (ex) {
        console.error('oops', ex);
    }
})();
