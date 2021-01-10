/**
 * See class
 * @module UDBI/FieldTypes/FieldTypeInteger
 */

import FieldTypeGeneric, {FieldTypeIDs} from "./FieldTypeGeneric.mjs";

/**
 * Used for defining tables
 * @class
 */
class FieldTypeInteger extends FieldTypeGeneric {
	/**
	 *
	 * @param {string} fieldName
	 * @param {boolean} autoIncrement
	 * @param {FieldTypeOptions} [Options]
	 *
	 */
	constructor(
		fieldName,
		autoIncrement = false,
		Options
	) {
		super(fieldName, FieldTypeIDs.Integer, Options);

		this.autoIncrement = autoIncrement;
	}
}

export default FieldTypeInteger;