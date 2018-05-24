function initMap() {
    var map = new google.maps.Map(document.querySelector('#map'), {
        zoom: 12,
        center: config.mapCenter
    });

    function addDevice(device) {
        if (!device.lat || !device.lng) {
            console.log(device);
            return;
        }

        var marker = new google.maps.Marker({
            position: { lat: device.lat, lng: device.lng },
            map: map,
            title: device.name + ' (' + device.id + ')',
            draggable: false,
            icon: '/bus-black.png'
        });

        device.marker = marker;

        marker.addListener('click', function() {
            function getChartConfig(prop) {
                var c = window.config.dataMapping[prop];

                var color = window.chartColorsArr[Object.keys(window.config.dataMapping).indexOf(prop) % window.chartColorsArr.length];

                return {
                    type: 'line',
                    data: {
                        labels: device[prop].map(function(p) { return new Date(p.ts).toLocaleTimeString().split(' ')[0]; }),
                        datasets: [{
                            backgroundColor: color,
                            borderColor: color,
                            data: device[prop].map(function(p) { return p.value; }),
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        animation: false,
                        title: {
                            display: true,
                            text: c.graphTitle
                        },
                        tooltips: {
                            mode: 'index',
                            intersect: false,
                        },
                        hover: {
                            mode: 'nearest',
                            intersect: true
                        },
                        scales: {
                            xAxes: [{
                                display: true,
                                scaleLabel: {
                                    display: false
                                },
                                ticks: {
                                    display: true
                                }
                            }],
                            yAxes: [{
                                display: true,
                                scaleLabel: {
                                    display: true,
                                    labelString: c.yAxisLabel
                                },
                                ticks: {
                                    suggestedMin: c.minY,
                                    suggestedMax: c.maxY
                                }
                            }]
                        },
                        legend: {
                            display: false
                        }
                    }
                };
            }

            var olId = 'overlay-' + device.id;

            var infowindow = new google.maps.InfoWindow({
                content: '<div id="' + olId + '"><p class="eui">Device </p><div class="graphs" style="display: flex"></div></div>'
            });

            infowindow.open(map, this);
            infowindow.addListener('domready', () => {
                var o = document.querySelector('#' + olId + ' .graphs');

                Object.keys(window.config.dataMapping).filter(function(prop) {
                    return window.config.dataMapping[prop].showGraph !== false;
                }).forEach(function(prop) {
                    var config = getChartConfig(prop);

                    var p = document.createElement('p');
                    var cnvs = document.createElement('canvas');
                    cnvs.width = 300;
                    cnvs.height = 200;
                    p.appendChild(cnvs);
                    o.appendChild(p);

                    var ctx = cnvs.getContext('2d');
                    var line = new Chart(ctx, config);

                    socket.on('value-change', function pc(_prop, d, ts, value) {
                        if (o !== document.querySelector('#' + olId + ' .graphs')) {
                            socket.removeListener('value-change', pc);
                            return;
                        }
                        if (d.id !== device.id) {
                            return;
                        }
                        if (_prop !== prop) {
                            return;
                        }

                        config.data.labels.push(new Date(ts).toLocaleTimeString().split(' ')[0]);
                        config.data.datasets[0].data.push(value);

                        var len = config.data.labels.length;
                        var maxLen = window.config.dataMapping[prop].numberOfEvents;

                        if (len > maxLen) {
                            config.data.labels = config.data.labels.slice(len - maxLen);
                            config.data.datasets[0].data = config.data.datasets[0].data.slice(len - maxLen);
                        }

                        line.update();
                    });
                });

                document.querySelector('#' + olId + ' .eui').textContent = device.name + ' (' + device.id + ')';
            });
        });
    }

    window.addDevice = addDevice;

    window.devices.forEach(addDevice);

}
