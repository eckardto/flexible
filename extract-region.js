'use strict';

/**
 * Easily extract a piece.
 */
exports.get = function (string, left, right) {
    return extract(string, left, right);
};

/**
 * Extract all pieces.
 */
exports.all = function (string, left, right) {
    var pieces = [];
    while (true) {
        var piece = extract(string, left, right);
        if (!piece) {break;}

        string = string.replace(left + piece + right, '');
        pieces.push(piece);
    }

    return pieces;
};

/**
 * Easily extract regions from strings.
 */
function extract(string, left, right) {
    var left_i = string.indexOf(left);
    if (left_i === -1) {return undefined;}
    var start = string.substring(left_i + left.length, string.length);

    var right_i = start.indexOf(right);
    if (right_i === -1) {return undefined;}
    return start.substring(0, right_i);
}