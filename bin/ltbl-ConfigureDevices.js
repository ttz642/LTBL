#!/usr/bin/node

const confFileName      = 'conf/lan-cache.json';

const conf_dir          = '/../conf/';

const fs                = require('fs');
const path              = require('path');
const ewe_conf_file     = path.resolve(__dirname + conf_dir + 'ewelink.config.json');
const ewelink           = require('ewelink-api');
const dns               = require('node-dns-sd');

let devIPmap = {};
var deviceInfo = {};


async function getHosts () {    //homebridge-ewelink
    const res = await dns.discover({ name: '_ewelink._tcp.local' });
    //console.log('res:',res);
    res.forEach(device => {
        const deviceId = device.fqdn.replace('._ewelink._tcp.local', '').replace('eWeLink_', '');
        const ipAddr = device.packet.address;
        devIPmap[deviceId] = ipAddr;
        console.log('Found device:\t'+deviceId);
    });
    return this.deviceMap;
}


function account() {
    let config = JSON.parse(fs.readFileSync(ewe_conf_file), 'utf8');
    return {
        email: config.ewelink.email,
        password: config.ewelink.password,
        region: config.ewelink.region
    };
}


async function main () {
    console.log('Starting...');
    let deviceMap = await getHosts();
    console.log('device Ip\'s',devIPmap);
    var connection = new ewelink(account());// create connection to ITLEAD server
    console.log("\nCreate devices cache...");
    const devices = await connection.getDevices();
    Object.keys(devices).sort().forEach(function(key) {
        var dev = devices[key];
        if((dev.deviceid != null)&&(dev.location != null)){
            var id = dev.name.split(':');
            deviceInfo[id[0]] = {
                type : 'label',
                label : id[0],
                name : dev.name,
                location : id[1],
                IP: devIPmap[dev.deviceid],
                hostname : 'eWelink_'+dev.deviceid+'.local',
                deviceid : dev.deviceid,
                apikey : dev.apikey,
                devicekey : dev.devicekey
            };
            deviceInfo[dev.deviceid] = {
                type : 'deviceid',
                label : id[0]
            };
        }
    });
    console.log('LAN devices::',deviceInfo);
    try {
        fs.writeFileSync(confFileName, JSON.stringify(deviceInfo, null, 2), 'utf8');
        return { status: 'ok', file: confFileName };
    } catch (e) {
        console.log('An error occured while writing JSON Object to File:',confFileName);
        return { error: e.toString() };
    }
}


main();
