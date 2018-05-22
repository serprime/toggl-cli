"use strict";

var https = require('https');
var sprintf = require('sprintf-js').sprintf;

var Promise = require('promise');

var config = require("./config");

var CONFIG_HOURS_PER_DAY = 7.7;

function printUsage() {
  process.stdout.write("" +
      "usage: node toggl.js OPERATION [PARAMS]\n" +
      "\n" +
      "OPERATIONS:\n" +
      "\n" +
      "  vacation DATE [DATE*]" +
      "    get list of start-stop reports for each date\n" +
      "    eg:\n" +
      "    $> node toggl.js vacation 2016-08-26 2016-08-27\n" +
      "\n" +
      "  report DATE [DATE*]\n" +
      "    get start-stop-pause report for each date" +
      "    eg:\n" +
      "    $> node toggl.js report 2016-08-26 2016-08-27\n" +
      "\n" +
      "  target\n" +
      "    get report on monthly target vs actual hours" +
      "    eg:\n" +
      "    $> node toggl.js target\n");
}

/*
 toggl api wrapper
 */
var toggl = (function () {

  var addVacation = function (date) {
    var from = date + "T10:00:00.000Z";

    var data = {
      time_entry: {
        pid: 16179964,
        description: "Urlaub",
        start: from,
        duration: 7.7 * 60 * 60,
        created_with: "vacation.js",
        duronly: true
      }
    };

    var options = {
      hostname: "www.toggl.com",
      path: "/api/v8/time_entries",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      auth: config.apiToken + ":api_token"
    };

    var req = https.request(options, function (res) {
      console.log('statusCode:', res.statusCode);
      console.log('headers:', res.headers);

      res.on('data', function (d) {
        process.stdout.write(d);
      });
    });
    var payload = JSON.stringify(data);
    console.log(payload);
    req.write(payload);
    req.end();
    req.on('error', function (e) {
      console.error(e);
    });
  };


  /**
   *
   * @param date
   */
  var reportTimes = function (date, opts) {
    var from = date + "T00:00:00.000Z";
    var to = date + "T23:59:59.999Z";

    var query = "";
    if (date) {
      query += "?start_date=" + from + "&end_date=" + to;
    }

    var options = {
      hostname: "www.toggl.com",
      path: "/api/v8/time_entries" + query,
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
      auth: config.apiToken + ":api_token"
    };

    var formatHandler = null;
    switch (opts.format) {
      case "start-pause-stop": {
        formatHandler = printTimesStartPauseStop;
        break;
      }
      case "start-stop": {
        formatHandler = printTimesStartStop;
        break;
      }
      default:
        throw Error("Unknown times format: " + opts.format);
    }

    var req = https.request(options, function (res) {
      res.on('data', function (d) {
        var times = JSON.parse(d);
        formatHandler(times);
      });
    });
    req.end();
    req.on('error', function (e) {
      console.error(e);
    });
  };

  function printTimesStartPauseStop(times) {
    var startDate = new Date(times[0].start);
    var day = sprintf("%02d.%02d.%0d",
        startDate.getDate(), startDate.getMonth() + 1, startDate.getFullYear());
    var start = sprintf("%02d:%02d", startDate.getHours(), startDate.getMinutes());

    var lastTime = times[times.length - 1];
    var stopDate;
    if (lastTime.duronly) {
      stopDate = new Date(new Date(lastTime.start).getTime() + lastTime.duration * 1000);
    } else {
      stopDate = new Date(lastTime.stop);
    }

    var stop = sprintf("%02d:%02d", stopDate.getHours(), stopDate.getMinutes());

    var prevTime = null;
    var pause = 0;

    times.forEach(function (time) {
      if (prevTime) {
        var timeStart = new Date(time.start).getTime();
        var timePrevStop = new Date(prevTime.stop).getTime();
        if (timePrevStop > timeStart) {
          throw Error("time entries may overlap. please check on the website");
        }
        var msDiff = Math.abs(timeStart - timePrevStop);
        var minutesDiff = Math.ceil((msDiff) / 1000 / 60);
        pause += minutesDiff;
      }
      prevTime = time;
    });
    process.stdout.write(sprintf("%s | %s | %03d | %s\n", day, start, pause, stop));
  }

  function printTimesStartStop(times) {
    times.forEach(function (time) {
      var start = new Date(time.start);
      var stop = new Date(time.stop);
      var d = start;
      process.stdout.write(sprintf("%02d.%02d.%0d | %02d:%02d | %2d:%2d\n",
          d.getDate(), d.getMonth() + 1, d.getFullYear(),
          start.getHours(), start.getMinutes(),
          stop.getHours(), stop.getMinutes()
      ));
    })
  }

  function buildStartOfMonth() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }

  function buildEndOfToday() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  var queryTimes = function (start, stop) {
    return new Promise(function (resolve, reject) {
      var from = sprintf("%04d-%02d-%02dT00:00:00.000Z",
          start.getFullYear(), (start.getMonth() + 1), start.getDate());

      var to = sprintf("%04d-%02d-%02dT23:59:59.999Z",
          stop.getFullYear(), (stop.getMonth() + 1), stop.getDate());

      var query = "?start_date=" + from + "&end_date=" + to;

      var options = {
        hostname: "www.toggl.com",
        path: "/api/v8/time_entries" + query,
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
        auth: config.apiToken + ":api_token"
      };

      console.dir(options);

      var req = https.request(options, function (res) {
        res.on('data', function (data) {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data))
          } else {
            var message = data.toString('utf8');
            console.error("error (" + res.statusCode + "): " + message);
            reject(message);
          }

        });
      });
      req.end();
      req.on('error', function (e) {
        console.error(e);
        reject(e);
      });
    });
  };

  var reportMonthlyTarget = function () {
    var startOfMonth = buildStartOfMonth();
    var endOfToday = buildEndOfToday();

    process.stdout.write("month start: " + startOfMonth + "\n");
    process.stdout.write("today end: " + endOfToday + "\n");
    process.stdout.write("target hours per day: " + CONFIG_HOURS_PER_DAY + "\n");

    queryTimes(startOfMonth, endOfToday)
        .then(function (times) {
          times.forEach(function (time) {
            process.stdout.write(JSON.stringify(time, null, 1) + "\n");

            // TODO:
            /*
             {
             "id": 499022930,
             "wid": 1464322,
             "pid": 16179964,
             "billable": false,
             "start": "2016-12-14T08:22:05+00:00",
             "stop": "2016-12-14T12:26:11+00:00",
             "duration": 14646,
             "duronly": false,
             "at": "2016-12-14T12:26:11+00:00",
             "uid": 2249289
             }

             */

            // check for "at" and count days
            // sum up start-stop difference

          })
        });

    process.stdout.write("working days this month: " + "TODO\n");
  };

  return {
    addVacation: addVacation,
    reportTimes: reportTimes,
    reportMonthlyTarget: reportMonthlyTarget
  };
})();

/*
 handle CLI
 */

var args = process.argv.slice(2);

if (args.length == 0) {
  console.warn("ERROR: no date supplied for vacation. nothing to do.\n");
  printUsage();
} else {
  var operation = args[0];
  var params = args.slice(1);

  switch (operation) {
    case "v":
    case "vacation": {
      params.forEach(function (date) {
        toggl.addVacation(date);
      });
      break;
    }
    case "r":
    case "report": {
      params.forEach(function (date) {
        toggl.reportTimes(date, {format: "start-pause-stop"});
      });
      break;
    }
    case "t":
    case "times": {
      params.forEach(function (date) {
        toggl.reportTimes(date, {format: "start-stop"});
      });
      break;
    }
    case "target": {
      toggl.reportMonthlyTarget();
      break;
    }
    default: {
      console.warn("ERROR: unknown operation: " + operation + "\n");
      printUsage();
    }
  }

}

