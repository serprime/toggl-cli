# toggl-cli
CLI to get time reports from toggl

Requirements:
- Node.js

# Setup

Go to https://toggl.com/app/profile and get an api token for Toggl api.

Save the api token to ./config.js:
```
module.exports = {
  apiToken: "12345678900987654321"
};
```

Install dependencies:
`npm install`

Run
`node toggl`

# Commands

```
usage: node toggl.js OPERATION [PARAMS]

OPERATIONS:

  vacation DATE [DATE*]  eg:
  $> node toggl.js vacation 2016-08-26 2016-08-27

  report DATE [DATE*]
  eg:
  $> node toggl.js report 2016-08-26 2016-08-27
```
