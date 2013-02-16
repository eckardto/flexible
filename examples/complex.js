#!/usr/bin/env node

'use strict';

var flexible = require('../index.js');
var request = require('request');

var crawler = new flexible.Crawler();

// Use SQLite based queue.
crawler.queue = new flexible.SqliteQueue();

crawler.max_concurrency = 5;
crawler.interval = 100;
crawler.max_redirects = 4;
crawler.headers = {'User-Agent': 'Node/Flexible (https://github.com/Eckardto/flexible)'};
crawler.domains = ['www.google.com'];
crawler.jar = request.jar();

// Setup middleware.
crawler.use(flexible.querystring);
crawler.use(flexible.router);

crawler.route('*', function (req, res, body, queue_item) {
    console.log('Every document is handled by this route.');
});

crawler.on('complete', function () {console.log('Finished!');});
crawler.on('error', function (error) {
    if (error.message && 
        error.message.indexOf('URI not allowed') === -1 && 
        error.message.indexOf('Unsupported content type') === -1) {
        console.error('Error: [', error.message, ']');
    }
});

// Navigate the crawler to a URI.
crawler.navigate('http://www.google.com', function (error) {
    if (error) {throw error;} 

    // Start crawling.
    crawler.crawl();
});