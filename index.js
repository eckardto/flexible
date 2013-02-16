'use strict';

/**
 * Flexible Crawler
 *
 * Easily build flexible, scalable, and distributed, web crawlers.
 */

var async = require('async');
var request = require('request');
var iconv = require('iconv-lite');
var url = require('url');
var util = require('util');
var events = require('events');

var Queue = require('./queue.js').Queue;
var extract = require('./node_modules/extract-region/');

exports.Crawler = Crawler;
exports.Queue = Queue;
exports.SqliteQueue = require('./sqlite-queue.js').Queue;
exports.querystring = require('./querystring.js');
exports.router = require('./router.js');

/**
 * Initiate and return a crawler.
 */
exports.crawl = function (options) {
    var crawler = new Crawler();

    if (typeof options === 'string') {options = {uri: options};}
    else {
        if (options.url) {options.uri = options.url;}
        for (var option in options) {
            if (options.hasOwnProperty(option)) {
                crawler[option] = options[option];
            }
        }
    }

    if (!crawler.domains) {
        crawler.domains = [url.parse(options.uri).hostname];
    }

    crawler.navigate(options.uri, function (error) {
        if (error) {crawler.emit('error', error);}
        else {crawler.crawl();}
    });

    return crawler;
};

function Crawler() {
    this.queue = new Queue();
    this.domains = undefined;
    this._middleware = [];
    this.max_concurrency = 4;
    this.max_work_queue_length = 10;
    this.interval = 250;
    this.encoding = undefined;
    this.proxy = undefined;
    this.headers = undefined;
    this.timeout = undefined;
    this.follow_redirect = true;
    this.max_redirects = 10;
    this.auth = undefined;
    this.pool = undefined;
    this.jar = undefined;
}

util.inherits(Crawler, events.EventEmitter);

/**
 * Navigate to URI.
 */
Crawler.prototype.navigate = function (uri, callback) {
    // Prepare URI.
    if (uri.indexOf('http://') === -1 && 
        uri.indexOf('https://') === -1) {uri = 'http://' + uri;}

    // Check if allowed.
    if (this.domains && this.domains[0]) {
        var hostname = url.parse(uri).hostname;
        for (var i = 0; i < this.domains.length; i++) {
            if (this.domains[i] === hostname) {break;}
            else if (i === this.domains.length - 1) {
                var error = new Error('URI not allowed to be navigated to.');
                error.uri = uri;
                if (callback) {
                    process.nextTick(function () {callback(error);});
                } 

                return this;
            }
        }
    }
    
    // Add to queue.
    var self = this;
    this.queue.add(uri, function (error) {
        self.emit('navigated', uri);
        if (callback) {callback(error);}
    });

    return this;
};

/**
 * Register middleware.
 */
Crawler.prototype.use = function (middleware) {
    if (middleware.init) {middleware.init(this);}
    this._middleware.push(middleware);

    return this;
};

Crawler.prototype.crawl = function (callback) {
    var self = this;

    if (!this._work_queue) {
        this._work_queue = async.queue(function (item, callback) {
            async.waterfall([
                // Download page.
                function (next) {
                    setTimeout(function () {
                        var req = request({
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
                        }, function (error, res, body) {
                            if (error) {return next(error);}

                            if (self.encoding) {
                                body = iconv.decode(body, self.encoding).toString();
                            }
                            
                            next(null, req, res, body);
                        });

                        req.on('response', function (res) {
                            if (res.headers['content-type'] && 
                                res.headers['content-type'].indexOf('html') === -1) {
                                req.end(); next(new Error('Unsupported content type.'));
                            }                           
                        });
                    }, self.interval);
                },
                // Extract and navigate to URIs.
                function (req, res, body, next) {
                    var uris = [], hrefs = extract.all(body, 'href="', '"');
                    for (var i = 0; i < hrefs.length; i++) {
                        var href = hrefs[i];
                        try {href = decodeURI(href);} 
                        catch (e) {continue;}

                        var protocol = url.parse(href).protocol;
                        if (protocol && protocol.indexOf('http') === -1) {continue;}

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
                    }

                    async.forEach(uris, function (uri, callback) {
                        self.navigate(uri, function (error) {
                            if (error) {self.emit('error', error);} 
                            callback(null);
                        });
                    }, function (error) {next(error, req, res, body);});
                }
            ], function (error, req, res, body) {
                self.crawl(function (crawl_error) {
                    callback(crawl_error || error, req, res, body);
                }); 
            });
        }, this.max_concurrency);

        this._work_queue.drain = function () {self.emit('complete');};
    }

    var fill = true;
    async.whilst(function () {
        return fill && self._work_queue.length() < self.max_work_queue_length;
    }, function (callback) {
        self.queue.get(function (error, item) {
            if (error) {return callback(error);}
            if (!item) {return callback(fill = false);}

            self.queue.claim(item, function (error, item) {
                if (error) {return callback(error);}

                self._work_queue.push(item, function (error, req, res, body) {
                    self.queue.unclaim(item, error, function (unclaim_error, item) {
                        if (unclaim_error) {
                            unclaim_error.item = item; self.emit('error', unclaim_error);
                        } else if (error) {error.item = item; self.emit('error', error);}
                        else {
                            var steps = [
                                function (next) {next(null, self, req, res, body, item);}
                            ];

                            for (var i = 0; i < self._middleware.length; i++) {
                                steps.push(self._middleware[i].call);
                            }

                            steps.push(function (crawler, req, res, body, item, next) {
                                self.emit('document', req, res, body, item); next(null);
                            });

                            async.waterfall(steps, function (error) {
                                if (error) {self.emit('error', error);}
                            });
                        }                        
                    });
                });
                
                callback(null);
            });
        });
    }, function (error) {
        if (error) {self.emit('error', error);}
        if (callback) {callback(error);}
    });

    return this;
};