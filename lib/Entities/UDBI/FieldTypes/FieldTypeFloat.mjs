/**
 * See class
 * @module UDBI/FieldTypes/FieldTypeFloat
 */

import FieldTypeGeneric, {FieldTypeIDs} from "./FieldTypeGeneric.mjs";

/**
 * Used for defining tables
 * @class
 */
class FieldTypeFloat extends FieldTypeGeneric {
	/**
	 *
	 * @param {string} fieldName
	 * @param {number} Precision
	 * @param {number} Scale
	 * @param {FieldTypeOptions} [Options]
	 *
	 */
	constructor(
		fieldName,
		Precision = 8,
		Scale = 2,
		Options
	) {
		super(fieldName, FieldTypeIDs.Float, Options);

		this.Precision = Precision;
		this.Scale = Scale;
	}
}

export default FieldTypeFloat;