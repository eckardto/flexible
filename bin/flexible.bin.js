#!/usr/bin/env node

'use strict';

var argv = require('optimist')
    .usage('Crawl the web using the Flexible ' + 
           'module for Node.js.\nUsage: $0')

    .alias('url', 'uri')
    .alias('url', 'u')
    .string('url')
    .describe('url', 'URL of web page to ' + 
              'begin crawling on.')

    .alias('domains', 'd')
    .string('domains')
    .describe('domains', 'List of domains ' + 
              'to allow crawling of.')

    .alias('pg-uri', 'pg-url')
    .alias('pg-uri', 'pg')
    .string('pg-uri')
    .describe('pg-uri', 'PostgreSQL URI to ' + 
              'connect to for pgQueue.')
    .demand('pg-uri')

    .default('pg-get-interval', 250)
    .describe('pg-get-interval', 'Request ' + 
              'interval for get of pgQueue.')

    .default('pg-max-get-attempts', 4)
    .describe('pg-max-get-attempts', 'Maximum ' + 
              'attempts for get of pgQueue.')

    .alias('processes', 'p')
    .default('processes', 0)
    .describe('processes', 'Amount of child ' + 
              'processes to use.')

    .alias('interval', 'i')
    .default('interval', 250)
    .describe('interval', 'Request interval ' + 
              'of each crawler.')

    .alias('encoding', 'e')
    .string('encoding')
    .describe('encoding', 'Encoding of response ' + 
              'body for decoding.')

    .alias('max-concurrency', 'm')
    .default('max-concurrency', 4)
    .describe('max-concurrency', 'Maximum ' + 
              'concurrency of each crawler.')

    .default('max-crawl-queue-length', 10)
    .describe('max-crawl-queue-length', 
              'Maximum length of the crawl queue.')

    .alias('user-agent', 'ua')
    .string('user-agent')
    .describe('user-agent', 'User-agent to ' + 
              'identify each crawler as.')

    .alias('timeout', 't')
    .default('timeout', false)
    .describe('timeout', 'Maximum seconds a ' + 
              'request can take.')

    .alias('follow-redirect', 'f')
    .boolean('follow-redirect')
    .describe('follow-redirect', 'Follow HTTP ' + 
              'redirection responses.')
    .default('follow-redirect', true)

    .describe('max-redirects', 'Maximum ' + 
              'amount of redirects.')

    .string('proxy')
    .describe('proxy', 'An HTTP proxy ' + 
              'to use for requests.')

    .alias('controls', 'c')
    .boolean('controls')
    .describe('controls', 'Enable pause (ctrl-p), ' + 
              'resume (ctrl-r), and abort (ctrl-a).')
    .default('controls', true)

    .argv;

if (argv.processes > 0) {
    if (!argv.pg) {
        console.error('Error: pgQueue must be used to ' + 
                      'have multiple processes.');
        return process.exit(1);
    }

    var spawn = require('child_process').spawn, args = [
        __filename, '-c', false, '-t', argv.t, '-f', 
        argv.f, '--pg', argv.pg, '--pg-get-interval', 
        argv['pg-get-interval'], '--pg-max-get-attempts',
        argv['pg-max-get-attempts']
    ];

    if (argv.domains) {args.push('-d', argv.domains);}
    if (argv.p) {args.push('-p', argv.p);}
    if (argv.i) {args.push('-i', argv.i);}
    if (argv.e) {args.push('-e', argv.e);}
    if (argv['max-crawl-queue-length']) {
        args.push('max-crawl-queue-length', 
                  argv['max-crawl-queue-length']);
    }
    if (argv.ua) {args.push('--ua', argv.ua);}    
    if (argv['max-redirects']) {
        args.push('--max-redirects', 
                  argv['max-redirects']);
    }
    if (argv.proxy) {args.push('--proxy', argv.proxy);}

    for (var i = 0; i < argv.processes; i++) {
        var crawler = spawn('node', args);

        crawler.stdout.on('data', function (data) {
            console.log(data.toString().trim());
        });

        crawler.stderr.on('data', function (data) {
            console.error(data.toString().trim());
        });
    }
}

if (argv.domains) {
    var domains = argv.domains.split(',');
    argv.domains = [];
    for (var i = 0; i < domains.length; i++) {
        argv.domains[i] = domains[i].trim();
    }
}

var flexible = require('..');
var crawler = flexible({
    url: argv.url,
    domains: argv.domains,
    interval: argv.interval,
    encoding: argv.encoding,
    max_concurrency: argv.m,
    max_crawl_queue_length: 
    argv['max-crawl-queue-length'],
    user_agent: argv.ua,
    timeout: argv.t,
    follow_redirect: argv.f,
    max_redirects: argv['max-redirects'],
    proxy: argv.proxy
}).route('*', function (req, res) {
    console.log('Crawled:', req.uri.href);
}).once('complete', function () {
    console.log('Crawling has been completed.');
    process.exit();
}).on('paused', function () {            
    console.log('Crawling has been paused.');
}).on('resumed', function () {            
    console.log('Crawling has been resumed.');
}).on('error', function (error) {
    console.error('Error:', error.message);
});

if (argv.pg) {
    crawler.use(flexible.pgQueue({
        uri: argv.pg,
        get_interval: argv['pg-get-interval'],
        max_get_attempts: argv['pg-max-get-attempts']
    }));
}

if (argv.controls) {
    require('keypress')(process.stdin);

    process.stdin.on('keypress', function (ch, key) {
        if (key && key.ctrl) {
            switch (key.name) {
            case 'p': crawler.pause(); break;
            case 'r': crawler.resume(); break;
            case 'a': crawler.abort(); break;
            case 'c': process.exit(); break;
            default: break;
            }
        }
    });

    process.stdin.setRawMode(true);
    process.stdin.resume();
}