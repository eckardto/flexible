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

var async = require('async');
var request = require('request');
var iconv = require('iconv-lite');
var htmlparser = require('htmlparser');
var traverse = require('traverse');
var url = require('url');
var util = require('util');
var events = require('events');

var queue = require('./queue.js');
var router = require('./router.js');
var querystring = require('./querystring.js');

/**
 * Initiate a crawler and start crawling.
 */
module.exports = function (options) {
    var crawler = new Crawler();

    crawler.use(querystring()).use(router());

    if (typeof options === 'string') {options = {uri: options};}
    else {
        if (options.url) {options.uri = options.url;}
        for (var option in options) {
            if (options.hasOwnProperty(option)) {
                crawler[option] = options[option];
            }
        }
    }

    if (options.uri) {
        if (!crawler.domains) {
            crawler.domains = [url.parse(options.uri).hostname];
        }

        crawler.navigate(options.uri, function (error) {
            if (error) {crawler.emit('error', error);}
        });
    }

    return crawler;
};

module.exports.Crawler = Crawler;
module.exports.router = router;
module.exports.queue = queue;
module.exports.pgQueue = require('./pg-queue.js');
module.exports.querystring = querystring;

util.inherits(Crawler, events.EventEmitter);
function Crawler() {
    events.EventEmitter.call(this);

    this.use(queue());

    this._middleware = [];
    this.domains = undefined;
    this.max_concurrency = 4;
    this.max_work_queue_length = 10;
    this.interval = 250;
    this.encoding = undefined;
    this.proxy = undefined;
    this.headers = {
        'user-agent': 'Node/Flexible 0.1.0 ' +
            '(https://github.com/eckardto/flexible)'
    };
    this.timeout = undefined;
    this.follow_redirect = true;
    this.max_redirects = 10;
    this.auth = undefined;
    this.pool = undefined;
    this.jar = undefined;
}

/**
 * Use a component.
 */
Crawler.prototype.use = function (component) {
    component(this); return this;
};

/**
 * Navigate to a URI.
 */
Crawler.prototype.navigate = function (uri, callback) {
    // Prepare URI.
    if (uri.indexOf('http://') === -1 && 
        uri.indexOf('https://') === -1) {
        uri = 'http://' + uri;
    }

    if (this.domains && this.domains[0]) {
        var hostname = url.parse(uri).hostname, found;
        for (var i = 0; i < this.domains.length; i++) {
            if (this.domains[i] === hostname) {
                found = true; break;
            }
        }

        if (!found) {
            var error = new Error('URI not allowed to be navigated to.');
            error.uri = uri;

            if (callback) {
                process.nextTick(function () {callback(error);});
            } 
            
            return this;
        }
    }

    // Add to queue.
    var self = this;
    this.queue.add(uri, function (error) {
        if (!error) {self.emit('navigated', uri);} 

        callback(error);
    });

    return this;
};

/**
 * Crawl (recursive)
 */
Crawler.prototype.crawl = function (callback) {
    var self = this;

    if (!this._work_queue) {
        this._work_queue = async.queue(function (item, callback) {
            async.waterfall([
                // Delay according to interval.
                function (next) {
                    setTimeout(function () {next(null);}, self.interval);
                },
                // Download and parse document.
                function (next) {
                    var error, body, res, req = request({
                        uri: item.uri, 
                        encoding: self.encoding ? null : undefined,
                        headers: self.header,
                        proxy: self.proxy,
                        timeout: self.timeout,
                        followRedirect: self.follow_redirect,
                        maxRedirects: self.max_redirects,
                        auth: self.auth,
                        pool: self.pool,
                        jar: self.jar
                    });

                    var handler = new htmlparser
                        .DefaultHandler(function (html_error, dom) {
                            if (html_error) {return next(html_error);}
                            if (error) {return next(error);}
                            
                            next(null, req, res, body, dom);
                        });
                    var parser = new htmlparser.Parser(handler);

                    req.on('response', function (req_res) {
                        res = req_res;

                        if (!res.headers['content-type']) {
                            error = new Error('Content type header missing.');
                            return req.end();
                        }
                        
                        if (res.headers['content-type'].indexOf('html') === -1) {
                            error = new Error('Unsupported content type.');
                            return req.end();
                        }

                        res.on('data', function (chunk) {
                            if (self.encoding) {
                                chunk = iconv.decode(chunk, self.encoding);
                            }

                            body += chunk.toString();
                            parser.parseChunk(chunk);
                        });

                        res.on('error', function (res_error) {
                            error = res_error; res.end();
                        });
                    });

                    req.on('error', function (req_error) {
                        error = req_error; req.end();
                    });

                    req.on('end', function () {parser.done();});
                },
                // Extract and navigate to URIs.
                function (req, res, body, dom, next) {
                    var uris = [];

                    traverse(dom).forEach(function (obj) {
                        if (!obj.attribs || !obj.attribs.href) {return;}

                        var href = obj.attribs.href;
                        var protocol = url.parse(href).protocol;
                        if (protocol && protocol.indexOf('http') === -1) {return;}

                        if (href === '/') {href = res.request.uri.hostname;}
                        else if (!protocol) {
                            if (href.substring(0, 2) === '//') {
                                href = 'http:' + href;
                            } else if (href.charAt(0) === '/') {
                                href = res.request.uri.protocol + '//' + 
                                    res.request.uri.hostname + href;
                            } else {
                                href = res.request.uri.protocol + '//' + 
                                    res.request.uri.hostname + '/' + href;
                            }
                        }                       

                        var start = href.substring(0, href.indexOf('.') + 1);
                        href = start + href.replace(start, '').replace('//', '/');

                        if (href.charAt(href.length - 1) === '/') {
                            href = href.substring(0, href.length - 1);
                        }

                        uris.push(href);
                    });

                    async.forEach(uris, function (uri, callback) {
                        self.navigate(uri, function (error) {
                            if (error) {self.emit('error', error);} 
                            
                            callback(null);
                        });
                    }, function (error) {
                        next(error, req, res, body, dom);
                    });
                }
            ], function (error, req, res, body, dom) {
                self.crawl(function (crawl_error) {
                    callback(crawl_error || error, req, res, body, dom);
                }); 
            });
        }, this.max_concurrency);
        
        this._work_queue.drain = function () {
            self.emit('complete');
        };
    }

    var fill = true;
    async.whilst(function () {
        return fill && self._work_queue
            .length() < self.max_work_queue_length;
    }, function (callback) {
        self.queue.get(function (error, item) {
            if (error) {return callback(error);}
            if (!item) {return callback(fill = false);}

            self._work_queue.push(item, function (error, req, res, body, dom) {
                self.queue.end(item, error, function (end_error, item) {
                    if (end_error) {
                        end_error.item = item; 
                        self.emit('error', end_error);
                    } else if (error) {
                        error.item = item; 
                        self.emit('error', error);
                    } else {
                        var steps = [
                            function (next) {
                                next(null, self, req, res, body, dom, item);
                            }
                        ];

                        for (var i = 0; i < self._middleware.length; i++) {
                            steps.push(self._middleware[i]);
                        }

                        steps.push(function (crawler, req, res, body, dom, item, next) {
                            self.emit('document', req, res, body, dom, item); 
                            next(null);
                        });

                        async.waterfall(steps, function (error) {
                            if (error) {self.emit('error', error);}
                        });
                    }                        
                });
            });
            
            callback(null);
        });
    }, function (error) {
        if (error) {self.emit('error', error);}
        if (callback) {callback(error);}
    });

    return this;
};