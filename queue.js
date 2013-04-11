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

module.exports = function () {
    return function (crawler) {
        crawler.queue = new Queue();
    };
};

function Queue() {
    this._items = []; 
    this._history = {};
}

/**
 * Add an item to the queue.
 */
Queue.prototype.add = function (location, callback) {
    if (this._history[location]) {callback(null);} 
    else {   
        var item = {
            queue: this, 
            url: location, 
            processing: false, 
            completed: false,
            error: undefined
        };

        this._items.push(item);
        this._history[location] = true;
        
        callback(null, item);
    }
};

/**
 * Get an item to process.
 */
Queue.prototype.get = function (callback) {
    for (var i = 0, item; !item && 
         i < this._items.length; i++) {
        var new_item = this._items[i];
        if (!new_item.completed && 
            !new_item.processing) {
            item = new_item; break;
        }        
    }

    if (item) {item.processing = true;}

    callback(null, item);
};

/**
 * End processing of item.
 */
Queue.prototype.end = function (item, error, callback) {
    if (typeof error === 'function') {
        callback = error; 
        error = undefined;
    }

    item.processing = false;
    item.completed = true;
    item.error = error;

    callback(null, item);
};