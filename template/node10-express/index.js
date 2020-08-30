// Copyright (c) Alex Ellis 2017. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

"use strict"

class FunctionEvent {
  constructor(req) {
    this.body    = req.body;
    this.headers = req.headers;
    this.method  = req.method;
    this.query   = req.query;
    this.path    = req.path;
  }
}

class FunctionContext {
  constructor(cb) {
    this.value = 200;
    this.cb = cb;
    this.headerValues = {};
  }

  status(value) {
    if (!value) {
      return this.value;
    }

    this.value = value;
    return this;
  }

  headers(value) {
    if (!value) {
      return this.headerValues;
    }

    this.headerValues = value;
    return this;
  }

  succeed(value) {
    let err;
    this.cb(err, value);
  }

  fail(value) {
    let message;
    this.cb(value, message);
  }
}

const isArray  = x => (!!x) && (x.constructor === Array );
const isObject = x => (!!x) && (x.constructor === Object);
const createApp = () => {
  const app = require('express')();
  const handler = require('./function/handler');
  const bodyParser = require('body-parser');

  if (process.env.RAW_BODY === 'true') {
    app.use(bodyParser.raw({ type: '*/*' }))
  } else {
    var jsonLimit = process.env.MAX_JSON_SIZE || '100kb' //body-parser default
    app.use(bodyParser.json({ limit: jsonLimit}));
    app.use(bodyParser.raw()); // "Content-Type: application/octet-stream"
    app.use(bodyParser.text({ type : "text/*" }));
  }

  app.disable('x-powered-by');

  let middleware = (req, res) => {
    let cb = (err, functionResult) => {
      if (err) {
        console.error(err);
        return res.status(500).send(err);
      }

      if (isArray(functionResult) || isObject(functionResult)) {
        res.set(fnContext.headers()).status(fnContext.status()).send(JSON.stringify(functionResult));
      } else {
        res.set(fnContext.headers()).status(fnContext.status()).send(functionResult);
      }
    };

    let fnEvent = new FunctionEvent(req);
    let fnContext = new FunctionContext(cb);

    handler(fnEvent, fnContext, cb);
  };

  app.post  ('/*', middleware);
  app.get   ('/*', middleware);
  app.patch ('/*', middleware);
  app.put   ('/*', middleware);
  app.delete('/*', middleware);

  return app;
}

// exporting createApp enables creation of multiple server instances for unit testing
module.exports = createApp;

// server binds to port only if this file is the entrypoint (i.e. 'node index.js')
if (require.main === module) {
  const port = process.env.http_port || 3000;
  createApp().listen(port, () => {
    console.log(`OpenFaaS Node.js listening on port: ${port}`)
  });
}
