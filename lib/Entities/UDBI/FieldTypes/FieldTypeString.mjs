/**
 * See class
 * @module UDBI/FieldTypes/FieldTypeString
 */

import FieldTypeGeneric, {FieldTypeIDs} from "./FieldTypeGeneric.mjs";

/**
 * Used for defining tables
 * @class
 */
class FieldTypeString extends FieldTypeGeneric {
	/**
	 *
	 * @param {string} fieldName
	 * @param {number} stringLength
	 * @param {FieldTypeOptions} [Options]
	 */
	constructor(
		fieldName,
		stringLength = 255,
		Options
	) {
		super(fieldName, FieldTypeIDs.String, Options);

		this.Length = stringLength;
	}
}

export default FieldTypeString;