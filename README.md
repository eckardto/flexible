Flexible Web-Crawler Module
===========================

Easily build flexible, scalable, and distributed, web crawlers for Node.js.

#### Basic Example

```javascript
var flexible = require('flexible');

// Initiate a crawler. Chainable.
var crawl = flexible.crawl('http://www.example.com');
    .use(flexible.querystring)
    .use(flexible.router)

    .route('/users/:name', function (req, res, body, queue_item) {
        crawl.navigate('http://www.example.com/search?q=' + req.params.name);
    })
    .route('/search', function (req, res, body, queue_item) {
        console.log('Search document handled for:', req.params.q);
    })
    .route('*', function (req, res, body, queue_item) {
        console.log('Every document is handled by this route.');
    })

    .on('complete', function () {console.log('Finished!');})
    .on('error', function (error) {console.error(error);});
```
### What does Flexible provide?
* Asynchronous friendly, and evented, API for building flexible, scalable, and distributed web crawlers.
* An array based queue for small crawls, and a fully SQLite based queue for quickly crawling billions of pages.
* Middleware system; includes router middleware (wildcards, placeholders, etc), and querystring middleware.

### Installation

```
npm install flexible
```

## License
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
