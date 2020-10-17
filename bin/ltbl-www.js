#!/usr/bin/node

/*
                Check if this is still correct
 *  ACCEPTS
 *      /devices - details of all devices
 *      /device/<dev> - details of a specific device <dev>, eg /devices/L1
 *      /on/<dev>   - switch device <dev> on
 *      /off/<dev>  - switch device <dev> off
 *      /switch/<dev>/<state>   updates device status (from events handler)
 */

const confFileName = 'conf/lan-cache.json';
const SwitchingTimes_file =  'conf/SwitchingTimes.json';

const DEBUG = 1;
const dashboardjs = 'dashboard';
const PORT_WWW = 8888;
const PORT_WS=8800;

var credentials;
var devs;
const WebSocket             = require('ws');
const { exec , execSync}    = require('child_process');
var events                  = require('events');
var fs                      = require('fs');
const path                  = require('path');
var eventEmitter            = new events.EventEmitter();

var SwitchingTimes = {};
var timespan = ["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","",""];

/*
 *      /devices - details of all devices
 *      /device/<dev> - details of a specific device <dev>, eg /devices/L1
 *      /on/<dev>   - switch device <dev> on
 *      /off/<dev>  - switch device <dev> off
 *
 *      http POST http://127.0.0.1:8888/switch/10006c40ec/on
 *      http http://127.0.0.1:8888/index.html
 *
 */
var S               = require('string');        //https://www.npmjs.com/package/string
var express         = require("express");
var bodyParser      = require("body-parser");


devs = JSON.parse(fs.readFileSync(confFileName), 'utf8');
//console.log('devs::',devs);


const app           = express();
app.use(bodyParser.urlencoded({ extended: false }));//originally true
app.use(bodyParser.json());



const conf_dir = '/../www/';



var tableBody;
const head1 = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta http-equiv="Pragma" content="no-cache" />
        <meta http-equiv="Expires" content="0" />
        <title>Switching table</title>
        <link rel="stylesheet" type="text/css" href="/SwitchingTable.css"/>
        <script src="/lib/jquery-3.4.1.min.js"></script>
        <script src="/SwitchingTable.js"></script>
    </head>
    <body>`;


const th='<th>.</th><th>.</th><th>:</th><th>.</th><th>.</th><th>|</th><th>.</th><th>.</th><th>:</th><th>.</th><th>.</th>';
const tableHead = `
<!---  <div class="tscroll"> --->
    <button onclick="ImportSwitchingTimes('week')">Load week</button>
    <button onclick="ImportSwitchingTimes('weekend')">Load weekend</button>
    <button onclick="ExportSwitchingTimes('week')">Update week</button>
    <button onclick="ExportSwitchingTimes('weekend')">Update weekend</button>
    <div id="status">Edit week or weekend switching profiles</div>
    <div class="tscroll">
  <table id="switchtable">
  <tr><th>time:</th>
    <th>0<br>0</th>${th}<th>0<br>1</th>${th}<th>0<br>2</th>${th}<th>0<br>3</th>${th}<th>0<br>4</th>${th}<th>0<br>5</th>${th}<th>0<br>6</th>${th}<th>0<br>7</th>${th}
    <th>0<br>8</th>${th}<th>0<br>9</th>${th}<th>1<br>0</th>${th}<th>1<br>1</th>${th}<th>1<br>2</th>${th}<th>1<br>3</th>${th}<th>1<br>4</th>${th}<th>1<br>5</th>${th}
    <th>1<br>6</th>${th}<th>1<br>7</th>${th}<th>1<br>8</th>${th}<th>1<br>9</th>${th}<th>2<br>0</th>${th}<th>2<br>1</th>${th}<th>2<br>2</th>${th}<th>2<br>3</th>${th}
  </tr>`;



const tableFoot = `</div>
</table>
  <!---  </div> --->
  <div id="debug"></div>
  </body>
</html>`;



const tc='<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>';
const tablecells = `      ${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}${tc}</tr>`;


/*-------------------------------------------------------------------------------------------------------------------*/
process.on("SIGTERM", () => {
    process.exit(0);//comment out to delay exit
    (async () => {
        console.log(" - Caught SIGINT. Exiting in 3 seconds.");
        await setTimeout(() => {
            process.exit(0);
        }, 3000);
    })();
});
process.on("SIGINT", () => {
    process.exit(0);//comment out to delay exit
    (async () => {
        console.log(" - Caught SIGINT. Exiting in 3 seconds.");
        await setTimeout(() => {
            process.exit(0);
        }, 3000);
    })();
});



/*-------------------------------------------------------------------------------------------------------------------*/
function pathToFile(root,file){
    return path.resolve(__dirname + conf_dir + root + file);
}


/*-------------------------------------------------------------------------------------------------------------------*/
var dashboard,dashboard_devices,dashboard_tail;
function buildDashboard(){
var dashboard_head = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>Simple Web Socket Client</title>
    <link rel="stylesheet" type="text/css" href="css/reset.css"/>
    <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
<div id="content">
    <fieldset>
        <legend>Server Location</legend>
        <div>
            <label>URL:</label>
            <input type="text" id="serverUrl" value="ws://127.0.0.1:${PORT_WS}"/>
            <button id="connectButton">Open</button>
            <button id="disconnectButton">Close</button>
        </div>
        <div>
            <label>Status:</label>
            <span id="connectionStatus">CLOSED</span>
        </div>
    </fieldset>
    <fieldset id="SwitchesArea">
        <legend>Switches</legend>
        <div><table>`;
    dashboard_devices = "\n";
    Object.keys(devs).sort().forEach(function(key) {
        if((devs[key].deviceid != null)&&(devs[key].location != null)){
            dashboard_devices += '          <tr>' + 
                '<td><button id="' + devs[key].deviceid + '" onclick=OperateSwitch(' + '"' + devs[key].deviceid + '"' +')>' + key + '</button></td>' + 
                '<td id="' + devs[key].deviceid + '.location' + '" style='+"'"+'background-color:lightblue'+"'>" + devs[key].location + '</td>'  +
                '<td></td>' +
                '<td></td>' +
                '</tr>'+"\n";
        }
    });
    dashboard_tail = `      </table></div>
    </fieldset>
    <fieldset id="requestArea" hidden>
        <legend>Request</legend>
        <div>
            <textarea id="sendMessage" disabled="disabled" style="visibility: hidden"></textarea>
        </div>
        <div>
            <button id="sendButton" disabled="disabled" style="visibility: hidden">Send</button>
        </div>
    </fieldset>
    <fieldset id="messageArea">
        <legend>Event Log <button id="clearMessage">Clear</button></legend>
        <div id="messages"></div>
    </fieldset>
</div>
<script type="text/javascript" src="/lib/jquery-3.4.1.min.js"></script>
<script type="text/javascript" src="${dashboardjs}.js"></script>
</body>
</html>`;
    dashboard = dashboard_head+dashboard_devices+dashboard_tail;
}


/*-------------------------------------------------------------------------------------------------------------------*/
var switchingTable;
function buildSwitchingTable(){//days
    tableBody='';
    (async () => {
        Object.keys(devs).sort().forEach(function(key) {
          if((devs[key].deviceid != null)&&(devs[key].location != null)){
            try {
                tableBody = tableBody + `
  <tr><td id="${devs[key].deviceid}" style="width:100px; color: blue; font-size: 30px">${devs[key].label} : ${devs[key].location}</td>
  ${tablecells}`;
            } catch (error) {
                console.log("deviceid: " + device.deviceid);
            }
          }
        });
        var head2 = `       <div id="banner"><font style="color: white; font-size: 30px;">Switching table</font></div>`;
        switchingTable = head1 + head2 + tableHead + tableBody + tableFoot;
    })();
}


/*-------------------------------------------------------------------------------------------------------------------*/
app.get(/\/e4200\/(.*)/, function(req,res){
    var day = req.params[0];
    console.log(new Date().toISOString(),'| Loading router stats:',day);
    var fn = pathToFile(`html/e4200/`,day);
    if ( day == null || day==''){
        const now = Date.now();
        const today = new Date(now);
        fn = pathToFile(`html/e4200/`,today.getFullYear()+"-"+(today.getMonth()+1).toString().padStart(2,'0')+"-"+today.getDate().toString().padStart(2,'0'))+".html";
        console.log("Use today:",fn);
    }
    console.log(new Date().toISOString(),'| File:',fn);
    res.sendFile(fn);
});


/*-------------------------------------------------------------------------------------------------------------------*/
app.get('/SwitchingTimes/:days(week|weekend)', function(req,res){
    console.log(new Date().toISOString(),'| Loading SwitchingTimes:',req.params.days);
    SwitchingTimes = JSON.parse(fs.readFileSync(SwitchingTimes_file), 'utf8');
    res.type('json');
    //console.log('Switching times table:',SwitchingTimes);
    res.end(JSON.stringify(SwitchingTimes[req.params.days]));
});



/*-------------------------------------------------------------------------------------------------------------------*/
//curl -X POST --data-ascii @/tmp/t  http://127.0.0.1:9999/SwitchingTimes/weekend
app.post('/SwitchingTimes/:days(week|weekend)', function(req,res){
    console.log(new Date().toISOString(),'| Update SwitchingTimes for:',req.params.days);
    SwitchingTimes[req.params.days] = req.body;
    //saveSwitchingTimes(SwitchingTimes);
    (async () => {
        await fs.writeFile(SwitchingTimes_file, JSON.stringify(SwitchingTimes), 'utf8', function (err) {
            if (err) {
                console.log(new Date().toISOString(),'| An error occured while writing JSON Object to File.');
                return console.log(err);
            }
        });
    })();
    res.end('ok');
});




/*-------------------------------------------------------------------------------------------------------------------*/
app.get('/SwitchingTable', function(req,res){//:days(week|weekend)
    console.log(new Date().toISOString(),'| Load SwitchingTable Editor');//,req.params.days
    buildSwitchingTable();//req.params.days
    res.type('html');
    res.end(switchingTable);
});



/*-------------------------------------------------------------------------------------------------------------------*/
app.post('/status', function(req,res){
    (async () => {
        //  avahi-browse -t -d local _ewelink._tcp --resolve -tp
        var cmd = 'avahi-browse -t -d local _ewelink._tcp --resolve -tp > /dev/null';
        var status = exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(new Date().toISOString(),`| error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(new Date().toISOString(),`| stderr: ${stderr}`);
                return;
            }
            //console.log(new Date().toISOString(),`|stdout: ${stdout}`);
        });
        console.log(new Date().toISOString(),'| Fetch device(s) status...');
        res.end();
    })();
});



/*-------------------------------------------------------------------------------------------------------------------*/
app.get('/', function(req,res){
    if(DEBUG){
        console.log("Returning file: /index.html");
    }
    res.redirect('/index.html');
});




/*-------------------------------------------------------------------------------------------------------------------*/
//  http POST http://127.0.0.1:8888/switch/10006c40ec/off
//  /switch/<dev>/<state>
app.post('/switch/:deviceid/:switch', function(req,res){
    if(DEBUG){
        console.log(new Date().toISOString(),'|',req.params.deviceid,'EVENT received',req.params.switch);
    }
    try {
        eventEmitter.emit('switch',`{"deviceid" : "${req.params.deviceid}", "switch" : "${req.params.switch}"}`);
    } catch(err) {
        console.error(new Date().toISOString(),'| ---ERROR---<<<eventEmitter.emit>>> caught while emitting:', err.message);
    }
    //res.type('text');
    //date+" | "+req.params.deviceid+" updated to: "+req.params.switch
    res.end();
});


/*-------------------------------------------------------------------------------------------------------------------*/
app.get('/dashboard', function(req,res){
    res.type('html');
    res.end(dashboard);
});


/*-------------------------------------------------------------------------------------------------------------------*/
app.get('/:dir(lib|css)/:file', function(req,res){
    if(DEBUG){
        console.log(new Date().toISOString(),'| Directory:',req.params.file);
        console.log(new Date().toISOString(),'| File:',req.params.file);
    }
    var file = req.params.file;
    var dir = req.params.dir;
//  res.type('html');
    console.log(new Date().toISOString(),'| File:',pathToFile(`${dir}/`,file));
    res.sendFile(pathToFile(`${dir}/`,file));
});


/*-------------------------------------------------------------------------------------------------------------------*/
//Catch all
//app.get('/:file', auth, function(req,res){
app.get('/:file', function(req,res){
    var file = req.params.file;
    if(DEBUG){
        console.log("File:",file);
    }
//  res.type('html');
    console.log(new Date().toISOString(),'| File:',pathToFile('html/',file));
    res.sendFile(pathToFile('html/',file));
});


/*-------------------------------------------------------------------------------------------------------------------*/
//MAIN code
//Fetch details of devices
(async () => {
//    credentials = await connection.getCredentials();//.login() DEPRECATED
    // get all devices
//    devices = await connection.getDevices();
    console.log('Devices on LAN: ',devs);
//    if(DEBUG)console.log(date,'| devices returned...');
//    soo.readDeviceCache();
    buildDashboard();//Construct dashboard
    console.log(new Date().toISOString(),'| dashboard built');
})();


/*-------------------------------------------------------------------------------------------------------------------*/
//Start listener
const wss = new WebSocket.Server({ port: PORT_WS });
console.log(new Date().toISOString(),'| Started Websocket server on PORT',PORT_WS);
//Websocket server, accepts commands from clients, eg switch on/off
wss.on('connection', ws => {
    console.log(new Date().toISOString(),"| Websocket opened...");
    ws.on('message', message => {
        //ws.send(`you sent: ${message}`)
        console.log(new Date().toISOString(),`| Received command => ${message}`);
        //send command to server to set switch on/off

    });
    ws.send(new Date().toISOString()+' | Message server established...');
    eventEmitter.on('switch', function (state) {
        try{
            ws.send(state);
        }catch (err) {
            console.error(new Date().toISOString(),'| ws.send error::',err);
        }
    });
});


/*-------------------------------------------------------------------------------------------------------------------*/
app.listen(PORT_WWW,function(){
    console.log(new Date().toISOString(),'| Started www server on PORT',PORT_WWW);
    console.log(new Date().toISOString(),'| Document root =', path.resolve(__dirname+conf_dir));
//    if(DEBUG)console.log("Connection: " + JSON.stringify(connection,null,4));
});
