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
    if (typeof options === 'string') {
        options = {url: options};
    } else if (!options.url && options.uri) {
        options.url = options.uri;
    }

    if (options.url && !options.domains) {
        options.domains = [url.parse(options.url).hostname];
    }
    
    var crawler = (new Crawler(options))
        .use(queue())
        .use(querystring())
        .use(router());

    async.waterfall([
        function (next) {
            if (!options.url) {next(null);}
            else {crawler.navigate(options.url, next);}
        },
        function (next) {crawler.crawl(next);}
    ], function (error) {
        if (error) {crawler.emit('error', error);}
    });

    return crawler;
};

module.exports.Crawler = Crawler;
module.exports.queue = queue;
module.exports.pgQueue = require('./pg-queue.js');
module.exports.querystring = querystring;
module.exports.router = router;

util.inherits(Crawler, events.EventEmitter);
function Crawler(options) {
    events.EventEmitter.call(this);

    this._middleware = [];
    this._domains = options.domains;
    this._aborted = false;
    this._max_concurrency = options.max_concurrency || 4;
    this._max_crawl_queue_length = options
        .max_crawl_queue_length || 10;
    this._interval = options.interval || 250;
    this._encoding = options.encoding;
    this._proxy = options.proxy;
    this._headers = options.headers || {
        'user-agent': 'Node/Flexible 0.1.11 ' +
            '(https://github.com/eckardto/flexible)'
    };
    this._timeout = options.timeout;
    this._follow_redirect = options.follow_redirect || true;
    this._max_redirects = options.max_redirects || 10;
    this._auth = options.auth;
    this._pool = options.pool;
    this._jar = options.jar;

    var self = this;

    this._crawl_queue = async
        .queue(function (item, callback) {
            async.waterfall([
                // Delay according to crawler interval.
                function (next) {
                    setTimeout(function () {next(null);}, self._interval);
                },
                // Download, while parsing, the document.
                function (next) {
                    var error, body, res, req = request({
                        url: item.url, 
                        encoding: self._encoding ?
                            null : undefined,
                        headers: self._headers,
                        proxy: self._proxy,
                        timeout: self._timeout,
                        followRedirect: self._follow_redirect,
                        maxRedirects: self._max_redirects,
                        auth: self._auth,
                        pool: self._pool,
                        jar: self._jar
                    });

                    var handler = new htmlparser
                        .DefaultHandler(function (html_error, dom) {
                            if (html_error) {next(html_error);}
                            else if (error) {next(error);}
                            else {next(null, req, res, body, dom);}
                        });
                    var parser = new htmlparser.Parser(handler);

                    req.on('response', function (req_res) {
                        res = req_res;

                        if (!res.headers['content-type']) {
                            error = new Error('Content type header is missing.');

                            return req.end();
                        }
                        
                        if (res.headers['content-type'].indexOf('html') === -1) {
                            error = new Error('Unsupported content type.');

                            return req.end();
                        }

                        res.on('data', function (chunk) {
                            if (self._encoding) {
                                chunk = iconv.decode(chunk, self._encoding);
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
                // Discover, and navigate to, locations.
                function (req, res, body, dom, next) {
                    var locations = [];
                    
                    traverse(dom).forEach(function (node) {
                        if (!node.attribs || !node.attribs.href) {return;}

                        var href = node.attribs.href;
                        var protocol = url.parse(href).protocol;
                        
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
                        } else if (protocol.indexOf('http') === -1) {
                            // Only crawl locations using HTTP.
                            return;
                        }

                        var start = href
                            .substring(0, href.indexOf('.') + 1);
                        href = start + href.replace(start, '')
                            .replace('//', '/');
                        
                        if (href.charAt(href.length - 1) === '/') {
                            href = href.substring(0, href.length - 1);
                        }

                        locations.push(href);
                    });

                    async.forEach(locations, function (location, callback) {
                        self.navigate(location, function (error) {
                            if (error) {self.emit('error', error);} 
                            else {self.emit('navigated', location);}
                            
                            callback(null);
                        });
                    }, function () {
                        next(null, req, res, body, dom);
                    });
                }
            ], function (error, req, res, body, dom) {
                if (self._aborted) {
                    return callback(error, req, res, body, dom);
                } 

                self.crawl(function (crawl_error) {
                    callback(crawl_error || error, req, res, body, dom);
                }); 
            });
        }, this._max_concurrency);

    this._crawl_queue.drain = function () {
        self.emit('complete');
    };
}

/**
 * Use a component.
 */
Crawler.prototype.use = function (component) {
    // Plug in the component.
    component(this); 

    return this;
};

/**
 * Navigate to a location.
 */
Crawler.prototype.navigate = function (location, callback) {
    var parsed_location = url.parse(location);

    if (!parsed_location.protocol) {
        location = 'http://' + location;
    }

    if (this._domains) {
        for (var i = 0, found; i < this._domains.length; i++) {
            if (this._domains[i] === parsed_location.hostname) {
                found = true; break;
            }
        }

        if (!found) {
            if (callback) {
                callback(new Error('Location is not allowed.'));                
            }

            return this;
        }
    }

    // Add to the queue.
    this.queue.add(location, function (error) {
        if (callback) {callback(error);}
    });

    return this;
};

/**
 * Crawl (recursive)
 */
Crawler.prototype.crawl = function (callback) {
    var self = this, fill = true;
    async.whilst(function () {
        return !self._aborted && fill && self._crawl_queue
            .length() < self._max_crawl_queue_length;
    }, function (callback) {
        self.queue.get(function (error, item) {
            if (error) {return callback(error);}
            if (!item) {return callback(fill = false);}

            self._crawl_queue.push(item, function (error, req, res, body, dom) {
                self.queue.end(item, error, function (end_error, item) {
                    if (end_error) {
                        end_error.item = item;
                        
                        return self.emit('error', end_error);
                    } 

                    if (error) {
                        error.item = item;

                        return self.emit('error', error);
                    }

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
                });
            });

            callback(null);
        });
    }, function (error) {
        if (callback) {callback(error);}
    });

    return this;
};

/**
 * Abort crawling.
 */
Crawler.prototype.abort = function () {    
    if (this._aborted) {return};

    this._aborted = true;
    this._crawl_queue.tasks.length = 0;

    if (!this._crawl_queue.running()) {
        this.emit('complete');
    }
};