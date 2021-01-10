/**
 * Includes multiple functions for translating between naming schemes and plural/singular forms
 * @module Entities/Core/FlectionProvider
 */

/**
 *
 * @param {string} str
 * @returns {string}
 * @example {a_small_server --> aSmallServer}
 */
const snakeToCamel = (str) => str.replace(
	/([-_][a-z])/g,
	(group) => group.toUpperCase()
		.replace('-', '')
		.replace('_', '')
);

/**
 *
 * @param {string} str
 * @returns {string}
 * @example {aSmallServer --> a_small_server}
 */
const camelToSnake = (str) => str.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g).join('_').toLowerCase();

const uppercaseFirstLetter = (str) => str[0].toUpperCase() + str.substring(1);
const uppercaseFirstLetterOnly = (str) => str[0].toUpperCase() + str.toLowerCase().substring(1);

export {
	snakeToCamel,
	camelToSnake,
	uppercaseFirstLetter,
	uppercaseFirstLetterOnly
}