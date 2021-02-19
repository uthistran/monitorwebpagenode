const express = require('express');
const log4js = require('log4js');
const fs = require('fs');
const checksum = require('checksum')
var http = require('http');
var bodyParser = require('body-parser');
var cors = require("cors");
var helper = require('./helper');
var datetime = require('node-datetime');

const app = express();
app.use(cors());
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

let webpages = [];
let appData = {};
let timer = null;

var rawdata = fs.readFileSync("config.json");
var configData = JSON.parse(rawdata)

log4js.configure({
    appenders: {
        AppProcess: { type: 'file', filename: 'applog.txt' },
        ChangeProcess: { type: 'file', filename: 'changelog.txt' }
    },
    categories: {
        default: { appenders: ['AppProcess'], level: configData.loglevel },
        ChangeProcess: { appenders: ['ChangeProcess'], level: configData.loglevel }
    }
});
const logger = log4js.getLogger('AppProcess');
const changeLogger = log4js.getLogger('ChangeProcess');

app.post('/updateJob', function (req, res) {
    logger.debug("Function Call ::: updateJob");
    var job = req.body.job;
    logger.info("Updated values received ::: " + JSON.stringify(job));
    changeJob(job);
    res.send("succeess");
    logger.debug("Function Call Success::: updateJob");
})

function changeJob(job) {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    appData = job;
    webpages = [];
    evaluateWebpage();
    var frequency = evaluateFrequency();
    startWatching(frequency)
}

function evaluateWebpage() {
    appData.webpages.forEach(function (element) {
        webpages.push({ url: element, checksum: '', isChanged : false })
    })
}

function startWatching(frequency) {
    timer = setInterval(watchWebpage, frequency)
}

function evaluateFrequency() {
    var frequency = appData.frequency;
    var timearray = frequency.split(":")
    return (Number(timearray[0]) * 3600000) + (Number(timearray[1]) * 60000) + (Number(timearray[2]) * 1000)
}

function watchWebpage() {
    webpages.forEach(function (element) {
        siteWatcher(element)
    })
    checkForChange();
}

function checkForChange(){
    var changedArray = webpages.filter(element => element.isChanged == true).map(element=> element.url);
    if(changedArray.length > 0){
        var unchangedArray = webpages.filter(element => element.isChanged == false).map(element => element.url);

        var emailParam = {};
        emailParam["changed_sites"] = changedArray.join(',');
        emailParam["unchanged_sites"] = unchangedArray.join(',');
        var dt = datetime.create();
        var formatteddt = dt.format('Y-m-d H:M:S');
        emailParam["test_time"] = formatteddt;
        emailParam["to_email"] = appData.mail.join(',');
        changeLogger.info("Changed ::: " + JSON.stringify(emailParam));
        helper.sendMail(configData, emailParam);
    }
}

function siteWatcher(siteObject) {
    if (!siteObject.checksumString) {
        var request = http.request(siteObject.url, function (res) {
            var data = '';
            res.on('data', function (chunk) {
                data += chunk;
            });
            res.on('end', function () {
                logger.debug(`Seeding checksum for ${siteObject.url}.`)
                return siteObject.checksumString = checksum(data)
            });
        });
        request.on('error', function (e) {
            console.log(e.message);
        });
        request.end();
    }
    else {
        var request = http.request(siteObject.url, function (res) {
            var data = '';
            res.on('data', function (chunk) {
                data += chunk;
            });
            res.on('end', function () {
                let currentCheckSum = checksum(data);
                if (siteObject.checksumString != currentCheckSum) {
                    siteObject.isChanged = true;
                    logger.debug(`Webpage ${siteObject.url} is not the same.`);
                    siteObject.checksumString = currentCheckSum;
                }
                else {
                    siteObject.isChanged = false;
                    logger.debug(`Webpage ${siteObject.url} is still the same.`)
                }

            });
        });
        request.on('error', function (e) {
            console.log(e.message);
        });
        request.end();
    }
}

app.listen(configData.port, () => logger.info("App launched in port :::" + configData.port));