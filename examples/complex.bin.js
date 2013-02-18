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
crawler.headers['User-Agent'] = 'Mozilla/6.0 (Windows NT 6.2; ' +
    'WOW64; rv:16.0.1) Gecko/20121011 Firefox/16.0.1';
crawler.domains = ['www.google.com'];
crawler.jar = request.jar();

// Setup middleware.
crawler.use(flexible.querystring);
crawler.use(flexible.router);

// Custom middleware.
crawler.use({
    init: function (crawler) {
        console.log('Custom middleware initiated.');
    },

    call: function (crawler, req, res, body, item, next) {
        console.log('Custom middleware called.');

        var error = null;
        next(error, crawler, req, res, body, item);
    }
});

// Setup route.
crawler.route('*', function (req, res, body, queue_item) {
    console.log('Every document is handled by this route.');
});

// Navigate the crawler to a URI.
crawler.navigate('http://www.google.com', function (error) {
    if (error) {throw error;} 

    // Start crawling.
    crawler.crawl(function (error) {
        if (error) {throw error;}
    });
});

// Events
crawler
    .on('document', function (req, res, body, queue_item) {
        console.log('Document loaded for:', queue_item.uri);
    })
    .on('navigated', function (uri) {
        console.log('Navigated to:', uri);
    })
    .on('complete', function () {console.log('Finished!');})
    .on('error', function (error) {
        if (error.message && 
            error.message.indexOf('URI not allowed') === -1 && 
            error.message.indexOf('Unsupported content type') === -1) {
            console.error('Error: [', error.message, ']');
        }
    });