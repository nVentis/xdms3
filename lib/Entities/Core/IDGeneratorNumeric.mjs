/**
 * See class declaration
 * @module Core/IDGeneratorNumeric
 */
import IDGenerator from "./IDGenerator.mjs";

/**
 * Generates numeric values betwen 10^minLength and 10^maxLength
 * @class
 */
class IDGeneratorNumeric extends IDGenerator{
	/**
	 * @param {object} [IDGeneratorConstructorOptions]
	 * @param {number} [IDGeneratorConstructorOptions.Length=5]
	 */
	constructor(
		IDGeneratorConstructorOptions = {}
	) {
		if (!IDGeneratorConstructorOptions.Length)
			IDGeneratorConstructorOptions.Length = 5;

		let lowerBound = Math.pow(10, (IDGeneratorConstructorOptions.Length - 1)), // 10000
			upperMult = lowerBound * 9 - 1, // upperMult = 89999
			IDGeneratorFunction = function (namespaceName, Content, Options) {
				return Math.floor((Math.random() * upperMult) + lowerBound);
			};
			
		super(IDGeneratorFunction);
	}
}

export default IDGeneratorNumeric;