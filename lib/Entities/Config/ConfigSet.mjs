/**
 * @module Entities/Config/ConfigSet
 * See class description
 */

/**
 * Used for storing project-wide config fields, most notably dev/production mode
 * @class
 */
class ConfigSet {
	/**
	 * Unlike Map, an object based constructor is given here
	 * @param {object} someObject Property name => Property value will be taken to the Map
	 */
	constructor(
		someObject = {}
	) {
		/**
		 *
		 * @type {boolean}
		 */
		this.devMode = someObject.devMode || false;

		for (let Prop in someObject)
			this[Prop] = someObject[Prop];

	}
}

export default ConfigSet;