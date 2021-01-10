/**
 * Module supplying an exception for use when an object / class is in a non-expected state
 * @module Exceptions/InvalidStateException
 */

import GenericException from "./GenericException.mjs";

/**
 * @description An exception for use when an object / class is in a non-expected state
 * @param {string} message
 * @constructor
 */

export default class InvalidStateException extends GenericException {
	constructor(message, code) {
		super(message, "InvalidStateException", code);
	}
}