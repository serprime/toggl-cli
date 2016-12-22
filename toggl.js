"use strict";

var https = require('https');
var sprintf = require('sprintf-js').sprintf;

var config = require("./config");

function printUsage() {
  process.stdout.write("" +
      "usage: node toggl.js OPERATION [PARAMS]\n" +
      "\n" +
      "OPERATIONS:\n" +
      "\n" +
      "  vacation DATE [DATE*]" +
      "  eg:\n" +
      "  $> node toggl.js vacation 2016-08-26 2016-08-27\n" +
      "\n" +
      "  report DATE [DATE*]\n" +
      "  eg:\n" +
      "  $> node toggl.js report 2016-08-26 2016-08-27\n");
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

    var stopDate = new Date(times[times.length - 1].stop);
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

  return {
    addVacation: addVacation,
    reportTimes: reportTimes
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
    default: {
      console.warn("ERROR: unknown operation: " + operation + "\n");
      printUsage();
    }
  }

}

