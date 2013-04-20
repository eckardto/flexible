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
    this._docs = []; 
    this._history = {};
}

/**
 * Add an doc to the queue.
 */
Queue.prototype.add = function (location, callback) {
    if (this._history[location]) {callback(null);} 
    else {   
        var doc = {
            queue: this, 
            url: location, 
            processing: false, 
            completed: false
        };

        this._docs.push(doc);
        this._history[location] = true;
        
        callback(null, doc);
    }
};

/**
 * Get an doc to process.
 */
Queue.prototype.get = function (callback) {
    for (var i = 0, doc; !doc && 
         i < this._docs.length; i++) {
        var new_doc = this._docs[i];
        if (!new_doc.completed && 
            !new_doc.processing) {
            doc = new_doc; break;
        }        
    }

    if (doc) {doc.processing = true;}

    callback(null, doc);
};

/**
 * End processing of doc.
 */
Queue.prototype.end = function (doc, callback) {
    doc.processing = false;
    doc.completed = true;

    callback(null, doc);
};