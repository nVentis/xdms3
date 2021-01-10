/**
 * See class declaration
 * @module Core/IDGenerator
 */

class IDGenerator {
	/**
	 * @param {function} IDGeneratorFunction
	 * @param {object} [IDGeneratorOptions={}] - Whenever IDGeneratorFunction is invoked, it is called with namespaceName as first, Content as second and IDGeneratorOptions as third argument
	 */
	constructor(
		IDGeneratorFunction,
		IDGeneratorOptions
	) {
		this.Function = IDGeneratorFunction;
		this.Options = IDGeneratorOptions || {};

		/**
		 * Retrieves a value from the ID generator using the options supplied upon creation
		 * @param {string} namespaceName - Generate IDs per namespace
		 * @param {*} [Content] - Content which may be associated to the ID
		 * @returns {string|number}
		 */
		this.Generate = function (namespaceName, Content) {
			return this.Function(namespaceName, Content, this.Options);
		}
	}
}

export default IDGenerator;