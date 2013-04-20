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
    this._documents = []; 
    this._history = {};
}

/**
 * Add an document to the queue.
 */
Queue.prototype.add = function (location, callback) {
    if (this._history[location]) {callback(null);} 
    else {   
        var document = {
            queue: this, 
            url: location, 
            processing: false, 
            completed: false
        };

        this._documents.push(document);
        this._history[location] = true;
        
        callback(null, document);
    }
};

/**
 * Get an document to process.
 */
Queue.prototype.get = function (callback) {
    for (var i = 0, document; !document && 
         i < this._documents.length; i++) {
        var new_document = this._documents[i];
        if (!new_document.completed && 
            !new_document.processing) {
            document = new_document; break;
        }        
    }

    if (document) {document.processing = true;}

    callback(null, document);
};

/**
 * End processing of document.
 */
Queue.prototype.end = function (document, callback) {
    document.processing = false;
    document.completed = true;

    callback(null, document);
};