'use strict';

var pg = require('pg');

module.exports = function (options) {
    if (typeof options === 'string') {
        options = {uri: options};
    } else if (options.url) {
        options.uri = options.url;
    }
    
    return function (crawler) {
        crawler.queue = new Queue(options);

        crawler.on('complete', function () {
            crawler.queue._client.end();
        });
    };
};

function Queue(options) {
    this._get_interval = options.get_interval || 250;
    this._max_get_attempts = options.max_get_attempts || 4;
    this._client = new pg.Client(options.uri);
    this._client.connect();
}

/**
 * Setup the database.
 */
Queue.prototype._setup = function (callback) {
    var query = 'CREATE TABLE IF NOT EXISTS queue ' +
        '(url text UNIQUE, processing boolean, ' + 
        'completed boolean, error text)';
    this._client
        .query(query, function (error) {callback(error)});
};

/**
 * Add an item to the queue.
 */
Queue.prototype.add = function (location, callback) {
    var item = {
        queue: this, 
        url: location, 
        processing: false, 
        completed: false,
        error: undefined
    };

    var self = this;
    var query = 'INSERT INTO queue VALUES ($1, $2, $3, $4)';
    this._client.query(query, [
        item.url, 
        item.processing, 
        item.completed, 
        item.error
    ], function (error) {
        if (error) {
            if (error.code) {
                if (error.code === '42P01') {
                    self._setup(function (error) {
                        if (error) {callback(error);}
                        else {self.add(location, callback);}
                    });
                } else if (error.code === '23505') {
                    callback(null, item);
                } else {callback(error);}
            } else {callback(error);}
        } else {callback(null, item);}
    });
};

/**
 * Get an item to process.
 */
Queue.prototype.get = function (callback) {
    var query = 'UPDATE queue SET processing = true WHERE ' +
        'url IN (SELECT url FROM queue WHERE NOT processing ' +
        'AND NOT completed LIMIT 1) RETURNING url';

    var attempts = 0, self = this;
    (function get() {
        self._client.query(query, function (error, results) {
            if (error) {
                if (error.code && 
                    error.code === '42P01') {
                    self._setup(callback);
                } else {callback(error, null);}
            } else if (!results.rows[0]) {
                if (attempts < self._max_get_attempts) {
                    ++attempts;
                    setTimeout(get, self._get_interval);
                } else {callback(null, null);}
            } else {
                callback(null, results.rows[0] ? {
                    url: results.rows[0].url,
                    processing: true,
                    completed: false,
                    error: undefined
                } : null);
            }
        });
    })();
};

/**
 * End processing of item.
 */
Queue.prototype.end = function (item, error, callback) {
    item.processing = false;
    item.completed = true;
    item.error = error;

    var query = 'UPDATE queue SET processing = false, ' +
        'completed = true, error = $1 WHERE url = $2';
    this._client.query(query, [
        item.error ? item.error.message : null, item.url
    ], function (error) {callback(error, item);});
};