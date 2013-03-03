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
var pg = require('pg');

module.exports = function (connection, options) {
    return function (crawler) {
        crawler.queue = new Queue(connection, options);

        // End connection to database on completion.
        crawler.on('complete', function () {
            crawler.queue._client.end();
        });
    };
};

function Queue(connection, options) {
    this._client = new pg.Client(connection);
    this._client.connect();

    if (!options) {
        options = {
            max_get_attempts: 10,
            get_attempt_interval: 250
        };
    } 

    this._max_get_attempts = options.max_get_attempts;
    this._get_attempt_interval = options.get_attempt_interval;
}

var create_table_query = 'CREATE TABLE IF NOT EXISTS queue ' +
    '(uri text UNIQUE, processing boolean, ' + 
    'completed boolean, error text)';

/**
 * Add an item to the queue.
 */
Queue.prototype.add = function (uri, callback) {
    var self = this;

    var item = {
        queue: this, 
        uri: uri, 
        processing: false, 
        completed: false,
        error: undefined
    };
    
    var query = 'INSERT INTO queue VALUES ($1, $2, $3, $4)';
    this._client.query(query, [
        item.uri, 
        item.processing, 
        item.completed, 
        item.error
    ], function (error) {
        if (error) {
            if (error.message) {
                if (error.message
                    .indexOf('relation "queue" does not exist') !== -1) {
                    self._client.query(create_table_query, function (error) {
                        if (error && callback) {callback(error);}
                        else {self.add(uri, callback);}
                    });
                } else if (error.message
                           .indexOf('duplicate key') !== -1) {
                    callback(null, item);
                } else if (callback) {callback(error);}
            } else if (callback) {callback(error);}
        } else if (callback) {callback(null, item);}
    });
};

/**
 * Get an item to process.
 */
Queue.prototype.get = function (callback) {
    var self = this;

    var query = 'UPDATE queue SET processing = true WHERE ' +
        'uri IN (SELECT uri FROM queue WHERE NOT processing ' +
        'AND NOT completed LIMIT 1) RETURNING uri';
    this._client.query(query, function (error, results) {
        if (error) {
            if (error.message && error.message
                .indexOf('relation "queue" does not exist') !== -1) {
                self._client.query(create_table_query, function (error) {
                    callback(error, null);
                });
            } else {callback(error);}
        } else if (results.rows[0]) {
            callback(null, {
                uri: results.rows[0].uri,
                processing: true,
                completed: false,
                error: undefined
            });
        } else {
            var attempts = 0, item;
            async.whilst(function () {
                return !item && 
                    (!self._max_get_attempts || 
                     attempts < self._max_get_attempts);
            }, function (callback) {
                ++attempts;
                
                setTimeout(function () {
                    self.get(function (error, new_item) {
                        if (error) {callback(error);}
                        else {
                            item = new_item;

                            callback(null);
                        }                    
                    });
                }, self._get_attempt_interval);
            }, function (error) {
                callback(error, item);
            });               
        }
    });
};

/**
 * End processing of item.
 */
Queue.prototype.end = function (item, error, callback) {
    item.processing = false;
    item.completed = true;
    item.error = error;

    var query = 'UPDATE queue SET processing = false, ' +
        'completed = true, error = $1 WHERE uri = $2';
    this._client.query(query, [
        item.error, item.uri
    ], function (error) {
        if (callback) {callback(error, item);}
    });
};