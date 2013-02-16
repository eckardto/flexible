#!/usr/bin/env node

'use strict';

var flexible = require('../index.js');

// Initiate and a crawler.
var crawl = flexible.crawl({
    uri: 'http://www.google.com',
    domains: ['www.google.com', 'www.example.com']
});

// Setup middleware.
crawl.use(flexible.querystring);
crawl.use(flexible.router);

crawl.route('*', function (req, res, body, queue_item) {
    console.log('Everything is handled by this route.');
});

crawl.on('complete', function () {console.log('Finished!');});
crawl.on('error', function (error) {console.error(error);});