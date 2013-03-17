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

var url = require('url');
var querystring = require('querystring');

module.exports = function () {
    return function (crawler) {
        crawler._middleware
            .push(function (crawler, req, res, body, dom, item, next) {
                var query = url.parse(req.uri.href).query;
                if (query) {
                    query = querystring.parse(query);

                    if (!req.params) {req.params = query;}
                    else {
                        for (var i in query) {
                            if (query.hasOwnProperty(i)) {
                                req.params[i] = query[i];
                            }
                        }
                    }
                }

                next(null, crawler, req, res, body, dom, item);
            });
    };
};