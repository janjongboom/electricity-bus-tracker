# ElectriCity Gothenburg Bus Maps

Uses ElectriCity data to map position of buses in Gothenburg. Based off of https://github.com/janjongboom/ttn-sensor-maps.

## How to run

1. Install Node.js.
1. Clone this repository:

    ```
    $ git clone https://github.com/janjongboom/electricity-bus-tracker
    ```

1. Install dependencies:

    ```
    $ npm install
    ```

1. Run the server:

    ```
    $ node server.js
    ```

1. Navigate to http://localhost:7270.

There is also a Dockerfile in this project if that's more your thing.

**Google Maps API Key**

Before deploying this application, you'll need your own Maps API key. Go to [this web page](https://developers.google.com/maps/documentation/javascript/get-api-key) and obtain one. Then open `server.js` and enter the API key in the `config` object.

## Configuration

To configure what data is shown open `server.js`. In here you have the `config` object. This is where you specify what graphs need to be drawn and how the data needs to be mapped.

The graphs can be configured in the `config` object in `public/maps.js`. E.g. to allow for more graphs to be displayed you can disable the ticks on the x-axes and then lower the height of the map canvas. This project uses [Chart.js](http://www.chartjs.org/).

## Authors and license

This project was funded by Arm Mbed, The Things Network and Multi-Tech and originally created for SXSW 2018. It's maintained by Jan Jongboom and Johan Stokking.

Bus icon by https://www.flaticon.com/free-icon/front-of-bus_308.

This project is licensed under the Apache 2.0 license, and thus can be used freely.
