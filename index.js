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
var querystring = require('querystring');

var queue = require('./queue.js');
var router = require('./router.js');

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
        .use(queue()).use(router());

    async.waterfall([
        function (next) {
            if (!options.url) {next(null);}
            else {crawler.navigate(options.url, next);}
        },
        function (next) {crawler.crawl(next);}
    ], function (error) {
        if (error) {
            crawler.emit('error', error);
            crawler._complete();
        }
    });

    return crawler;
};

module.exports.Crawler = Crawler;
module.exports.queue = queue;
module.exports.pgQueue = require('./pg-queue.js');
module.exports.router = router;

util.inherits(Crawler, events.EventEmitter);
function Crawler(options) {
    events.EventEmitter.call(this);

    this._middleware = [];
    this._domains = options.domains;
    this._completed = false;
    this._paused = false;
    this._max_concurrency = options
        .max_concurrency || 4;
    this._max_crawl_queue_length = options
        .max_crawl_queue_length || 10;
    this._interval = options.interval || 250;
    this._encoding = options.encoding;
    this._proxy = options.proxy;
    this._headers = options.headers || {
        'user-agent': 'Node/Flexible 0.1.12 ' +
            '(https://github.com/eckardto/flexible)'
    };
    this._timeout = options.timeout;
    this._follow_redirect = options
        .follow_redirect || true;
    this._max_redirects = options
        .max_redirects || 10;
    this._auth = options.auth;
    this._pool = options.pool;
    this._jar = options.jar;

    var self = this;
    this._crawl_queue = async
        .queue(function (doc, callback) {
            self._process(doc, callback);
        }, this._max_concurrency);   
    this._crawl_queue.drain = function () {
        self._complete();
    };

    /**
     * Crawl (recursive)
     */
    this.crawl = function (callback) {
        this._crawl(function (error) {
            if (!self._crawl_queue.tasks.length &&
                !self._crawl_queue.running()) {
                self._complete();
            }

            if (error) {
                if (callback) {callback(error);}
                else {self.emit('error', error);}
            } else if (callback) {callback(null);}
        });
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

    if (this._domains && this._domains[0] &&
        this._domains.indexOf(parsed_location.hostname) === -1) {
        if (callback) {
            callback(new Error('Location is not allowed.'));
        }
    } else {
        // Add to the queue.
        this.queue.add(location, function (error) {
            if (callback) {callback(error);}
        });
    }

    return this;
};

Crawler.prototype._process = function (doc, callback) {
    var self = this;
    async.waterfall([
        // Delay according to crawler interval.
        function (next) {setTimeout(next, self._interval);},
        // Download, while parsing, the doc.
        function (next) {
            var req = request({
                url: doc.url, 
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
            }).on('response', function (res) {
                if (!res.headers['content-type']) {
                    res.request.end();
                    return next(new Error('Missing the content-type.'));
                }

                if (res.headers['content-type'].indexOf('html') === -1) {
                    res.request.end();
                    return next(new Error('Unsupported content-type.'));
                }
                
                var handler = 
                    new htmlparser.DefaultHandler(function (error, dom) {
                        if (error) {return next(error);}

                        if (req.uri && req.uri.query) {
                            req.params = querystring.parse(req.uri.query);
                        } else {req.params = {};}

                        next(null, req.toJSON(), res.toJSON(), body, dom);
                    }), parser = new htmlparser.Parser(handler);
                
                var body = '';
                res.on('data', function (chunk) {
                    if (self._encoding) {
                        chunk = iconv.decode(chunk, self._encoding);
                    }

                    body += chunk.toString();
                    parser.parseChunk(chunk);
                });                    
                
                res.on('error', next);
                res.on('end', function () {parser.done();});
            }).on('error', next);
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
            }, function () {next(null, req, res, body, dom);});
        }
    ], function (error, req, res, body, dom) {
        doc.request = req;
        doc.response = res;
        doc.body = body;
        doc.dom = dom;
        
        if (error) {callback(error, doc);}
        else {
            self.crawl(function (error) {
                callback(error, doc);
            });
        }
    });

    return this;
};

Crawler.prototype._crawl = function (callback) {
    var self = this, fill = true;
    async.whilst(function () {
        return fill && self._crawl_queue.length() < 
            self._max_crawl_queue_length;
    }, function (callback) {
        self.queue.get(function (error, doc) {
            if (error) {return callback(error);}
            if (!doc) {return callback(fill = false);}

            self._crawl_queue.push(doc, function (error, doc) {
                if (error) {
                    error.doc = doc;
                    self.emit('error', error);

                    if (!error.message) {
                        error.message = 'An unknown error has occurred.';
                    }
                }                

                self.queue.end(doc, function (end_error, doc) {
                    if (end_error) {
                        end_error.doc = doc;
                        return self.emit('error', end_error);
                    }

                    if (error) {return;}
                    
                    async.waterfall([
                        function (next) {next(null, self, doc);}
                    ].concat(self._middleware.concat([
                        function (crawler, doc, next) {
                            self.emit('document', doc); 
                            
                            next(null);
                        }
                    ])), function (error) {
                        if (error) {self.emit('error', error);}
                    });
                });
            });

            callback(null);
        });
    }, callback);

    return this;
};

/**
 * Pause crawling.
 */
Crawler.prototype.pause = function () {    
    if (!this._paused) {
        this.crawl = function (callback) {
            var self = this;
            self.once('resumed', function () {
                self._crawl(callback);
            });
        };   

        this._paused = true;
        this.emit('paused');
    }

    return this;
};

/**
 * Resume crawling.
 */
Crawler.prototype.resume = function () {
    if (!this._completed && this._paused) {
        this.crawl = this._crawl;

        this._paused = false;
        this.emit('resumed');
    }

    return this;
};

/**
 * Abort crawling.
 */
Crawler.prototype.abort = function () {
    if (!this._completed) {
        if (this._paused) {return this.resume();}

        this.crawl = function (callback) {
            callback(null);
        };

        this._crawl_queue.tasks.length = 0;
        if (!this._crawl_queue.running()) {
            this._complete();
        }
    }
    
    return this;
};

Crawler.prototype._complete = function () {
    if (!this._completed) {
        this._completed = true;
        this.emit('complete');
    }

    return this;
};