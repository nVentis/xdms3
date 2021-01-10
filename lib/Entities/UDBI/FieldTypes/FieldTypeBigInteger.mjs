/**
 * See class
 * @module UDBI/FieldTypes/FieldTypeBigInteger
 */

import FieldTypeGeneric, {FieldTypeIDs} from "./FieldTypeGeneric.mjs";

/**
 * Used for defining tables
 * @class
 */
class FieldTypeBigInteger extends FieldTypeGeneric {
	/**
	 *
	 * @param {string} fieldName
	 * @param {boolean} autoIncrement
	 */
	constructor(
		fieldName,
		autoIncrement = false
	) {
		super(fieldName, FieldTypeIDs.BigInteger);

		this.autoIncrement = autoIncrement;
	}
}

export default FieldTypeBigInteger;