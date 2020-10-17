#!/usr/bin/node

const jitter = 90;//max jitter in seconds
const conf_dir      = '/../conf/';

var www;
var switchingTimes  = {};
var tasks           = {};

var chokidar    = require('chokidar');//https://www.npmjs.com/package/chokidar
var cron        = require('node-cron');//https://github.com/node-cron/node-cron
const path      = require('path');
const fs        = require('fs');
const axios     = require('axios');
const { mainModule } = require('process');

SwitchingTimes_file     = path.resolve(__dirname + conf_dir + 'SwitchingTimes.json');


function loadSwitchingTimes(){
    return JSON.parse(fs.readFileSync(SwitchingTimes_file), 'utf8');
}


function jobs_add(cronTime,deviceid,period,td,state) {
    var key;
    if(period == null){
        key = deviceid;
    }else{
        key = deviceid + '_' + td + '_' + ("000" + period).slice(-3);
    }
    if(tasks[key] == null){
        console.log(`        ${key} Set ${deviceid} to ${state} @ ${cronTime}`);
        var job = cron.schedule(
            cronTime,
            function() {
                console.log(new Date().toISOString(),`| ${deviceid} schedule: ${key} Set to ${state} @ ${cronTime}`);

                axios.post(`http://127.0.0.1:5555/onoff/${deviceid}/${state}`, '')
                .then((res) => {
                    //console.log(`Status: ${res.status}`);
                    //console.log('Body: ', res.data);
                }).catch((err) => {
                    //console.error(err);
                });

            },
            {
                scheduled: true
            }
        );
        tasks[key] = job;
        tasks[key].start();
        return 0;
    }else{
        return 1;//error, job already exists
    }
}


function jobs_remove(deviceid,td,period) {
    var key;
    if(period == null){
        key = deviceid;
    }else{
        key = deviceid + '_' + td + '_' + ("000" + period).slice(-3);
    }
    if(tasks[key]){
        tasks[key].stop();
        tasks[key].destroy();
        delete tasks[key];
    }
}


function jobs_removeAll(){
    var keys = Object.keys(tasks);
    for (let i = 0; i < keys.length; i++) {
        jobs_remove(keys[i]);
    }
}


function jobs_gettasks() {
    return Object.keys(tasks);
}
//===========================================================================================================================


function timesUpdated(){
    jobs_removeAll();//Flush all jobs...
    (async () => {
        await setTimeout(() => {
            //console.log("3s elapsed...");
            console.log(new Date().toISOString(),'|',SwitchingTimes_file,'updated');
            switchingTimes = loadSwitchingTimes();
            //console.log("switchingTimes:",JSON.stringify(switchingTimes));
            const period = ['week','weekend'];// 1-5, 6-7
            const perioddow = {'week':'1,2,3,4,5','weekend':'6,7'};// 1-5, 6-7
            for(var i in period) {
                console.log("Schedule:",period[i]);
                try{
                    for(var deviceid in switchingTimes[period[i]]){
                        console.log("    deviceid:",deviceid);
                        for (var p=0; p<switchingTimes[period[i]][deviceid].length; p++){
                            var t = p*5*60 + Math.floor(Math.random() * jitter);
                            var ts = t%60;
                            var tm = Math.floor((t%3600)/60);
                            var th = Math.floor(t/3600);
                            var td = perioddow[period[i]];
                            if(switchingTimes[period[i]][deviceid][p]=='s'){
                                //console.log(`Switch on:: ${ts} ${tm} ${th} * * ${td}`,deviceid,p);
                                jobs_add(`${ts} ${tm} ${th} * * ${td}`,deviceid,p,td,'on');
                                //console.log("Schedule start time is:",ts,"seconds &",tm,"minutes past",th,"hours","on days",td);
                            }else if(switchingTimes[period[i]][deviceid][p]=='e'){
                                //console.log(`Switch off:: ${ts} ${tm} ${th} * * ${td}`,deviceid,p);
                                jobs_add(`${ts} ${tm} ${th} * * ${td}`,deviceid,p,td,'off');
                            }
                        }
                    }
                } catch (error){
                }
            }
        }, 10); //wait 3 seconds to make sure file has been closed
    })();
}


var watcher = chokidar.watch(SwitchingTimes_file, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});
watcher
    .on('add', path => timesUpdated())
    .on('change', path => timesUpdated());


async function main(){
    console.log(new Date().toISOString(),'| Starting scheduler...');
    console.log(new Date().toISOString(),'| Switching Times:',SwitchingTimes_file);
}

main();
