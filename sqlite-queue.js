'use strict';

var sqlite3 = require('sqlite3').verbose();

exports.Queue = Queue;

var create_table_query = 'CREATE TABLE queue(uri TEXT, ' + 
    'processing INTEGER, completed INTEGER, error TEXT)';

function Queue(database) {
    this._db = new sqlite3.Database(database || ':memory:');
}

/**
 * Add an item to the queue.
 */
Queue.prototype.add = function (uri, callback) {
    var self = this;
    this._db.serialize(function () {
        var query = 'SELECT * FROM queue WHERE uri = ?';
        self._db.get(query, [uri], function (error, item) {
            if (error) {
                if (error.message && error.message.indexOf('no such table') !== -1) {
                    return self._db.run(create_table_query, function (error) {
                        if (error) {callback(error);}
                        else {self.add(uri, callback);}
                    });
                }

                return callback(error);
            }
            if (item) {return callback(null);}

            item = {
                queue: self, 
                uri: uri, 
                processing: false, 
                completed: false,
                error: undefined
            };

            var query = 'INSERT INTO queue VALUES (?, ?, ?, ?)';
            self._db.run(query, [
                item.uri, 
                item.processing ? 1 : 0, 
                item.completed ? 1 : 0, 
                item.error || null
            ], function (error) {callback(error, item);});
        });
    });
};

/**
 * Get an unprocessed queue item.
 */
Queue.prototype.get = function (callback) {
    var self = this;
    this._db.serialize(function () {
        var query = 'SELECT * FROM queue WHERE processing = 0 AND completed = 0';
        self._db.get(query, function (error, item) {
            if (error) {
                if (error.message && error.message.indexOf('no such table') !== -1) {
                    return self._db.get(create_table_query, 
                                        function (error) {callback(error);});
                }

                return callback(error);
            }
            if (!item) {return callback(null);}

            callback(null, {
                queue: self, 
                uri: item.uri, 
                processing: item.processing ? true : false, 
                completed: item.completed ? true : false,
                error: item.error ? new Error(item.error) : undefined
            }); 
        });
    });
};

/**
 * Set a queue item as processing.
 */
Queue.prototype.claim = function (item, callback) {
    item.processing = true;
    
    var self = this;
    this._db.serialize(function () {
        var query = 'UPDATE queue SET processing = 1 WHERE uri = ?';
        self._db.run(query, [item.uri], 
                     function (error) {callback(error, item);});
    });
};

/**
 * Set a queue item as completed.
 */
Queue.prototype.unclaim = function (item, error, callback) {
    item.processing = false;
    item.completed = true;
    item.error = error;

    var self = this;
    this._db.serialize(function () {
        var query = 'UPDATE queue SET processing = 0 AND completed = 1 ' + 
            'AND error = ? WHERE uri = ?';
        self._db.run(query, [
            item.uri, item.error ? 
                (item.error.message || 'Unable to process item.') : null
        ], function (error) {callback(error, item);});
    });
};

/**
 * Close the database.
 */
Queue.prototype.close = function () {this._db.close();};