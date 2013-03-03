#!/usr/bin/env node

'use strict';

/**
 * Flexible Web-Crawler Module
 * (https://github.com/eckardto/flexible.git)
 *
 * This file is part of Flexible.
 *
 * Flexible is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Flexible is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Flexible.  If not, see <http://www.gnu.org/licenses/>.
 */

var argv = require('optimist')
    .usage('Crawl the web using Flexible.\nUsage: $0')

    .alias('uri', 'url')
    .string('uri')
    .describe('uri', 'URI of web page to begin crawling on.')

    .string('domains')
    .describe('domains', 'List of domains to allow crawling of.')

    .demand('pg')
    .string('pg')
    .describe('pg', 'PostgreSQL URI to connect to for queue.')

    .default('processes', 0)
    .describe('processes', 'Amount of child processes to use.')

    .default('interval', 250)
    .describe('interval', 'Request interval of each crawler.')

    .default('max-concurrency', 5)
    .describe('max-concurrency', 'Maximum concurrency of each crawler.')

    .string('user-agent')
    .describe('user-agent', 'User-agent to identify each crawler as.')

    .default('timeout', false)
    .describe('timeout', 'Maximum seconds a request can take.')

    .boolean('follow-redirect')
    .describe('follow-redirect', 'Follow redirects or not.')

    .describe('max-redirects', 'Maximum amount of redirects.')

    .string('user')
    .describe('user', 'Username for HTTP basic authentication.')

    .string('pass')
    .describe('pass', 'Password for HTTP basic authentication.')

    .string('proxy')
    .describe('proxy', 'An HTTP proxy to use for requests.')

    .argv;

var flexible = require('..');

if (argv.processes > 0) {
    var spawn = require('child_process').spawn;

    var args = [
        __filename, '--interval', argv.interval, '--pg', argv.pg,
        '--max-concurrency', argv['max-concurrency'],
        '--timeout', argv.timeout
    ];

    if (argv.domains) {args.push('--domains', argv.domains);}
    if (argv['follow-redirect']) {
        args.push('--follow-redirect', argv['follow-redirect']);
    }
    if (argv['max-redirects']) {
        args.push('--max-redirects', argv['max-redirects']);
    }
    if (argv.user && argv.pass) {
        args.push('--user', argv.user, '--pass', argv.pass);
    }
    if (argv.proxy) {args.push('--proxy', argv.proxy);}
    if (argv['user-agent']) {
        args.push('--user-agent', argv['user-agent']);
    }

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

var options = {};

if (argv.uri) {options.uri = argv.uri;}
if (argv.domains) {
    var domains = argv.domains.split(',');
    for (var i = 0; i < domains.length; i++) {
        domains[i] = domains[i].trim();
    }
    options.domains = domains;
}
if (argv.interval) {options.interval = argv.interval;}
if (argv['follow-redirect']) {
    options.follow_redirect = argv['follow-redirect'];
}
if (argv['max-concurrency']) {
    options.max_concurrency = argv['max-concurrency'];
}
if (argv['max-redirects']) {
    options.max_redirects = argv['max-redirects'];
}
if (argv.proxy) {options.proxy = argv.proxy;}
if (argv['user-agent']) {
    options.headers = {'user-agent': argv['user-agent']};
}
if (argv.user && argv.pass) {
    options.auth = argv.user + ':' + argv.pass;
}

flexible(options)
    .use(flexible.pgQueue(argv.pg))   

    .route('*', function (req, res) {
        console.log('Crawled:', res.request.uri.href);
    })

    .on('error', function (error) {
        if (error.message.indexOf('not allowed') === -1 &&
            error.message.indexOf('type') === -1) {
            console.error('Error:', error.message || 
                          'An unknown error has occurred.');
        }
    })

    .crawl();