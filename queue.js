'use strict';

exports.Queue = Queue;

function Queue() {this._items = []; this._history = {};}

/**
 * Add an item to the queue.
 */
Queue.prototype.add = function (uri, callback) {
    if (this._history[uri]) {return callback(null);}

    var item = {
        queue: this, 
        uri: uri, 
        processing: false, 
        completed: false,
        error: undefined
    };

    this._items.push(item);
    this._history[uri] = true;
    
    callback(null, item);
};

/**
 * Get an unprocessed queue item.
 */
Queue.prototype.get = function (callback) {
    var item;

    for (var i = 0; !item && i < this._items.length; i++) {
        var new_item = this._items[i];
        if (!new_item.completed && 
            !new_item.processing) {item = new_item;}        
    }

    callback(null, item);
};

/**
 * Set a queue item as processing.
 */
Queue.prototype.claim = function (item, callback) {
    item.processing = true;
    
    callback(null, item);
};

/**
 * Set a queue item as completed.
 */
Queue.prototype.unclaim = function (item, error, callback) {
    item.processing = false;
    item.completed = true;
    item.error = error;

    callback(null, item);
};