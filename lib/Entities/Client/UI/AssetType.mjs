/**
 * @module Client/UI/AssetType
 * See class
 */

/**
 * Used for specifying how data may be parsed, e.g. how UI data may be serialized
 * @class
 */
class AssetType {
	/**
	 *
	 * @param {string} Name
	 * @param {object} Options
	 * @param {function} Options.Validate - May return true if the structure of the object supplied to the function matches
	 */
	constructor(
		Name,
		Options
	) {
		this.Name = Name;

		/**
		 *
		 * @param someObject
		 * @returns {boolean}
		 */
		this.Validate = function (someObject) {
			return Options.Validate(someObject);
		}
	}
}

export default AssetType;