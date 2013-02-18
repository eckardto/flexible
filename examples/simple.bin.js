#!/usr/bin/env node

'use strict';

var flexible = require('../index.js');

// Initiate a crawler. Chainable.
flexible.crawl({uri: 'http://www.google.com', interval: 140})
    .use(flexible.querystring)
    .use(flexible.router)

    .route('*', function (req, res, body, queue_item) {
        console.log('Every document is handled by this route.');
    })

    .on('complete', function () {console.log('Finished!');})
    .on('error', function (error) {console.error(error);});