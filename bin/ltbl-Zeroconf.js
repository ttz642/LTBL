#!/usr/bin/node
const confFileName = 'conf/lan-cache.json';

var DEBUG = 1;
const PORT_WWW=5555;
const   dashboard_url = 'http://127.0.0.1:8888/';

var S               = require('string');        //https://www.npmjs.com/package/string
var fs              = require('fs');
const path          = require('path');
const axios         = require('axios');
const {exec, execSync} = require('child_process');

var express         = require("express");
var bodyParser      = require("body-parser");
const app           = express();
app.use(bodyParser.urlencoded({ extended: false }));//originally true
app.use(bodyParser.json());

var devs;
var lastresponse = {};



//============================================================================================
//============================================================================================
//============================================================================================
//  const { nonce, timestamp } = require('../node_modules/ewelink-api/src/helpers/utilities');
//--------------------------------------------------------------------------------------------
const nonce = Math.random()
  .toString(36)
  .slice(5);
const timestamp = Math.floor(new Date() / 1000);
//============================================================================================
//============================================================================================
//============================================================================================
//  const deviceControl = require('../node_modules/ewelink-api/src/mixins/deviceControl');
//--------------------------------------------------------------------------------------------
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const random = require('random');
const makeAuthorizationSign = (APP_SECRET, body) =>
  crypto
    .createHmac('sha256', APP_SECRET)
    .update(JSON.stringify(body))
    .digest('base64');
    const create16Uiid = () => {
        let result = '';
        for (let i = 0; i < 16; i += 1) {
            result += random.int(0, 9);
        }
    return result;
};
const encryptionBase64 = t =>
CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(t));
const encryptationData = (data, key) => {
    const encryptedMessage = {};
    const uid = create16Uiid();
    const iv = encryptionBase64(uid);
    const code = CryptoJS.AES.encrypt(data, CryptoJS.MD5(key), {
      iv: CryptoJS.enc.Utf8.parse(uid),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    encryptedMessage.uid = uid;
    encryptedMessage.iv = iv;
    encryptedMessage.data = code.ciphertext.toString(CryptoJS.enc.Base64);
    return encryptedMessage;
};
const decryptionBase64 = t =>
CryptoJS.enc.Base64.parse(t).toString(CryptoJS.enc.Utf8);
const decryptionData = (data, key, iv) => {
    const iv64 = decryptionBase64(iv);
    const code = CryptoJS.AES.decrypt(data, CryptoJS.MD5(key), {
    iv: CryptoJS.enc.Utf8.parse(iv64),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return code.toString(CryptoJS.enc.Utf8);
};
//============================================================================================
//============================================================================================
//============================================================================================



function post(url,json){
    axios.post(url, json)
    .then((res) => {
        //console.log(`Status: ${res.status}`);
        //console.log('Body: ', res.data);
    }).catch((err) => {
        console.error(new Date().toISOString(),' | error:',err);
    });
}



/* process local lan switch change */
//  http POST 127.0.0.1:5555/zeroconf id="10006c438c" iv="MTU3NDU4ODI2NDY4NTg0MQ==" data="fQxsTMoZtumKLsUUJScAufPABrDuh3ZvG/YkLbpf63kgdGEVIfMyMyKxGf4q5yS13kZQK5xTI27daasst+vpMAuSgKqvLrHD/y49rFYT2WY+wC0ln4HhRSRVdVND0iisYVCP9d4Kntm4orUC00zwCBUGZZo930GIYYcA63e1U4yXId10bNzBhdFroIHly5zV"
app.post('/zeroconf', function(req,res){
    var label = devs[req.body.id].label;
    //console.log('packet:',req.body);
    var iv = req.body.iv;
    var data = req.body.data;
    var key = devs[label].devicekey;
    var message = decryptionData (data, key, iv);
    var returned = JSON.parse(message);
    //console.log('decrypted payload:',returned);
    post(dashboard_url+'switch/'+devs[label].deviceid+'/'+returned.switch,'');
    console.log(new Date().toISOString(),'| ',label,'changed state to:',returned.switch);
    lastresponse[label] = iv;
    res.end('');
});



// switch : dev_state
function makePayload(devid, dev_state) {
    msgSwitch = {
        deviceid : '',
        switch : dev_state
    };
    encryptedMessage = encryptationData(JSON.stringify(msgSwitch), devs[devid].devicekey);
    var payload = {
        sequence : Math.floor(timestamp * 1000).toString(),
        deviceid : devs[devid].deviceid,
        selfApikey : devs[devid].apikey,
        iv : encryptedMessage.iv,
        encrypt : true ,
        data : encryptedMessage.data
    };
//    console.log("command:",JSON.stringify(msgSwitch));
//    console.log("payload",JSON.stringify(payload));
    return payload;
}



function sonoffSetSwitch(label,payload,method) {
    //console.log('Switch:',label,'IP:','http://'+devs[label].IP + ':8081/zeroconf/switch','with payload:',payload)
    axios.post('http://'+devs[label].IP + ':8081/zeroconf/switch', payload)
    .then((res) => {
        //console.log(`Status: ${res.status}`);
        //console.log('Body: ', res.data);
    }).catch((err) => {
        console.error(new Date().toISOString(),' | error:',err);
    });
}



/* turn device "on" or" off" */
//  http POST http://127.0.0.1:5555/onoff/P2/on             #P2
//  http POST http://127.0.0.1:5555/onoff/10006c438c/on     #P2
//  http POST http://127.0.0.1:5555/onoff/P2/off            #P2
//  http POST http://127.0.0.1:5555/onoff/10006c438c/off    #P2
app.post('/onoff/:id/:switch(on|off)', function(req,res){
    var state = req.params.switch;
    var id = req.params.id;
    var label = devs[id].label; 
    console.log(new Date().toISOString(),'| Change state of',label,'to',state);
    var payload =  makePayload(label,state);
    sonoffSetSwitch(label,payload,1);
    res.end(JSON.stringify(state));
});



devs = JSON.parse(fs.readFileSync(confFileName), 'utf8');
//console.log('devs::',devs);



//Start listener
app.listen(PORT_WWW,function(){
    console.log("Started lanZeroconf at: "+ new Date() +" on PORT " + PORT_WWW);
});
