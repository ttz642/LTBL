#!/usr/bin/node

const dns       = require('node-dns-sd');
const axios     = require('axios');

var lastChange  = {};
var blanking;

async function startMonitor () {
    dns.ondata = packet => {
        try{
            if(packet.header.answers == 4){
                var id = packet.answers[1].rdata.id;
                var iv = packet.answers[1].rdata.iv;
                if(lastChange[id] != iv){
                var data1 = packet.answers[1].rdata.data1;
                    var payload = {
                        id,
                        iv,
                        data : data1
                    };
                    axios.post('http://127.0.0.1:5555/zeroconf', payload)
                    .then((res) => {
                    }).catch((err) => {
                        console.error(new Date().toISOString(),' | error:',err);
                    });
                    lastChange[id] = iv;
                    clearTimeout(blanking);
                    blanking = setTimeout(function() {
                        lastChange = {};
                    }, 3000);
                };
            };
        }catch{};
    };
    dns.startMonitoring();
};

async function main () {
    console.log(new Date().toISOString(),'| Starting mDNS/DNS-SD monitor...');
    await startMonitor();
};

main();
